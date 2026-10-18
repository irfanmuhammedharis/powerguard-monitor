#include <Arduino.h>
#include <Wire.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <LiquidCrystal_I2C.h>
#include <TinyGPSPlus.h>
#include <math.h>

#include "telegram_secrets.h"  // WIFI_SSID, WIFI_PASSWORD, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID

// LCD
LiquidCrystal_I2C lcd(0x27, 16, 2);

// GPS on UART2: GPS TX -> GPIO16, GPS RX -> GPIO17
const int GPS_RX_PIN = 16;
const int GPS_TX_PIN = 17;
const uint32_t GPS_BAUD = 9600;
const uint32_t GPS_STALE_MS = 10000;  // older than this = "last known" position

HardwareSerial gpsSerial(2);
TinyGPSPlus gps;

// Sensor pins (all ADC1, so they keep working while Wi-Fi is on)
const int VOLTAGE_PIN = 33;  // ZMPT101B
const int CURRENT_PIN = 34;  // 15A / 1V current sensor
const int MQ3_PIN = 35;      // MQ-3
const int RAIN_PIN = 32;     // Rain sensor AO

// Thresholds
const int RAIN_THRESHOLD = 2000;
const int MQ3_THRESHOLD = 1500;
const float TILT_THRESHOLD = 30.0;

// Alert whenever the unit tilts/moves more than this many degrees from its last position
const float TILT_CHANGE_THRESHOLD = 10.0;

// Calibration (adjust for your modules)
const float VOLTAGE_CALIBRATION = 230.0;
const float CURRENT_A_PER_V = 15.0;

// Set true if analog reading increases when wet
const bool RAIN_VALUE_INCREASES_WHEN_WET = false;

// Timing
const uint32_t SAMPLE_INTERVAL_MS = 1000;       // sensor read + alert check
const uint32_t REPORT_INTERVAL_MS = 30000;      // full report to Telegram
const uint32_t LCD_PAGE_INTERVAL_MS = 2000;     // LCD screen rotation
const uint32_t ALERT_RETRY_INTERVAL_MS = 5000;  // retry a failed alert send
const uint32_t WIFI_RETRY_INTERVAL_MS = 10000;
const uint8_t ALERT_CONFIRM_READS = 2;          // consecutive bad reads before alerting

// Latest readings and their status text
struct Reading {
  float voltage = 0;
  float current = 0;
  int mq3 = 0;
  int rain = 0;
  float tilt = 0;
  bool mpuOK = false;
  const char* voltageStatus = "";
  const char* currentStatus = "";
  const char* mq3Status = "";
  const char* rainStatus = "";
  const char* tiltStatus = "";
};

Reading reading;
bool haveReading = false;

// Alert tracking: fires once when a condition becomes active, once when it clears
struct AlertState {
  const char* name;
  bool active;
  uint8_t count;
};

AlertState voltageAlert = {"Voltage out of range", false, 0};
AlertState mq3Alert = {"MQ3 gas level HIGH", false, 0};
AlertState rainAlert = {"Rain / water detected", false, 0};
AlertState tiltAlert = {"Tilt detected", false, 0};

String pendingAlerts;  // alert text waiting to be delivered
uint32_t lastAlertAttempt = 0;

// Read AC RMS
float readACRMS(int pin) {
  const int samples = 500;
  double sum = 0;
  double sumSquares = 0;

  for (int i = 0; i < samples; i++) {
    float v = analogRead(pin) * 3.3f / 4095.0f;
    sum += v;
    sumSquares += (double)v * v;
    delayMicroseconds(200);
  }

  float mean = sum / samples;
  float variance = sumSquares / samples - mean * mean;

  if (variance < 0) variance = 0;

  return sqrt(variance);
}

// Read MPU6050 accelerometer directly
bool readMPU6050(int &ax, int &ay, int &az) {
  Wire.beginTransmission(0x68);
  Wire.write(0x3B);

  if (Wire.endTransmission(false) != 0) {
    return false;
  }

  if (Wire.requestFrom(0x68, 6) != 6) {
    return false;
  }

  ax = (int16_t)((Wire.read() << 8) | Wire.read());
  ay = (int16_t)((Wire.read() << 8) | Wire.read());
  az = (int16_t)((Wire.read() << 8) | Wire.read());

  return true;
}

// ---------------------------------------------------------------- Telegram

