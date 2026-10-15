#pragma once

namespace pg {

// MQ-135 electrical model.
//
// The module's AO pin is a divider between the sensing element Rs and the load
// resistor RL, supplied from VCC (5 V, needed for the heater). AO can reach ~5 V,
// so it must be divided down before the 3.3 V ESP32 ADC; `divider_ratio` is
// (V at sensor AO) / (V at ADC pin), e.g. 1.5 for a 10k/20k divider.
struct Mq135Params {
  double vcc = 5.0;
  double rl_kohm = 10.0;        // RL on the module: SMD marked "103" = 10k, "102" = 1k
  double divider_ratio = 1.5;
};

// Sensing-element resistance in kOhm from the voltage at the ADC pin (mV).
// Returns a negative value when the reading is outside the physically valid
// range (sensor unplugged / shorted).
double mq135RsKohm(double adc_mv, const Mq135Params& p);

// CO2-equivalent ppm from the Rs/R0 ratio (datasheet curve fit, a=116.602,
// b=2.769). The MQ-135 reacts to NH3, NOx, alcohol, benzene, smoke and CO2
// alike, so this is an *index* of air contamination, not a calibrated smoke
// concentration. Clean air reads ~400 after calibration. Clamped to 0..10000.
double mq135Ppm(double rs_kohm, double r0_kohm);

// R0 such that mq135Ppm(rs, r0) == 400 (outdoor CO2) for a clean-air Rs.
double mq135R0FromCleanAir(double rs_kohm);

}  // namespace pg
