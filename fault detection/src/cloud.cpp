#include "cloud.h"

#include <Arduino.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <esp_task_wdt.h>

#include <cstdarg>
#include <ctime>

#include "app_state.h"
#include "config.h"
#include "device_config.h"
#include "payload.h"
#include "root_certs.h"

namespace cloud {

namespace {

constexpr time_t kMinValidEpoch = 1700000000;  // Nov 2023: anything earlier means "not synced"

bool due(uint32_t now, uint32_t at) { return static_cast<int32_t>(now - at) >= 0; }

// Rate-limited logging so a dead network does not flood the serial console.
void logEvery(uint32_t& last_ms, uint32_t period_ms, const char* fmt, ...) __attribute__((format(printf, 3, 4)));
void logEvery(uint32_t& last_ms, uint32_t period_ms, const char* fmt, ...) {
  const uint32_t now = millis();
  if (last_ms != 0 && now - last_ms < period_ms) return;
  last_ms = now ? now : 1;
  char line[160];
  va_list args;
  va_start(args, fmt);
  vsnprintf(line, sizeof(line), fmt, args);
  va_end(args);
  Serial.printf("[cloud] %s\n", line);
}

String urlEncode(const String& in) {
  static const char* hex = "0123456789ABCDEF";
  String out;
  out.reserve(in.length() + 8);
  for (size_t n = 0; n < in.length(); ++n) {
    const uint8_t c = static_cast<uint8_t>(in[n]);
    if (isalnum(c) || c == '-' || c == '_' || c == '.' || c == '~') {
      out += static_cast<char>(c);
    } else {
      out += '%';
      out += hex[c >> 4];
      out += hex[c & 15];
    }
  }
  return out;
}

// --------------------------------------------------------------------------
// Minimal Firebase client over the public REST APIs:
//   Auth      identitytoolkit  accounts:signInWithPassword  /  securetoken refresh
//   Database  PUT https://<host>/<path>.json?auth=<idToken>
// The RTDB connection is kept alive between writes so the 2 s cadence does not pay a
// TLS handshake each time.
// --------------------------------------------------------------------------
class Firebase {
 public:
  void begin() { db_.setCACert(GOOGLE_ROOT_CAS); }

  bool ensureToken() {
    if (!has_token_) return signIn();
    if (due(millis(), expires_at_ms_)) return refresh() || signIn();
    return true;
  }

  // PUT json at `path` (e.g. "/devices/esp32_01/live"). True on 2xx.
  bool put(const String& path, const char* json) {
    const String url = String("https://") + FIREBASE_DATABASE_HOST + path + ".json?print=silent&auth=" + id_token_;

    // A keep-alive socket the server has since closed fails on first use; retry once
    // on a fresh connection before reporting a failure.
    int code = -1;
    for (int attempt = 0; attempt < 2 && code < 0; ++attempt) {
      esp_task_wdt_reset();  // each attempt is bounded (~2 x HTTP_TIMEOUT_MS) but they add up
      HTTPClient http;
      http.setReuse(true);
      http.setConnectTimeout(HTTP_TIMEOUT_MS);
      http.setTimeout(HTTP_TIMEOUT_MS);
      if (!http.begin(db_, url)) break;
      http.addHeader("Content-Type", "application/json");
      code = http.PUT(String(json));
      http.end();
      if (code < 0) db_.stop();
    }
    last_http_ = code;

    if (code >= 200 && code < 300) {
      denied_streak_ = 0;
      return true;
    }
    if (code == 401 || code == 403) {
      // Either the token expired early or the rules refuse this uid. Renew the token
      // once; if it keeps happening the caller backs off and the log explains why.
      ++denied_streak_;
      expires_at_ms_ = millis();
    }
    return false;
  }

  void dropConnection() { db_.stop(); }
  int lastHttp() const { return last_http_; }
  uint8_t deniedStreak() const { return denied_streak_; }
  const char* uid() const { return uid_; }

 private:
  bool signIn() {
    JsonDocument req;
    req["email"] = FIREBASE_USER_EMAIL;
    req["password"] = FIREBASE_USER_PASSWORD;
    req["returnSecureToken"] = true;
    String body;
    serializeJson(req, body);

    JsonDocument res;
    int code = 0;
    const String url = String("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=") + FIREBASE_API_KEY;
    if (!postAuth(url, "application/json", body, res, code) || code != 200) {
      Serial.printf("[cloud] sign-in failed (HTTP %d): %s\n", code,
                    res["error"]["message"] | "no response");
      has_token_ = false;
      return false;
    }
    storeToken(res["idToken"] | "", res["refreshToken"] | "", res["expiresIn"] | "3600");
    strlcpy(uid_, res["localId"] | "", sizeof(uid_));
    return has_token_;
  }