String jsonEscape(const String &s) {
  String out;
  out.reserve(s.length() + 16);
  for (size_t i = 0; i < s.length(); i++) {
    char c = s[i];
    if (c == '"' || c == '\\') {
      out += '\\';
      out += c;
    } else if (c == '\n') {
      out += "\\n";
    } else {
      out += c;
    }
  }
  return out;
}

// Returns true when Telegram accepted the message (HTTP 200)
bool sendTelegram(const String &text) {
  if (WiFi.status() != WL_CONNECTED) return false;

  WiFiClientSecure client;
  client.setInsecure();  // no certificate pinning; token stays in the URL over TLS

  HTTPClient http;
  http.setTimeout(8000);

  String url = String("https://api.telegram.org/bot") + TELEGRAM_BOT_TOKEN + "/sendMessage";
  if (!http.begin(client, url)) return false;

  http.addHeader("Content-Type", "application/json");
  String body = String("{\"chat_id\":\"") + TELEGRAM_CHAT_ID +
                "\",\"text\":\"" + jsonEscape(text) + "\"}";

  int code = http.POST(body);
  http.end();

  if (code != 200) {
    Serial.printf("Telegram send failed (HTTP %d)\n", code);
    return false;
  }
  return true;
}

// Feed pending GPS bytes to the NMEA parser
void feedGps() {
  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }
}

// Position text for Telegram: current fix, last known fix, or no fix yet
String gpsSummary() {
  if (!gps.location.isValid()) {
    return "Location: no GPS fix yet";
  }

  char buf[160];
  uint32_t age = gps.location.age();
  if (age < GPS_STALE_MS) {
    snprintf(buf, sizeof(buf), "Location: %.6f, %.6f\nhttps://maps.google.com/?q=%.6f,%.6f",
             gps.location.lat(), gps.location.lng(),
             gps.location.lat(), gps.location.lng());
  } else {
    snprintf(buf, sizeof(buf),
             "Location (last known, %lus ago): %.6f, %.6f\nhttps://maps.google.com/?q=%.6f,%.6f",
             (unsigned long)(age / 1000),
             gps.location.lat(), gps.location.lng(),
             gps.location.lat(), gps.location.lng());
  }
  return String(buf);
}

String sensorSummary() {
  char buf[256];
  if (reading.mpuOK) {
    snprintf(buf, sizeof(buf),
             "Voltage: %.1f V (%s)\nCurrent: %.2f A (%s)\nMQ3: %d (%s)\n"
             "Rain: %d (%s)\nTilt: %.1f deg (%s)",
             reading.voltage, reading.voltageStatus,
             reading.current, reading.currentStatus,
             reading.mq3, reading.mq3Status,
             reading.rain, reading.rainStatus,
             reading.tilt, reading.tiltStatus);
  } else {
    snprintf(buf, sizeof(buf),
             "Voltage: %.1f V (%s)\nCurrent: %.2f A (%s)\nMQ3: %d (%s)\n"
             "Rain: %d (%s)\nTilt: MPU ERROR",
             reading.voltage, reading.voltageStatus,
             reading.current, reading.currentStatus,
             reading.mq3, reading.mq3Status,
             reading.rain, reading.rainStatus);
  }
  return String(buf);
}

// Sensor readings plus GPS position: used for the serial log, reports and alerts
String readingSummary() {
  return sensorSummary() + "\n" + gpsSummary();
}

void queueAlert(const String &text) {
  if (pendingAlerts.length() > 0) pendingAlerts += "\n\n";
  pendingAlerts += text;
  // Keep the backlog bounded while offline; Telegram's limit is 4096 chars
  if (pendingAlerts.length() > 3000) {
    pendingAlerts = pendingAlerts.substring(pendingAlerts.length() - 3000);
  }
  lastAlertAttempt = 0;  // try right away
}

void updateAlert(AlertState &alert, bool condition) {
  if (condition) {
    if (alert.count < ALERT_CONFIRM_READS) alert.count++;
    if (alert.count >= ALERT_CONFIRM_READS && !alert.active) {
      alert.active = true;
      queueAlert(String("ALERT: ") + alert.name + "\n" + readingSummary());
    }
  } else {
    alert.count = 0;
    if (alert.active) {
      alert.active = false;
      queueAlert(String("CLEARED: ") + alert.name + "\n" + readingSummary());
    }
  }
}

