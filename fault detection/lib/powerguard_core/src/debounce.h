#pragma once
#include <cstdint>

namespace pg {

// Turns a noisy boolean into a stable one: the output only flips after the raw
// input has disagreed with it continuously for `on_ms` (to become true) or
// `off_ms` (to become false). Time is passed in, so it is testable and immune to
// millis() wrap-around (unsigned subtraction).
class Debouncer {
 public:
  explicit Debouncer(uint32_t on_ms = 0, uint32_t off_ms = 0) : on_ms_(on_ms), off_ms_(off_ms) {}

  bool update(uint32_t now_ms, bool raw) {
    if (raw == state_) {
      pending_ = false;
    } else {
      if (!pending_) {
        pending_ = true;
        since_ms_ = now_ms;
      }
      if (static_cast<uint32_t>(now_ms - since_ms_) >= (raw ? on_ms_ : off_ms_)) {
        state_ = raw;
        pending_ = false;
      }
    }
    return state_;
  }

  bool state() const { return state_; }
  void reset(bool state = false) {
    state_ = state;
    pending_ = false;
  }

 private:
  uint32_t on_ms_;
  uint32_t off_ms_;
  uint32_t since_ms_ = 0;
  bool state_ = false;
  bool pending_ = false;
};

// Schmitt-trigger comparisons. `active` is the current debounced state: while
// active the (more lenient) release threshold applies, which stops a reading that
// hovers around a limit from chattering.
inline bool aboveWithHysteresis(bool active, double value, double trip, double release) {
  return active ? value > release : value > trip;
}
inline bool belowWithHysteresis(bool active, double value, double trip, double release) {
  return active ? value < release : value < trip;
}

}  // namespace pg