  bool refresh() {
    JsonDocument res;
    int code = 0;
    const String url = String("https://securetoken.googleapis.com/v1/token?key=") + FIREBASE_API_KEY;
    const String body = String("grant_type=refresh_token&refresh_token=") + urlEncode(refresh_token_);
    if (!postAuth(url, "application/x-www-form-urlencoded", body, res, code) || code != 200) {
      Serial.printf("[cloud] token refresh failed (HTTP %d), signing in again\n", code);
      return false;
    }
    storeToken(res["id_token"] | "", res["refresh_token"] | "", res["expires_in"] | "3600");
    return has_token_;
  }

  void storeToken(const char* id_token, const char* refresh_token, const char* expires_in) {
    if (!*id_token) {
      has_token_ = false;
      return;
    }
    id_token_ = id_token;
    if (*refresh_token) refresh_token_ = refresh_token;
    long ttl = atol(expires_in);
    if (ttl < 2 * TOKEN_REFRESH_MARGIN_S) ttl = 2 * TOKEN_REFRESH_MARGIN_S;
    expires_at_ms_ = millis() + static_cast<uint32_t>(ttl - TOKEN_REFRESH_MARGIN_S) * 1000UL;
    has_token_ = true;
  }

  // One-shot TLS request; the client is destroyed afterwards so its ~40 KB of mbedTLS
  // buffers are returned to the heap.
  bool postAuth(const String& url, const char* content_type, const String& body, JsonDocument& doc, int& code) {
    WiFiClientSecure client;
    client.setCACert(GOOGLE_ROOT_CAS);
    HTTPClient http;
    http.setConnectTimeout(HTTP_TIMEOUT_MS);
    http.setTimeout(HTTP_TIMEOUT_MS);
    if (!http.begin(client, url)) {
      code = -1;
      return false;
    }
    http.addHeader("Content-Type", content_type);
    code = http.POST(body);
    if (code > 0) deserializeJson(doc, http.getString());
    http.end();
    return code > 0;
  }

