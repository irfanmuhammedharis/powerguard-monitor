// Host-side tests for lib/powerguard_core. Run with: pio test -e native
#include <unity.h>

#include <cmath>
#include <cstring>

#include "ac_rms.h"
#include "debounce.h"
#include "fault_detector.h"
#include "mq135.h"
#include "payload.h"

using namespace pg;

void setUp() {}
void tearDown() {}

// ---------------------------------------------------------------- AC RMS ----

static const double kPi = 3.14159265358979323846;

static AcAccumulator sine(double bias_mv, double peak_mv, int cycles, int samples_per_cycle) {
  AcAccumulator a;
  for (int i = 0; i < cycles * samples_per_cycle; ++i) {
    const double x = bias_mv + peak_mv * std::sin(2.0 * kPi * i / samples_per_cycle);
    a.add(static_cast<int32_t>(std::lround(x)));
  }
  return a;
}

void test_rms_removes_dc_bias() {
  AcAccumulator a = sine(1650.0, 700.0, 10, 400);
  TEST_ASSERT_DOUBLE_WITHIN(2.0, 700.0 / std::sqrt(2.0), a.rms());  // 494.97 mV
  TEST_ASSERT_DOUBLE_WITHIN(1.0, 1650.0, a.mean());
}

void test_rms_tracks_min_max_for_clipping_detection() {
  AcAccumulator a = sine(1650.0, 1500.0, 10, 400);
  TEST_ASSERT_INT_WITHIN(2, 3150, a.maximum());
  TEST_ASSERT_INT_WITHIN(2, 150, a.minimum());
}

void test_rms_of_empty_or_flat_signal_is_zero() {
  AcAccumulator a;
  TEST_ASSERT_EQUAL_DOUBLE(0.0, a.rms());
  a.add(1650);
  TEST_ASSERT_EQUAL_DOUBLE(0.0, a.rms());  // single sample
  for (int i = 0; i < 100; ++i) a.add(1650);
  TEST_ASSERT_EQUAL_DOUBLE(0.0, a.rms());  // flat line
}

void test_rms_reset_clears_everything() {
  AcAccumulator a = sine(1650.0, 700.0, 2, 100);
  a.reset();
  TEST_ASSERT_EQUAL_UINT32(0, a.count());
  TEST_ASSERT_EQUAL_DOUBLE(0.0, a.rms());
  TEST_ASSERT_EQUAL_INT32(0, a.maximum());
}

void test_scaleAc_applies_gain() {
  // 495 mV on the CT channel with 0.015 A/mV -> ~7.4 A.
  TEST_ASSERT_DOUBLE_WITHIN(0.01, 7.425, scaleAc(495.0, 0.0, 0.015, 0.1));
}

void test_scaleAc_subtracts_noise_in_quadrature() {
  // 3-4-5 triangle: sqrt(5^2 - 4^2) = 3.
  TEST_ASSERT_DOUBLE_WITHIN(1e-9, 3.0, scaleAc(5.0, 4.0, 1.0, 0.0));
}

void test_scaleAc_deadband_and_noise_floor_give_exact_zero() {
  TEST_ASSERT_EQUAL_DOUBLE(0.0, scaleAc(2.0, 0.0, 0.015, 0.1));    // 0.03 A < deadband
  TEST_ASSERT_EQUAL_DOUBLE(0.0, scaleAc(3.0, 4.0, 0.015, 0.1));    // below noise floor
  TEST_ASSERT_EQUAL_DOUBLE(0.0, scaleAc(-1.0, 0.0, 0.015, 0.1));
}

// -------------------------------------------------------------- Debouncer ----

void test_debouncer_needs_continuous_agreement() {
  Debouncer d(1000, 2000);
  TEST_ASSERT_FALSE(d.update(0, true));
  TEST_ASSERT_FALSE(d.update(999, true));
  TEST_ASSERT_TRUE(d.update(1000, true));
  TEST_ASSERT_TRUE(d.update(1500, false));   // clearing starts
  TEST_ASSERT_TRUE(d.update(3499, false));
  TEST_ASSERT_FALSE(d.update(3500, false));  // 2000 ms later
}

