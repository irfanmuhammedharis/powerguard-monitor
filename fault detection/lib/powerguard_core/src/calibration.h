#pragma once

namespace pg {

// Per-unit calibration, persisted in NVS and edited from the serial console.
//
// The defaults are only starting points: the ZMPT101B gain depends on its trim
// pot and the divider in front of the ADC, and R0 of an MQ-135 differs per
// sensor. Run the "cal ..." commands (see README) after wiring a new unit.
struct Calibration {
  // Mains voltage: volts per mV(RMS) measured at the ADC pin. The right value depends
  // on the module's trim pot and the divider, so it is unknown until "cal v" has been
  // run; until then voltage is still reported, but voltage-based faults are suppressed.
  double v_gain = 0.50;
  double v_noise_mv = 0.0;
  bool v_calibrated = false;

  // SCT-013-015: 15 A <-> 1 V RMS, so 0.015 A per mV. (Voltage-output CT with an
  // internal burden; a current-output CT such as the -000 needs an external burden.)
  double i_gain = 0.015;
  double i_noise_mv = 0.0;

  // MQ-135 R0 in kOhm. The default is only a placeholder: with it, clean air can read
  // anywhere from "fine" to "smoky". Smoke sensing therefore stays OFF until "cal mq"
  // has been run in clean air (mq_calibrated).
  double mq_r0_kohm = 76.63;
  bool mq_calibrated = false;
};

}  // namespace pg