  WiFiClientSecure db_;
  String id_token_;
  String refresh_token_;
  uint32_t expires_at_ms_ = 0;
  bool has_token_ = false;
  int last_http_ = 0;
  uint8_t denied_streak_ = 0;
  char uid_[48] = "";
};

Firebase g_firebase;

// -------------------------------------------------------------------- Wi-Fi ---

void wifiStart() {
  WiFi.mode(WIFI_STA);
  WiFi.persistent(false);       // do not wear flash with credentials on every boot
  WiFi.setAutoReconnect(true);
  WiFi.setSleep(false);         // steady latency; also less supply ripple on the ADCs
  WiFi.setHostname("powerguard");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

// NTP is mandatory: TLS certificate validation and every `ts` depend on it.
bool ensureTime() {
  static bool sntp_started = false;
  if (time(nullptr) > kMinValidEpoch) return true;
  if (!sntp_started) {
    configTime(0, 0, "pool.ntp.org", "time.google.com", "time.cloudflare.com");
    sntp_started = true;
  }
  const uint32_t start = millis();
  while (time(nullptr) <= kMinValidEpoch && millis() - start < NTP_SYNC_TIMEOUT_MS) {
    esp_task_wdt_reset();
    vTaskDelay(pdMS_TO_TICKS(200));
  }
  return time(nullptr) > kMinValidEpoch;
}

// Builds the sample from the sensor snapshot. Contract rule: fault_type is "none"
// whenever line_fault is false (buildLiveJson enforces it too).
pg::LiveSample toSample(const app::Snapshot& s, int64_t ts) {
  pg::LiveSample out;
  out.line_fault = s.fault != pg::FaultType::None;
  out.fault_type = s.fault;
  out.rain = s.rain;
  out.smoke = s.smoke;
  out.has_smoke_ppm = s.smoke_ready;
  out.smoke_ppm = s.smoke_ppm;
  out.voltage = s.volts;
  out.current = s.amps;
  out.ts = ts;
  return out;
}

void cloudTask(void*) {
  esp_task_wdt_add(nullptr);
  g_firebase.begin();
  wifiStart();

  const String base = String("/devices/") + DEVICE_ID;
  const String live_path = base + "/live";
  const String status_path = base + "/status";

  uint32_t next_live = millis();
  uint32_t next_history = millis();
  uint32_t last_ok = millis();
  uint32_t wifi_attempt = millis();
  uint32_t fail_streak = 0;
  uint32_t log_wifi = 0, log_time = 0, log_auth = 0, log_put = 0;
  bool announced_uid = false;

  for (;;) {
    esp_task_wdt_reset();
    vTaskDelay(pdMS_TO_TICKS(50));

    const bool wifi = WiFi.status() == WL_CONNECTED;
    app::updateNet([&](app::NetStatus& n) {
      n.wifi = wifi;
      n.rssi = wifi ? WiFi.RSSI() : 0;
      n.time_ok = time(nullptr) > kMinValidEpoch;
    });

    if (millis() - last_ok > NO_UPLOAD_RESTART_MS) {
      Serial.println("[cloud] no successful upload for 10 min - restarting");
      Serial.flush();
      ESP.restart();
    }

    if (!wifi) {
      logEvery(log_wifi, 10000, "waiting for Wi-Fi \"%s\"", WIFI_SSID);
      g_firebase.dropConnection();
      if (millis() - wifi_attempt > 20000) {  // auto-reconnect stalled: kick it
        WiFi.disconnect();
        WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
        wifi_attempt = millis();
      }
      continue;
    }
    wifi_attempt = millis();

    if (!ensureTime()) {
      logEvery(log_time, 10000, "waiting for NTP time sync");
      continue;
    }

    if (!g_firebase.ensureToken()) {
      app::updateNet([](app::NetStatus& n) { n.signed_in = false; });
      logEvery(log_auth, 15000, "cannot authenticate - check API key, user and password");
      for (int n = 0; n < 50; ++n) {  // ~5 s back-off, still feeding the watchdog
        esp_task_wdt_reset();
        vTaskDelay(pdMS_TO_TICKS(100));
      }
      continue;
    }
    app::updateNet([](app::NetStatus& n) { n.signed_in = true; });
    if (!announced_uid && *g_firebase.uid()) {
      Serial.printf("[cloud] signed in. This unit's uid: %s\n", g_firebase.uid());
      Serial.printf("[cloud] it must be stored at /config/writers/%s in the database\n", DEVICE_ID);
      app::updateNet([&](app::NetStatus& n) { strlcpy(n.uid, g_firebase.uid(), sizeof(n.uid)); });
      announced_uid = true;
    }

    const uint32_t now = millis();
    if (!due(now, next_live)) continue;

    const app::Snapshot snap = app::snapshot();
    if (!snap.valid || now - snap.updated_ms > STALE_SENSOR_MS) {
      // Sensing has not produced fresh data: send nothing, so the app correctly shows
      // the unit as offline instead of trusting an old reading.
      next_live = now + LIVE_INTERVAL_MS;
      continue;
    }

    const int64_t ts = static_cast<int64_t>(time(nullptr));
    char live_json[256];
    char status_json[96];
    const bool built =
        pg::buildLiveJson(live_json, sizeof(live_json), toSample(snap, ts)) > 0 &&
        pg::buildStatusJson(status_json, sizeof(status_json), USE_SERVER_TIMESTAMP_LAST_SEEN, ts, WiFi.RSSI()) > 0;
    if (!built) {
      next_live = now + LIVE_INTERVAL_MS;
      continue;
    }

    // Heartbeat only after the reading landed, so "online" always means fresh data.
    const bool ok = g_firebase.put(live_path, live_json) && g_firebase.put(status_path, status_json);
    const uint32_t after = millis();

    if (ok) {
      fail_streak = 0;
      last_ok = after;
      next_live += LIVE_INTERVAL_MS;
      if (due(after, next_live)) next_live = after + LIVE_INTERVAL_MS;  // fell behind: do not burst
      app::updateNet([&](app::NetStatus& n) {
        n.live_ok++;
        n.last_ok_ms = after;
        n.last_http = g_firebase.lastHttp();
      });

      if (due(after, next_history)) {
        char key[5];
        pg::historyKey(key, ts);
        const String history_path = base + "/history/" + key;
        if (g_firebase.put(history_path, live_json)) {
          app::updateNet([](app::NetStatus& n) { n.history_ok++; });
        } else {
          logEvery(log_put, 10000, "history write failed (HTTP %d)", g_firebase.lastHttp());
        }
        next_history += HISTORY_INTERVAL_MS;
        if (due(millis(), next_history)) next_history = millis() + HISTORY_INTERVAL_MS;
      }
    } else {
      ++fail_streak;
      app::updateNet([&](app::NetStatus& n) {
        n.live_fail++;
        n.last_http = g_firebase.lastHttp();
      });
      const int http = g_firebase.lastHttp();
      if (g_firebase.deniedStreak() >= 2) {
        logEvery(log_put, 15000,
                 "write refused (HTTP %d). Rules deny this user: set /config/writers/%s = %s and deploy the rules",
                 http, DEVICE_ID, g_firebase.uid());
      } else {
        logEvery(log_put, 10000, "write failed (HTTP %d, %u in a row)", http, static_cast<unsigned>(fail_streak));
      }
      // Exponential back-off 2 s .. 60 s; a refused or unreachable database is not
      // helped by hammering it.
      const uint32_t shift = fail_streak > 5 ? 5 : fail_streak;
      uint32_t backoff = LIVE_INTERVAL_MS << shift;
      if (backoff > 60000) backoff = 60000;
      next_live = millis() + backoff;
    }
  }
}

}  // namespace

void start() {
  xTaskCreatePinnedToCore(cloudTask, "cloud", 12288, nullptr, 1, nullptr, 0);
}

}  // namespace cloud