void test_debouncer_glitch_restarts_the_timer() {
  Debouncer d(1000, 1000);
  d.update(0, true);
  d.update(800, false);                      // glitch back to the stable state
  TEST_ASSERT_FALSE(d.update(1200, true));   // timer restarted at 1200
  TEST_ASSERT_FALSE(d.update(2199, true));
  TEST_ASSERT_TRUE(d.update(2200, true));
}

void test_debouncer_survives_millis_wraparound() {
  Debouncer d(1000, 1000);
  const uint32_t start = 0xFFFFFF00u;
  d.update(start, true);
  TEST_ASSERT_FALSE(d.update(start + 500u, true));
  TEST_ASSERT_TRUE(d.update(start + 1000u, true));  // wraps past 0
}

void test_debouncer_zero_delay_is_immediate() {
  Debouncer d(0, 0);
  TEST_ASSERT_TRUE(d.update(5, true));
  TEST_ASSERT_FALSE(d.update(6, false));
}

void test_hysteresis_helpers() {
  TEST_ASSERT_FALSE(aboveWithHysteresis(false, 9.9, 10.0, 9.7));
  TEST_ASSERT_TRUE(aboveWithHysteresis(false, 10.1, 10.0, 9.7));
  TEST_ASSERT_TRUE(aboveWithHysteresis(true, 9.8, 10.0, 9.7));   // still latched
  TEST_ASSERT_FALSE(aboveWithHysteresis(true, 9.6, 10.0, 9.7));
  TEST_ASSERT_TRUE(belowWithHysteresis(false, 179.0, 180.0, 185.4));
  TEST_ASSERT_TRUE(belowWithHysteresis(true, 184.0, 180.0, 185.4));
  TEST_ASSERT_FALSE(belowWithHysteresis(true, 186.0, 180.0, 185.4));
}

// ----------------------------------------------------------- FaultDetector ----

// Feeds a steady condition once per 300 ms (about the real measurement cadence).
static FaultType run(FaultDetector& f, uint32_t& t, double volts, double amps, uint32_t duration_ms) {
  FaultType last = f.type();
  for (uint32_t end = t + duration_ms; t < end; t += 300) last = f.update(t, volts, amps);
  return last;
}

void test_fault_normal_operation_stays_clear() {
  FaultDetector f;
  uint32_t t = 0;
  TEST_ASSERT_EQUAL(FaultType::None, run(f, t, 230.0, 2.0, 30000));
  TEST_ASSERT_FALSE(f.active());
}

void test_fault_over_current_needs_sustained_overload() {
  FaultDetector f;
  uint32_t t = 0;
  TEST_ASSERT_EQUAL(FaultType::None, run(f, t, 230.0, 11.0, 2000));   // inrush-length: ignored
  TEST_ASSERT_EQUAL(FaultType::None, run(f, t, 230.0, 2.0, 1000));    // back to normal
  TEST_ASSERT_EQUAL(FaultType::OverCurrent, run(f, t, 230.0, 11.0, 4000));
}

void test_fault_short_is_reported_fast_and_outranks_over_current() {
  FaultDetector f;
  uint32_t t = 0;
  TEST_ASSERT_EQUAL(FaultType::Short, run(f, t, 230.0, 15.0, 900));
  TEST_ASSERT_TRUE(f.active());
}

void test_fault_clears_only_after_staying_in_limits() {
  FaultDetector f;
  uint32_t t = 0;
  run(f, t, 230.0, 11.0, 4000);
  TEST_ASSERT_EQUAL(FaultType::OverCurrent, f.type());
  TEST_ASSERT_EQUAL(FaultType::OverCurrent, run(f, t, 230.0, 2.0, 2000));  // < clear_ms
  TEST_ASSERT_EQUAL(FaultType::None, run(f, t, 230.0, 2.0, 2000));
}

