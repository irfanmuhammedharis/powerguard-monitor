#pragma once
#include <Arduino.h>

#include "calibration.h"
#include "fault_detector.h"

// State shared between the sensor task (core 1), the cloud task (core 0) and the
// main loop (serial console). Everything goes through one mutex; readers get copies.
namespace app {

struct Snapshot {
  bool valid = false;           // at least one complete measurement window
  uint32_t updated_ms = 0;      // millis() of the last window

  double volts = 0.0;           // mains RMS, V
  double amps = 0.0;            // load RMS, A
  double v_rms_mv = 0.0;        // raw AC RMS at the ADC pin, smoothed (for "cal")
  double i_rms_mv = 0.0;
  bool v_bias_ok = false;       // front end biased near mid-rail (connected, not railed)
  bool i_bias_ok = false;
  bool i_clipped = false;
  uint32_t samples = 0;         // ADC samples per channel in the last window

  pg::FaultType fault = pg::FaultType::None;

  bool smoke = false;
  bool mq_warm = false;         // MQ-135 warmed up and reading a valid Rs
  bool smoke_ready = false;     // ... and R0 calibrated: smoke sensing is active
  double smoke_ppm = 0.0;
  double mq_rs_kohm = -1.0;

  bool rain = false;
  double rain_mv = 0.0;
};

struct NetStatus {
  bool wifi = false;
  int rssi = 0;
  bool time_ok = false;
  bool signed_in = false;
  uint32_t last_ok_ms = 0;      // millis() of the last successful /live write
  uint32_t live_ok = 0;
  uint32_t live_fail = 0;
  uint32_t history_ok = 0;
  int last_http = 0;
  char uid[48] = "";            // Firebase uid of this unit (for /config/writers)
};

void init(const pg::Calibration& cal);

Snapshot snapshot();
void publish(const Snapshot& s);

NetStatus net();
template <typename Fn>
void updateNet(Fn fn);

pg::Calibration calibration();
void setCalibration(const pg::Calibration& cal);

namespace detail {
void lock();
void unlock();
NetStatus& netRef();
}  // namespace detail

template <typename Fn>
void updateNet(Fn fn) {
  detail::lock();
  fn(detail::netRef());
  detail::unlock();
}

}  // namespace app
