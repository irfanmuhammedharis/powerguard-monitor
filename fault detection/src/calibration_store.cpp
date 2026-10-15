#include "calibration_store.h"

#include <Preferences.h>

#include <cmath>

namespace {
constexpr const char* kNamespace = "pg";

// A corrupt NVS value (NaN, zero, negative) must never reach the measurement path.
double sane(double value, double fallback, double min_exclusive) {
  return (std::isfinite(value) && value > min_exclusive) ? value : fallback;
}
}  // namespace

pg::Calibration loadCalibration() {
  const pg::Calibration def;
  pg::Calibration c;
  Preferences prefs;
  if (!prefs.begin(kNamespace, /*readOnly=*/true)) return def;
  c.v_gain = sane(prefs.getDouble("v_gain", def.v_gain), def.v_gain, 0.0);
  c.v_noise_mv = sane(prefs.getDouble("v_noise", def.v_noise_mv), def.v_noise_mv, -1.0);
  c.i_gain = sane(prefs.getDouble("i_gain", def.i_gain), def.i_gain, 0.0);
  c.i_noise_mv = sane(prefs.getDouble("i_noise", def.i_noise_mv), def.i_noise_mv, -1.0);
  c.v_calibrated = prefs.getBool("v_cal", def.v_calibrated);
  c.mq_r0_kohm = sane(prefs.getDouble("mq_r0", def.mq_r0_kohm), def.mq_r0_kohm, 0.0);
  c.mq_calibrated = prefs.getBool("mq_cal", def.mq_calibrated);
  prefs.end();
  return c;
}

void saveCalibration(const pg::Calibration& c) {
  Preferences prefs;
  if (!prefs.begin(kNamespace, /*readOnly=*/false)) return;
  prefs.putDouble("v_gain", c.v_gain);
  prefs.putDouble("v_noise", c.v_noise_mv);
  prefs.putDouble("i_gain", c.i_gain);
  prefs.putDouble("i_noise", c.i_noise_mv);
  prefs.putBool("v_cal", c.v_calibrated);
  prefs.putDouble("mq_r0", c.mq_r0_kohm);
  prefs.putBool("mq_cal", c.mq_calibrated);
  prefs.end();
}

void clearCalibration() {
  Preferences prefs;
  if (!prefs.begin(kNamespace, /*readOnly=*/false)) return;
  prefs.clear();
  prefs.end();
}
