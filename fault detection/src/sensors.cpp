#include "sensors.h"

#include <Arduino.h>
#include <esp_task_wdt.h>

#include <algorithm>
#include <cmath>

#include "ac_rms.h"
#include "app_state.h"
#include "config.h"
#include "debounce.h"
#include "fault_detector.h"
#include "mq135.h"

namespace sensors {

namespace {

constexpr uint32_t kAcWindowUs = static_cast<uint32_t>(AC_WINDOW_MS) * 1000UL;
constexpr uint32_t kSettleMs = 1500;      // bias capacitors charge, first windows are junk
constexpr double kRawEmaAlpha = 0.3;      // smoothing of the raw RMS used by "cal"

void configurePins() {
  analogReadResolution(12);
  for (int pin : {PIN_ZMPT_VOLTAGE, PIN_CT_CURRENT, PIN_MQ135_AO, PIN_RAIN_AO}) {
    pinMode(pin, INPUT);
    analogSetPinAttenuation(pin, ADC_11db);  // ~0-3.1 V full scale
  }
  pinMode(PIN_RAIN_POWER, OUTPUT);
  digitalWrite(PIN_RAIN_POWER, LOW);
}

// Samples both mains channels back to back for a whole number of mains cycles.
// Only RMS values are needed, so the few-microsecond skew between the channels is
// irrelevant.
void sampleAcWindow(pg::AcAccumulator& v, pg::AcAccumulator& i) {
  v.reset();
  i.reset();
  const uint32_t began = micros();
  while (static_cast<uint32_t>(micros() - began) < kAcWindowUs) {
    v.add(static_cast<int32_t>(analogReadMilliVolts(PIN_ZMPT_VOLTAGE)));
    i.add(static_cast<int32_t>(analogReadMilliVolts(PIN_CT_CURRENT)));
  }
}

double readAverageMv(int pin, int samples) {
  uint32_t sum = 0;
  for (int n = 0; n < samples; ++n) sum += analogReadMilliVolts(pin);
  return static_cast<double>(sum) / samples;
}

double readRainMv() {
  digitalWrite(PIN_RAIN_POWER, HIGH);
  delay(RAIN_SETTLE_MS);
  const double mv = readAverageMv(PIN_RAIN_AO, 8);
  digitalWrite(PIN_RAIN_POWER, LOW);
  return mv;
}

bool biasOk(const pg::AcAccumulator& a) {
  return a.mean() >= AC_BIAS_MIN_MV && a.mean() <= AC_BIAS_MAX_MV;
}

void sensorTask(void*) {
  esp_task_wdt_add(nullptr);

  pg::FaultThresholds limits;
  limits.over_voltage_v = OVER_VOLTAGE_V;
  limits.under_voltage_v = UNDER_VOLTAGE_V;
  limits.open_line_v = OPEN_LINE_V;
  limits.over_current_a = OVER_CURRENT_A;
  limits.short_a = SHORT_CURRENT_A;
  pg::FaultDetector fault(limits);

  pg::Debouncer smoke(SMOKE_ON_MS, SMOKE_OFF_MS);
  pg::Debouncer rain(RAIN_ON_MS, RAIN_OFF_MS);

  pg::Mq135Params mq;
  mq.vcc = MQ135_VCC;
  mq.rl_kohm = MQ135_RL_KOHM;
  mq.divider_ratio = MQ135_DIVIDER_RATIO;

  pg::AcAccumulator v, i;
  app::Snapshot snap;
  bool have_raw = false;
  uint32_t next_mq = 0, next_rain = 0;

  for (;;) {
    esp_task_wdt_reset();

    sampleAcWindow(v, i);
    const uint32_t now = millis();

    if (now >= kSettleMs && v.count() >= AC_MIN_SAMPLES_PER_WINDOW &&
        i.count() >= AC_MIN_SAMPLES_PER_WINDOW) {
      const pg::Calibration cal = app::calibration();

      snap.samples = static_cast<uint32_t>(v.count());
      snap.v_bias_ok = biasOk(v);
      snap.i_bias_ok = biasOk(i);

      // Smoothed raw RMS, used only by the calibration commands.
      if (!have_raw) {
        snap.v_rms_mv = v.rms();
        snap.i_rms_mv = i.rms();
        have_raw = true;
      } else {
        snap.v_rms_mv += kRawEmaAlpha * (v.rms() - snap.v_rms_mv);
        snap.i_rms_mv += kRawEmaAlpha * (i.rms() - snap.i_rms_mv);
      }

      snap.volts = pg::scaleAc(v.rms(), cal.v_noise_mv, cal.v_gain, VOLTAGE_DEADBAND_V);
      snap.amps = pg::scaleAc(i.rms(), cal.i_noise_mv, cal.i_gain, CURRENT_DEADBAND_A);

      // A CT output touching the ADC limits means a very large current; the RMS of
      // the clipped wave under-reads, so report at least a short-circuit current.
      snap.i_clipped = snap.i_bias_ok && (i.maximum() >= ADC_CLIP_HIGH_MV || i.minimum() <= ADC_CLIP_LOW_MV);
      if (snap.i_clipped) snap.amps = std::max(snap.amps, static_cast<double>(SHORT_CURRENT_A));

      // With an unplugged or railed front end the numbers are meaningless; do not
      // invent a line fault from them. Likewise, until the voltage channel has been
      // calibrated its reading is not trustworthy, so the detector sees a nominal
      // 230 V and only current-based faults (over_current, short) can trip.
      if (snap.v_bias_ok && snap.i_bias_ok) {
        const double volts_for_faults = cal.v_calibrated ? snap.volts : 230.0;
        snap.fault = fault.update(now, volts_for_faults, snap.amps);
      } else {
        fault.reset();
        snap.fault = pg::FaultType::None;
      }

      snap.updated_ms = now;
      snap.valid = true;
    }

    // MQ-135 (slow chemical sensor): once per second.
    if (static_cast<int32_t>(now - next_mq) >= 0) {
      next_mq = now + MQ135_PERIOD_MS;
      const pg::Calibration cal = app::calibration();
      snap.mq_rs_kohm = pg::mq135RsKohm(readAverageMv(PIN_MQ135_AO, 16), mq);
      const bool warm = now >= static_cast<uint32_t>(MQ135_WARMUP_S) * 1000UL;
      snap.mq_warm = warm && snap.mq_rs_kohm > 0.0;
      // Smoke sensing needs a calibrated R0; with the placeholder a clean room can read
      // as smoky. The ppm field is omitted from the payload while this is false.
      snap.smoke_ready = snap.mq_warm && cal.mq_calibrated;
      if (snap.smoke_ready) {
        snap.smoke_ppm = pg::mq135Ppm(snap.mq_rs_kohm, cal.mq_r0_kohm);
        const bool raw = pg::aboveWithHysteresis(smoke.state(), snap.smoke_ppm, SMOKE_ON_PPM, SMOKE_OFF_PPM);
        snap.smoke = smoke.update(now, raw);
      } else {
        // Never raise smoke from a cold or disconnected sensor.
        smoke.reset(false);
        snap.smoke = false;
        snap.smoke_ppm = 0.0;
      }
    }

    // Rain: the plate is powered only for the few ms of each reading.
    if (static_cast<int32_t>(now - next_rain) >= 0) {
      next_rain = now + RAIN_PERIOD_MS;
      snap.rain_mv = readRainMv();
      const bool raw = pg::belowWithHysteresis(rain.state(), snap.rain_mv, RAIN_ON_MV, RAIN_OFF_MV);
      snap.rain = rain.update(now, raw);
    }

    app::publish(snap);
    vTaskDelay(pdMS_TO_TICKS(AC_PAUSE_MS));
  }
}

}  // namespace

void start() {
  configurePins();
  xTaskCreatePinnedToCore(sensorTask, "sensors", 4096, nullptr, 2, nullptr, 1);
}

}  // namespace sensors