// Deliver queued alerts as soon as Wi-Fi allows
void flushAlerts() {
  if (pendingAlerts.length() == 0) return;
  if (WiFi.status() != WL_CONNECTED) return;
  if (lastAlertAttempt != 0 && millis() - lastAlertAttempt < ALERT_RETRY_INTERVAL_MS) return;

  lastAlertAttempt = millis();
  if (sendTelegram(pendingAlerts)) {
    pendingAlerts = "";
    lastAlertAttempt = 0;
  }
}

// Tilt from the last position: compares the gravity vector with the one saved at the
// previous position, so a tilt in any direction counts. After an alert the current
// position becomes the new "last position", so every further tilt alerts again.
void checkTiltMovement(int ax, int ay, int az) {
  static bool baselineValid = false;
  static float bx = 0, by = 0, bz = 0;
  static uint8_t moveCount = 0;

  if (!reading.mpuOK) {
    moveCount = 0;
    return;
  }

  float cx = ax, cy = ay, cz = az;

  if (!baselineValid) {
    bx = cx;
    by = cy;
    bz = cz;
    baselineValid = true;
    return;
  }

  float mag = sqrtf(cx * cx + cy * cy + cz * cz) * sqrtf(bx * bx + by * by + bz * bz);
  if (mag < 1.0f) return;

  float cosine = (cx * bx + cy * by + cz * bz) / mag;
  if (cosine > 1.0f) cosine = 1.0f;
  if (cosine < -1.0f) cosine = -1.0f;
  float moved = acosf(cosine) * 180.0f / PI;

  if (moved > TILT_CHANGE_THRESHOLD) {
    if (++moveCount >= ALERT_CONFIRM_READS) {
      queueAlert(String("ALERT: Tilt moved ") + String(moved, 1) +
                 " deg from last position\n" + readingSummary());
      bx = cx;
      by = cy;
      bz = cz;
      moveCount = 0;
    }
  } else {
    moveCount = 0;
  }
}

// ----------------------------------------------------------------- Wi-Fi

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

