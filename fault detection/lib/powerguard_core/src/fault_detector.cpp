#include "fault_detector.h"

namespace pg {

const char* faultTypeName(FaultType type) {
  switch (type) {
    case FaultType::OverCurrent:  return "over_current";
    case FaultType::UnderVoltage: return "under_voltage";
    case FaultType::OverVoltage:  return "over_voltage";
    case FaultType::OpenLine:     return "open_line";
    case FaultType::Short:        return "short";
    case FaultType::None:
    default:                      return "none";
  }
}

FaultDetector::FaultDetector(const FaultThresholds& thresholds) : t_(thresholds) {
  cond_[kShort] = Debouncer(t_.short_on_ms, t_.clear_ms);
  cond_[kOverCurrent] = Debouncer(t_.over_current_on_ms, t_.clear_ms);
  cond_[kOverVoltage] = Debouncer(t_.voltage_on_ms, t_.clear_ms);
  cond_[kOpenLine] = Debouncer(t_.open_line_on_ms, t_.clear_ms);
  cond_[kUnderVoltage] = Debouncer(t_.voltage_on_ms, t_.clear_ms);
}

void FaultDetector::reset() {
  for (auto& c : cond_) c.reset();
  type_ = FaultType::None;
}

FaultType FaultDetector::update(uint32_t now_ms, double volts, double amps) {
  const double h = t_.hysteresis;

  cond_[kShort].update(now_ms, aboveWithHysteresis(cond_[kShort].state(), amps, t_.short_a,
                                                    t_.short_a * (1.0 - h)));
  cond_[kOverCurrent].update(now_ms, aboveWithHysteresis(cond_[kOverCurrent].state(), amps,
                                                          t_.over_current_a,
                                                          t_.over_current_a * (1.0 - h)));
  cond_[kOverVoltage].update(now_ms, aboveWithHysteresis(cond_[kOverVoltage].state(), volts,
                                                          t_.over_voltage_v,
                                                          t_.over_voltage_v * (1.0 - h)));
  cond_[kOpenLine].update(now_ms, belowWithHysteresis(cond_[kOpenLine].state(), volts,
                                                       t_.open_line_v, t_.open_line_v * (1.0 + h)));
  cond_[kUnderVoltage].update(now_ms, belowWithHysteresis(cond_[kUnderVoltage].state(), volts,
                                                           t_.under_voltage_v,
                                                           t_.under_voltage_v * (1.0 + h)));

  if (cond_[kShort].state()) {
    type_ = FaultType::Short;
  } else if (cond_[kOverCurrent].state()) {
    type_ = FaultType::OverCurrent;
  } else if (cond_[kOverVoltage].state()) {
    type_ = FaultType::OverVoltage;
  } else if (cond_[kOpenLine].state()) {
    type_ = FaultType::OpenLine;
  } else if (cond_[kUnderVoltage].state()) {
    type_ = FaultType::UnderVoltage;
  } else {
    type_ = FaultType::None;
  }
  return type_;
}

}  // namespace pg