void test_fault_hysteresis_prevents_chatter_near_the_limit() {
  FaultDetector f;
  uint32_t t = 0;
  run(f, t, 230.0, 10.5, 4000);
  TEST_ASSERT_EQUAL(FaultType::OverCurrent, f.type());
  // 9.8 A is below the 10 A trip point but above the 9.7 A release point.
  TEST_ASSERT_EQUAL(FaultType::OverCurrent, run(f, t, 230.0, 9.8, 10000));
  TEST_ASSERT_EQUAL(FaultType::None, run(f, t, 230.0, 9.6, 4000));
}

void test_fault_over_and_under_voltage() {
  FaultDetector f;
  uint32_t t = 0;
  TEST_ASSERT_EQUAL(FaultType::OverVoltage, run(f, t, 270.0, 1.0, 4000));
  TEST_ASSERT_EQUAL(FaultType::None, run(f, t, 230.0, 1.0, 4000));
  TEST_ASSERT_EQUAL(FaultType::UnderVoltage, run(f, t, 150.0, 1.0, 4000));
}

void test_fault_dead_line_is_open_line_not_under_voltage() {
  FaultDetector f;
  uint32_t t = 0;
  TEST_ASSERT_EQUAL(FaultType::OpenLine, run(f, t, 0.0, 0.0, 4000));
}

void test_fault_severity_priority() {
  FaultDetector f;
  uint32_t t = 0;
  // Over-voltage and over-current together: over_current is reported first.
  TEST_ASSERT_EQUAL(FaultType::OverCurrent, run(f, t, 270.0, 11.0, 4000));
}

void test_fault_reset() {
  FaultDetector f;
  uint32_t t = 0;
  run(f, t, 230.0, 15.0, 2000);
  f.reset();
  TEST_ASSERT_EQUAL(FaultType::None, f.type());
}

void test_fault_type_names_match_the_contract() {
  TEST_ASSERT_EQUAL_STRING("none", faultTypeName(FaultType::None));
  TEST_ASSERT_EQUAL_STRING("over_current", faultTypeName(FaultType::OverCurrent));
  TEST_ASSERT_EQUAL_STRING("under_voltage", faultTypeName(FaultType::UnderVoltage));
  TEST_ASSERT_EQUAL_STRING("over_voltage", faultTypeName(FaultType::OverVoltage));
  TEST_ASSERT_EQUAL_STRING("open_line", faultTypeName(FaultType::OpenLine));
  TEST_ASSERT_EQUAL_STRING("short", faultTypeName(FaultType::Short));
}

// ------------------------------------------------------------------ MQ-135 ----

void test_mq135_rs_from_adc_voltage() {
  Mq135Params p;  // 5 V, RL 10k, divider 1.5
  // ADC sees 1000 mV -> sensor AO is 1.5 V -> Rs = 10 * (5 - 1.5) / 1.5.
  TEST_ASSERT_DOUBLE_WITHIN(1e-6, 23.3333333, mq135RsKohm(1000.0, p));
}

void test_mq135_rejects_railed_readings() {
  Mq135Params p;
  TEST_ASSERT_TRUE(mq135RsKohm(0.0, p) < 0.0);       // sensor unplugged / shorted to GND
  TEST_ASSERT_TRUE(mq135RsKohm(3400.0, p) < 0.0);    // AO at VCC
}

void test_mq135_clean_air_calibration_reads_400ppm() {
  const double rs = 23.3;
  const double r0 = mq135R0FromCleanAir(rs);
  TEST_ASSERT_DOUBLE_WITHIN(0.5, 400.0, mq135Ppm(rs, r0));
}

void test_mq135_ppm_rises_as_resistance_falls() {
  const double r0 = 36.0;
  const double clean = mq135Ppm(23.0, r0);
  const double smoky = mq135Ppm(8.0, r0);
  TEST_ASSERT_TRUE(smoky > clean * 4.0);
}