void maintainWiFi() {
  static uint32_t lastRetry = 0;
  if (WiFi.status() == WL_CONNECTED) return;
  if (millis() - lastRetry < WIFI_RETRY_INTERVAL_MS) return;
  lastRetry = millis();
  Serial.println("Wi-Fi down, reconnecting...");
  WiFi.disconnect();
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

// ---------------------------------------------------------------- Sensors

void sampleSensors() {
  // Read voltage and current
  float voltageRMS = readACRMS(VOLTAGE_PIN);
  float currentRMS = readACRMS(CURRENT_PIN);

  // Approximate readings; calibration required
  reading.voltage = voltageRMS * VOLTAGE_CALIBRATION;
  reading.current = currentRMS * CURRENT_A_PER_V;

  // Read MQ3 and rain sensor
  reading.mq3 = analogRead(MQ3_PIN);
  reading.rain = analogRead(RAIN_PIN);

  // Read MPU6050
  int ax = 0, ay = 0, az = 0;
  reading.mpuOK = readMPU6050(ax, ay, az);
  reading.tilt = reading.mpuOK ? atan2((float)ax, (float)az) * 180.0f / PI : 0;

  // Determine status
  bool voltageBad = !(reading.voltage >= 180.0f && reading.voltage <= 260.0f);
  bool mq3High = reading.mq3 > MQ3_THRESHOLD;
  bool wet = RAIN_VALUE_INCREASES_WHEN_WET ? (reading.rain > RAIN_THRESHOLD)
                                           : (reading.rain < RAIN_THRESHOLD);
  bool tilted = !reading.mpuOK || fabs(reading.tilt) > TILT_THRESHOLD;

  reading.voltageStatus = voltageBad ? "CHECK" : "NORMAL";
  reading.currentStatus = (reading.current > 0.10f) ? "LOAD ON" : "NO LOAD";
  reading.mq3Status = mq3High ? "HIGH" : "LOW";
  reading.rainStatus = wet ? "WET" : "DRY";
  reading.tiltStatus = !reading.mpuOK ? "MPU ERROR" : (tilted ? "TILTED" : "NORMAL");

  haveReading = true;

  // Print all sensor readings to Serial Monitor
  Serial.println("\n--- SENSOR STATUS ---");
  Serial.println(readingSummary());

  // Alerts are queued here and sent immediately by flushAlerts()
  updateAlert(voltageAlert, voltageBad);
  updateAlert(mq3Alert, mq3High);
  updateAlert(rainAlert, wet);
  updateAlert(tiltAlert, tilted);
  checkTiltMovement(ax, ay, az);
}

// -------------------------------------------------------------------- LCD

void showLcdPage(uint8_t page) {
  lcd.clear();
  lcd.setCursor(0, 0);

  switch (page) {
    case 0:
      lcd.print("Voltage:");
      lcd.print(reading.voltage, 0);
      lcd.print("V");
      lcd.setCursor(0, 1);
      lcd.print(reading.voltageStatus);
      break;
    case 1:
      lcd.print("Current:");
      lcd.print(reading.current, 1);
      lcd.print("A");
      lcd.setCursor(0, 1);
      lcd.print(reading.currentStatus);
      break;
    case 2:
      lcd.print("MQ3:");
      lcd.print(reading.mq3);
      lcd.setCursor(0, 1);
      lcd.print(reading.mq3Status);
      break;
    case 3:
      lcd.print("Rain:");
      lcd.print(reading.rain);
      lcd.setCursor(0, 1);
      lcd.print(reading.rainStatus);
      break;
    default:
      lcd.print("Tilt:");
      if (reading.mpuOK) {
        lcd.print(reading.tilt, 1);
        lcd.print((char)223);
      } else {
        lcd.print("ERROR");
      }
      lcd.setCursor(0, 1);
      lcd.print(reading.tiltStatus);
      break;
  }
}

void updateLcd() {
  static uint32_t lastPage = 0;
  static uint8_t page = 0;
  if (!haveReading || millis() - lastPage < LCD_PAGE_INTERVAL_MS) return;
  lastPage = millis();
  showLcdPage(page);
  page = (page + 1) % 5;
}

// ------------------------------------------------------------------ setup

void setup() {
  Serial.begin(115200);

  analogReadResolution(12);

  analogSetPinAttenuation(VOLTAGE_PIN, ADC_11db);
  analogSetPinAttenuation(CURRENT_PIN, ADC_11db);
  analogSetPinAttenuation(MQ3_PIN, ADC_11db);
  analogSetPinAttenuation(RAIN_PIN, ADC_11db);

  // GPS: large RX buffer, because Telegram sends and ADC sampling block the loop
  gpsSerial.setRxBufferSize(4096);
  gpsSerial.begin(GPS_BAUD, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);

  // LCD and MPU6050 share GPIO 21 and 22
  Wire.begin(21, 22);

  lcd.init();
  lcd.backlight();

  lcd.setCursor(0, 0);
  lcd.print("ESP32 Monitor");
  lcd.setCursor(0, 1);
  lcd.print("Starting...");

  // Wake up MPU6050
  Wire.beginTransmission(0x68);
  Wire.write(0x6B);
  Wire.write(0x00);

  if (Wire.endTransmission() != 0) {
    // Keep running so the MPU fault is reported to Telegram instead of hanging
    lcd.clear();
    lcd.print("MPU6050 Error");
    Serial.println("Check MPU6050 wiring!");
    delay(1500);
  }

  // Wi-Fi (give it a few seconds, then carry on and keep retrying in loop())
  lcd.clear();
  lcd.print("Connecting WiFi");
  connectWiFi();
  uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
    delay(250);
  }

  lcd.clear();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("Wi-Fi connected, IP %s\n", WiFi.localIP().toString().c_str());
    lcd.print("WiFi Connected");
  } else {
    Serial.println("Wi-Fi not connected yet, will keep retrying");
    lcd.print("WiFi Offline");
  }
  delay(1000);
  lcd.clear();
}

// ------------------------------------------------------------------- loop

void loop() {
  static uint32_t lastSample = 0;
  static uint32_t lastReport = 0;
  static bool firstReportSent = false;

  maintainWiFi();
  feedGps();

  if (!haveReading || millis() - lastSample >= SAMPLE_INTERVAL_MS) {
    lastSample = millis();
    sampleSensors();
  }

  // Alerts go out right away, ahead of the periodic report
  flushAlerts();

  // Full data report: once at start-up, then every 30 s
  bool reportDue = !firstReportSent || millis() - lastReport >= REPORT_INTERVAL_MS;
  if (haveReading && reportDue && pendingAlerts.length() == 0 &&
      WiFi.status() == WL_CONNECTED) {
    lastReport = millis();
    firstReportSent = true;
    sendTelegram(String("PowerGuard report\n") + readingSummary());
  }

  updateLcd();
}
