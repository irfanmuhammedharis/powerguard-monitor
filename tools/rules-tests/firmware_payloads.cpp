// Prints, as NDJSON, the exact request bodies the ESP32 firmware sends, produced by the
// real serializer in fault detection/lib/powerguard_core (not a re-implementation).
// Consumed by rules.test.js (Firebase rules) and the app's firmwareContract.test.ts.
//
//   {"name": "...", "path": "/devices/esp32_01/live", "body": { ... }}
#include <cstdint>
#include <cstdio>

#include "fault_detector.h"
#include "payload.h"

namespace {

const char* kDevice = "esp32_01";
const int64_t kTs = 1760000000;

void emit(const char* name, const char* path, const char* body) {
  std::printf("{\"name\":\"%s\",\"path\":\"%s\",\"body\":%s}\n", name, path, body);
}

void emitLive(const char* name, const pg::LiveSample& s, bool also_history) {
  char body[256];
  char path[96];
  if (pg::buildLiveJson(body, sizeof(body), s) == 0) {
    std::fprintf(stderr, "buildLiveJson overflow for %s\n", name);
    return;
  }
  std::snprintf(path, sizeof(path), "/devices/%s/live", kDevice);
  emit(name, path, body);
  if (also_history) {
    char key[5];
    pg::historyKey(key, s.ts);
    char hname[64];
    std::snprintf(hname, sizeof(hname), "history-%s", name);
    std::snprintf(path, sizeof(path), "/devices/%s/history/%s", kDevice, key);
    emit(hname, path, body);
  }
}

}  // namespace

int main() {
  pg::LiveSample healthy;
  healthy.has_smoke_ppm = true;
  healthy.smoke_ppm = 412;
  healthy.voltage = 230.44;
  healthy.current = 1.824;
  healthy.ts = kTs;
  emitLive("live-healthy", healthy, true);

  pg::LiveSample fault = healthy;
  fault.line_fault = true;
  fault.fault_type = pg::FaultType::Short;
  fault.current = 15.0;
  emitLive("live-short", fault, false);

  pg::LiveSample over = healthy;
  over.line_fault = true;
  over.fault_type = pg::FaultType::OverCurrent;
  over.current = 12.5;
  emitLive("live-over-current", over, false);

  pg::LiveSample dead = healthy;
  dead.line_fault = true;
  dead.fault_type = pg::FaultType::OpenLine;
  dead.voltage = 0;
  dead.current = 0;
  emitLive("live-open-line", dead, false);

  pg::LiveSample smoke = healthy;
  smoke.smoke = true;
  smoke.smoke_ppm = 2310;
  emitLive("live-smoke", smoke, false);

  pg::LiveSample rain = healthy;
  rain.rain = true;
  emitLive("live-rain", rain, false);

  pg::LiveSample warmup = healthy;  // MQ-135 still warming up: smoke_ppm omitted
  warmup.has_smoke_ppm = false;
  emitLive("live-warmup", warmup, false);

  char path[96];
  char body[128];
  std::snprintf(path, sizeof(path), "/devices/%s/status", kDevice);
  pg::buildStatusJson(body, sizeof(body), true, kTs, -61);
  emit("status-server-timestamp", path, body);
  pg::buildStatusJson(body, sizeof(body), false, kTs, -61);
  emit("status-local-seconds", path, body);
  pg::buildStatusJson(body, sizeof(body), true, kTs, 0);
  emit("status-no-rssi", path, body);
  return 0;
}
