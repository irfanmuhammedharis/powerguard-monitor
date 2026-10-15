#include "mq135.h"

#include <cmath>

namespace pg {

namespace {
constexpr double kParA = 116.6020682;
constexpr double kParB = 2.769034857;
constexpr double kCleanAirPpm = 400.0;
constexpr double kMaxPpm = 10000.0;
}  // namespace

double mq135RsKohm(double adc_mv, const Mq135Params& p) {
  const double vout = adc_mv / 1000.0 * p.divider_ratio;
  // Guard the division and reject readings pinned at either rail.
  if (!(vout > 0.02) || !(vout < p.vcc - 0.02)) return -1.0;
  return p.rl_kohm * (p.vcc - vout) / vout;
}

double mq135Ppm(double rs_kohm, double r0_kohm) {
  if (!(rs_kohm > 0.0) || !(r0_kohm > 0.0)) return 0.0;
  const double ppm = kParA * std::pow(rs_kohm / r0_kohm, -kParB);
  if (!(ppm > 0.0)) return 0.0;
  return ppm > kMaxPpm ? kMaxPpm : ppm;
}

double mq135R0FromCleanAir(double rs_kohm) {
  return rs_kohm * std::pow(kCleanAirPpm / kParA, 1.0 / kParB);
}

}  // namespace pg
