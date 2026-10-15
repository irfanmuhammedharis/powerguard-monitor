// PowerGuard field unit.
//
// Measures mains voltage (ZMPT101B), load current (SCT-013-015), air contamination
// (MQ-135) and rain, derives line faults, and publishes it to Firebase Realtime
// Database for the PowerGuard Monitor app.
//
//   core 1  sensors task   ADC sampling + fault/smoke/rain decisions  (src/sensors.cpp)
//   core 0  cloud task     Wi-Fi, NTP, Firebase auth + uploads         (src/cloud.cpp)
//   loop()  serial console, status LED
#include <Arduino.h>
#include <esp_task_wdt.h>

#include "app_state.h"
#include "calibration_store.h"
#include "cli.h"
#include "cloud.h"
#include "config.h"
#include "device_config.h"
#include "sensors.h"

namespace {

void updateLed() {
  const app::Snapshot s = app::snapshot();
  const app::NetStatus n = app::net();
  const uint32_t now = millis();
  const bool cloud_ok = n.last_ok_ms != 0 && now - n.last_ok_ms < 3UL * LIVE_INTERVAL_MS + 2000;

  bool on;
  if (s.fault != pg::FaultType::None || s.smoke) {
    on = (now / 100) % 2 == 0;   // fast blink (5 Hz): something needs attention
  } else if (!cloud_ok) {
    on = (now / 500) % 2 == 0;   // slow blink (1 Hz): not reaching the cloud
  } else {
    on = true;                   // steady: healthy and online
  }
  digitalWrite(PIN_STATUS_LED, on ? HIGH : LOW);
}

}  // namespace

void setup() {
  Serial.begin(SERIAL_BAUD);
  delay(300);
  Serial.println("\n=== PowerGuard field unit ===");
  Serial.printf("device id: %s | window %d ms | type \"help\" for the console\n", DEVICE_ID, AC_WINDOW_MS);

  pinMode(PIN_STATUS_LED, OUTPUT);

  const pg::Calibration cal = loadCalibration();
  app::init(cal);
  if (!cal.v_calibrated) {
    Serial.println("note: voltage is UNCALIBRATED - voltage-based faults are off until \"cal v <volts>\".");
  }
  if (!cal.mq_calibrated) {
    Serial.printf("note: smoke sensing is OFF until \"cal mq\" (after %d s warm-up, in clean air).\n", MQ135_WARMUP_S);
  }

  // The Arduino core arms a 5 s task watchdog; blocking network calls need longer.
  const esp_err_t deinit = esp_task_wdt_deinit();
  const esp_err_t init = esp_task_wdt_init(WDT_TIMEOUT_S, /*panic=*/true);
  if (deinit != ESP_OK || init != ESP_OK) {
    Serial.printf("warning: watchdog reconfigure returned %d/%d - the default 5 s timeout may apply\n", deinit, init);
  }

  sensors::start();
  cloud::start();
}

void loop() {
  static uint32_t next_summary = 0;

  cli::poll();
  updateLed();

  const uint32_t now = millis();
  if (static_cast<int32_t>(now - next_summary) >= 0) {
    next_summary = now + 5000;
    if (cli::verbose()) cli::printSummary();

    // TLS needs ~40 KB. If memory stays this low (fragmentation or a leak) the unit
    // would silently stop uploading, so restart instead of limping.
    static uint8_t low_heap_checks = 0;
    low_heap_checks = ESP.getFreeHeap() < MIN_FREE_HEAP_BYTES ? low_heap_checks + 1 : 0;
    if (low_heap_checks >= 3) {
      Serial.printf("free heap %u B stayed below %u B - restarting\n", static_cast<unsigned>(ESP.getFreeHeap()),
                    static_cast<unsigned>(MIN_FREE_HEAP_BYTES));
      Serial.flush();
      ESP.restart();
    }
  }
  delay(20);
}