void test_mq135_ppm_is_clamped_and_safe() {
  TEST_ASSERT_EQUAL_DOUBLE(0.0, mq135Ppm(-1.0, 10.0));
  TEST_ASSERT_EQUAL_DOUBLE(0.0, mq135Ppm(10.0, 0.0));
  TEST_ASSERT_EQUAL_DOUBLE(10000.0, mq135Ppm(0.01, 50.0));
}

// ------------------------------------------------------------------ Payload ----

static LiveSample healthy() {
  LiveSample s;
  s.has_smoke_ppm = true;
  s.smoke_ppm = 412.0;
  s.voltage = 230.44;
  s.current = 1.824;
  s.ts = 1760000000;
  return s;
}

void test_live_json_matches_the_documented_example() {
  char buf[256];
  const size_t n = buildLiveJson(buf, sizeof(buf), healthy());
  TEST_ASSERT_EQUAL_STRING(
      "{\"line_fault\":false,\"fault_type\":\"none\",\"rain\":false,\"smoke\":false,"
      "\"smoke_ppm\":412,\"voltage\":230.4,\"current\":1.82,\"ts\":1760000000}",
      buf);
  TEST_ASSERT_EQUAL_UINT32(std::strlen(buf), n);
}

void test_live_json_fault_smoke_and_rain() {
  char buf[256];
  LiveSample s = healthy();
  s.line_fault = true;
  s.fault_type = FaultType::OverCurrent;
  s.smoke = true;
  s.rain = true;
  s.current = 12.5;
  buildLiveJson(buf, sizeof(buf), s);
  TEST_ASSERT_NOT_NULL(std::strstr(buf, "\"line_fault\":true,\"fault_type\":\"over_current\""));
  TEST_ASSERT_NOT_NULL(std::strstr(buf, "\"rain\":true,\"smoke\":true"));
  TEST_ASSERT_NOT_NULL(std::strstr(buf, "\"current\":12.50"));
}

void test_live_json_forces_fault_type_none_when_no_fault() {
  char buf[256];
  LiveSample s = healthy();
  s.line_fault = false;
  s.fault_type = FaultType::Short;  // inconsistent input must not leak out
  buildLiveJson(buf, sizeof(buf), s);
  TEST_ASSERT_NOT_NULL(std::strstr(buf, "\"line_fault\":false,\"fault_type\":\"none\""));
}

void test_live_json_omits_smoke_ppm_during_warmup() {
  char buf[256];
  LiveSample s = healthy();
  s.has_smoke_ppm = false;
  buildLiveJson(buf, sizeof(buf), s);
  TEST_ASSERT_NULL(std::strstr(buf, "smoke_ppm"));
  TEST_ASSERT_NOT_NULL(std::strstr(buf, "\"smoke\":false,\"voltage\":230.4"));
}

void test_live_json_never_emits_nan_or_negative_current() {
  char buf[256];
  LiveSample s = healthy();
  s.voltage = std::nan("");
  s.current = -0.5;
  s.smoke_ppm = INFINITY;
  buildLiveJson(buf, sizeof(buf), s);
  TEST_ASSERT_NULL(std::strstr(buf, "nan"));
  TEST_ASSERT_NULL(std::strstr(buf, "inf"));
  TEST_ASSERT_NOT_NULL(std::strstr(buf, "\"voltage\":0.0,\"current\":0.00"));
  TEST_ASSERT_NOT_NULL(std::strstr(buf, "\"smoke_ppm\":0,"));
}

void test_live_json_reports_truncation_as_zero() {
  char small[40];
  TEST_ASSERT_EQUAL_UINT32(0, buildLiveJson(small, sizeof(small), healthy()));
  TEST_ASSERT_EQUAL_UINT32(0, buildLiveJson(nullptr, 100, healthy()));
  TEST_ASSERT_EQUAL_UINT32(0, buildLiveJson(small, 0, healthy()));
}

