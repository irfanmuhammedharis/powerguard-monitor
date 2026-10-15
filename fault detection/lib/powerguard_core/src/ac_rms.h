#pragma once
#include <cstddef>
#include <cstdint>

namespace pg {

// Streaming statistics for one AC channel over a sampling window.
//
// ZMPT101B and SCT-013 front ends ride on a DC bias (about half the ADC range),
// so the accumulator removes the mean and reports the RMS of the AC component
// only. Samples are integer millivolts: sums stay exact in 64 bits and the hot
// sampling loop needs no floating point (the ESP32 FPU is single precision).
class AcAccumulator {
 public:
  void reset();
  void add(int32_t millivolts);

  size_t count() const { return n_; }
  double mean() const;     // DC bias estimate, mV
  double rms() const;      // AC RMS, mV
  int32_t minimum() const { return n_ ? min_ : 0; }
  int32_t maximum() const { return n_ ? max_ : 0; }

 private:
  size_t n_ = 0;
  int64_t sum_ = 0;
  int64_t sum_sq_ = 0;
  int32_t min_ = 0;
  int32_t max_ = 0;
};

// Converts a raw AC RMS at the ADC pin (mV) to engineering units.
//   result = gain * sqrt(rms^2 - noise^2)
// `noise_mv` is the RMS the channel reads with nothing connected (measured by
// the "cal vzero"/"cal izero" commands); subtracting it in quadrature removes
// the ADC noise floor. Results below `deadband` are reported as exactly zero so
// an idle line does not show phantom readings.
double scaleAc(double rms_mv, double noise_mv, double gain, double deadband);

}  // namespace pg
