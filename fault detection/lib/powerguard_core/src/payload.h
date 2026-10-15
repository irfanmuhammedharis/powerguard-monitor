#pragma once
#include <cstddef>
#include <cstdint>

#include "fault_detector.h"

namespace pg {

// One reading as written to /devices/{id}/live and /devices/{id}/history/{slot}.
// Field names and types are the firmware <-> app contract
// (powerguard-docs/03-data-model.md); the RTDB rules reject anything else.
struct LiveSample {
  bool line_fault = false;
  FaultType fault_type = FaultType::None;
  bool rain = false;
  bool smoke = false;
  bool has_smoke_ppm = false;  // false while the MQ-135 is warming up
  double smoke_ppm = 0.0;
  double voltage = 0.0;        // V RMS
  double current = 0.0;        // A RMS
  int64_t ts = 0;              // unix seconds
};

// The history ring buffer holds exactly 24 h at one sample per 10 s (ADR-0008).
constexpr uint32_t kHistorySlots = 8640;
constexpr uint32_t kHistoryIntervalS = 10;

// Each builder writes a NUL-terminated JSON object into `buf` and returns its
// length, or 0 if `cap` is too small. Non-finite numbers are written as 0 so the
// output is always valid JSON.
size_t buildLiveJson(char* buf, size_t cap, const LiveSample& s);

// last_seen is either the Firebase server clock ({".sv":"timestamp"}, immune to a
// wrong ESP32 clock, value arrives in milliseconds) or the local unix seconds.
// `rssi_dbm` is omitted when 0 (not connected).
size_t buildStatusJson(char* buf, size_t cap, bool use_server_timestamp, int64_t now_s, int rssi_dbm);

// Ring-buffer slot for a timestamp: 0..8639, one slot per 10 s, wrapping every 24 h.
uint32_t historySlot(int64_t ts);

// Writes the 4-digit zero-padded slot key ("0000".."8639") plus NUL into `out[5]`.
void historyKey(char out[5], int64_t ts);

}  // namespace pg