void test_status_json_variants() {
  char buf[96];
  buildStatusJson(buf, sizeof(buf), true, 0, -61);
  TEST_ASSERT_EQUAL_STRING("{\"last_seen\":{\".sv\":\"timestamp\"},\"rssi\":-61}", buf);
  buildStatusJson(buf, sizeof(buf), false, 1760000000, -61);
  TEST_ASSERT_EQUAL_STRING("{\"last_seen\":1760000000,\"rssi\":-61}", buf);
  buildStatusJson(buf, sizeof(buf), false, 1760000000, 0);
  TEST_ASSERT_EQUAL_STRING("{\"last_seen\":1760000000}", buf);
  char tiny[8];
  TEST_ASSERT_EQUAL_UINT32(0, buildStatusJson(tiny, sizeof(tiny), true, 0, -61));
}

void test_history_ring_buffer_slots() {
  char key[5];
  historyKey(key, 0);
  TEST_ASSERT_EQUAL_STRING("0000", key);
  historyKey(key, 9);
  TEST_ASSERT_EQUAL_STRING("0000", key);        // same 10 s bucket
  historyKey(key, 10);
  TEST_ASSERT_EQUAL_STRING("0001", key);
  historyKey(key, 86399);
  TEST_ASSERT_EQUAL_STRING("8639", key);        // last slot of the 24 h cycle
  historyKey(key, 86400);
  TEST_ASSERT_EQUAL_STRING("0000", key);        // wraps and overwrites the oldest
  historyKey(key, 1760000000);
  TEST_ASSERT_EQUAL_STRING("3200", key);
  historyKey(key, -5);
  TEST_ASSERT_EQUAL_STRING("0000", key);
}

void test_history_slots_stay_in_range_for_far_future_timestamps() {
  for (int64_t ts = 1700000000; ts < 1700000000 + 200000; ts += 7) {
    TEST_ASSERT_TRUE(historySlot(ts) < kHistorySlots);
  }
}

// ---- Added in the 2026-10-15 evaluation: robustness of the fixed 200 ms window ----

// The window is time-bound (200 ms), not zero-crossing-bound, so a grid that is off
// 50 Hz measures a fractional number of cycles. Quantified: <0.8 % over 47-52 Hz.
void test_rms_error_stays_small_when_mains_frequency_drifts() {
  const double truth = 700.0 / std::sqrt(2.0);
  const double freqs[] = {47.0, 49.0, 49.5, 50.5, 51.0, 52.0};
  for (double f : freqs) {
    for (int phase = 0; phase < 8; ++phase) {
      AcAccumulator a;
      const int n = 2000;  // 200 ms at 10 kHz per channel
      for (int i = 0; i < n; ++i) {
        const double x = 1650.0 + 700.0 * std::sin(2.0 * kPi * f * i / 10000.0 + phase * kPi / 4.0);
        a.add(static_cast<int32_t>(std::lround(x)));
      }
      TEST_ASSERT_DOUBLE_WITHIN(truth * 0.01, truth, a.rms());
    }
  }
}

// 12-bit ADC noise (~3 mV rms) is removed in quadrature by the stored noise floor.
void test_noise_floor_subtraction_recovers_the_signal() {
  const double signal_mv = 495.0, noise_mv = 3.0;
  const double measured = std::sqrt(signal_mv * signal_mv + noise_mv * noise_mv);
  const double gain = 230.0 / signal_mv;
  TEST_ASSERT_DOUBLE_WITHIN(0.05, 230.0, scaleAc(measured, noise_mv, gain, 15.0));
}

// Measurement cadence is 200 ms window + 100 ms pause. A 400 ms short debounce means a
// short must span two consecutive windows; this pins down that behaviour.
void test_short_pulse_shorter_than_the_debounce_is_ignored() {
  FaultDetector d;
  uint32_t t = 0;
  FaultType last = FaultType::None;
  for (int w = 0; w < 6; ++w, t += 300) last = d.update(t, 230.0, w == 2 ? 20.0 : 2.0);  // one window
  TEST_ASSERT_EQUAL(static_cast<int>(FaultType::None), static_cast<int>(last));
}

