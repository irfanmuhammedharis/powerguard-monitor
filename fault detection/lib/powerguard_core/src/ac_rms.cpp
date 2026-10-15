#include "ac_rms.h"

#include <cmath>

namespace pg {

void AcAccumulator::reset() {
  n_ = 0;
  sum_ = 0;
  sum_sq_ = 0;
  min_ = 0;
  max_ = 0;
}

void AcAccumulator::add(int32_t millivolts) {
  if (n_ == 0) {
    min_ = max_ = millivolts;
  } else {
    if (millivolts < min_) min_ = millivolts;
    if (millivolts > max_) max_ = millivolts;
  }
  ++n_;
  sum_ += millivolts;
  sum_sq_ += static_cast<int64_t>(millivolts) * millivolts;
}

double AcAccumulator::mean() const {
  return n_ ? static_cast<double>(sum_) / static_cast<double>(n_) : 0.0;
}

double AcAccumulator::rms() const {
  if (n_ < 2) return 0.0;
  const double n = static_cast<double>(n_);
  const double mu = static_cast<double>(sum_) / n;
  const double variance = static_cast<double>(sum_sq_) / n - mu * mu;
  return variance > 0.0 ? std::sqrt(variance) : 0.0;
}

double scaleAc(double rms_mv, double noise_mv, double gain, double deadband) {
  const double clean = rms_mv * rms_mv - noise_mv * noise_mv;
  if (!(clean > 0.0)) return 0.0;
  const double value = gain * std::sqrt(clean);
  return value < deadband ? 0.0 : value;
}

}  // namespace pg
