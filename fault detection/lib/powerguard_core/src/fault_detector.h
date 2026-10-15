#pragma once
#include <cstdint>

#include "debounce.h"

namespace pg {

// Values match the app's data contract (powerguard-docs/03-data-model.md).
enum class FaultType : uint8_t {
  None = 0,
  OverCurrent,
  UnderVoltage,
  OverVoltage,
  OpenLine,
  Short,
};

const char* faultTypeName(FaultType type);  // "none", "over_current", ...

struct FaultThresholds {
  double over_voltage_v = 260.0;   // app default voltage window is 180-260 V
  double under_voltage_v = 180.0;
  double open_line_v = 50.0;       // below this the line is treated as dead
  double over_current_a = 10.0;    // app default current limit
  double short_a = 14.0;           // near the SCT-013-015 full scale (15 A)
  double hysteresis = 0.03;        // 3 % release margin once a fault is latched

  uint32_t short_on_ms = 400;      // short circuits must be reported fast
  uint32_t over_current_on_ms = 3000;  // ride through motor inrush
  uint32_t voltage_on_ms = 3000;   // ride through brief sags/spikes
  uint32_t open_line_on_ms = 3000;
  uint32_t clear_ms = 3000;        // a fault clears after this long in-limits
};

// Classifies the monitored line from RMS voltage and current.
//
// There is no dedicated "fault" sensor on the unit: faults are derived from the
// two electrical measurements. Each condition is debounced independently (so a
// brief inrush does not trip over_current) and the reported type is the most
// severe active one: short > over_current > over_voltage > open_line >
// under_voltage.
class FaultDetector {
 public:
  explicit FaultDetector(const FaultThresholds& thresholds = FaultThresholds());

  // Call once per measurement window with trusted readings.
  FaultType update(uint32_t now_ms, double volts, double amps);

  FaultType type() const { return type_; }
  bool active() const { return type_ != FaultType::None; }
  void reset();

 private:
  enum Condition { kShort, kOverCurrent, kOverVoltage, kOpenLine, kUnderVoltage, kCount };

  FaultThresholds t_;
  Debouncer cond_[kCount];
  FaultType type_ = FaultType::None;
};

}  // namespace pg