// Characterisation: with a 300 ms window cadence the 400 ms short debounce is quantised
// up, so a short is reported on the THIRD over-limit window (600 ms after the first).
void test_sustained_short_is_reported_on_the_third_window() {
  FaultDetector d;
  uint32_t t = 0;
  d.update(t, 230.0, 2.0);
  t += 300;
  d.update(t, 230.0, 20.0);
  t += 300;
  TEST_ASSERT_EQUAL(static_cast<int>(FaultType::None), static_cast<int>(d.update(t, 230.0, 20.0)));
  t += 300;
  TEST_ASSERT_EQUAL(static_cast<int>(FaultType::Short), static_cast<int>(d.update(t, 230.0, 20.0)));
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_rms_removes_dc_bias);
  RUN_TEST(test_rms_tracks_min_max_for_clipping_detection);
  RUN_TEST(test_rms_of_empty_or_flat_signal_is_zero);
  RUN_TEST(test_rms_reset_clears_everything);
  RUN_TEST(test_scaleAc_applies_gain);
  RUN_TEST(test_scaleAc_subtracts_noise_in_quadrature);
  RUN_TEST(test_scaleAc_deadband_and_noise_floor_give_exact_zero);
  RUN_TEST(test_debouncer_needs_continuous_agreement);
  RUN_TEST(test_debouncer_glitch_restarts_the_timer);
  RUN_TEST(test_debouncer_survives_millis_wraparound);
  RUN_TEST(test_debouncer_zero_delay_is_immediate);
  RUN_TEST(test_hysteresis_helpers);
  RUN_TEST(test_fault_normal_operation_stays_clear);
  RUN_TEST(test_fault_over_current_needs_sustained_overload);
  RUN_TEST(test_fault_short_is_reported_fast_and_outranks_over_current);
  RUN_TEST(test_fault_clears_only_after_staying_in_limits);
  RUN_TEST(test_fault_hysteresis_prevents_chatter_near_the_limit);
  RUN_TEST(test_fault_over_and_under_voltage);
  RUN_TEST(test_fault_dead_line_is_open_line_not_under_voltage);
  RUN_TEST(test_fault_severity_priority);
  RUN_TEST(test_fault_reset);
  RUN_TEST(test_fault_type_names_match_the_contract);
  RUN_TEST(test_mq135_rs_from_adc_voltage);
  RUN_TEST(test_mq135_rejects_railed_readings);
  RUN_TEST(test_mq135_clean_air_calibration_reads_400ppm);
  RUN_TEST(test_mq135_ppm_rises_as_resistance_falls);
  RUN_TEST(test_mq135_ppm_is_clamped_and_safe);
  RUN_TEST(test_live_json_matches_the_documented_example);
  RUN_TEST(test_live_json_fault_smoke_and_rain);
  RUN_TEST(test_live_json_forces_fault_type_none_when_no_fault);
  RUN_TEST(test_live_json_omits_smoke_ppm_during_warmup);
  RUN_TEST(test_live_json_never_emits_nan_or_negative_current);
  RUN_TEST(test_live_json_reports_truncation_as_zero);
  RUN_TEST(test_status_json_variants);
  RUN_TEST(test_history_ring_buffer_slots);
  RUN_TEST(test_history_slots_stay_in_range_for_far_future_timestamps);
  RUN_TEST(test_rms_error_stays_small_when_mains_frequency_drifts);
  RUN_TEST(test_noise_floor_subtraction_recovers_the_signal);
  RUN_TEST(test_short_pulse_shorter_than_the_debounce_is_ignored);
  RUN_TEST(test_sustained_short_is_reported_on_the_third_window);
  return UNITY_END();
}
