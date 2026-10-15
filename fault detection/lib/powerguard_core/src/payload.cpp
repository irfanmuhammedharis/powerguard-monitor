#include "payload.h"

#include <cmath>
#include <cstdio>

namespace pg {

namespace {

double finiteOrZero(double v) { return std::isfinite(v) ? v : 0.0; }

// snprintf returns the would-be length; anything >= cap means truncation.
size_t finish(int written, size_t cap) {
  return (written > 0 && static_cast<size_t>(written) < cap) ? static_cast<size_t>(written) : 0;
}

}  // namespace

size_t buildLiveJson(char* buf, size_t cap, const LiveSample& s) {
  if (!buf || cap == 0) return 0;

  // smoke_ppm is optional in the contract; omit it rather than send a fake value.
  char ppm[32] = "";
  if (s.has_smoke_ppm) {
    const double p = finiteOrZero(s.smoke_ppm);
    std::snprintf(ppm, sizeof(ppm), "\"smoke_ppm\":%.0f,", p < 0.0 ? 0.0 : p);
  }

  const double current = finiteOrZero(s.current);
  const int n = std::snprintf(
      buf, cap,
      "{\"line_fault\":%s,\"fault_type\":\"%s\",\"rain\":%s,\"smoke\":%s,%s"
      "\"voltage\":%.1f,\"current\":%.2f,\"ts\":%lld}",
      s.line_fault ? "true" : "false",
      // fault_type must be "none" whenever line_fault is false (contract rule).
      s.line_fault ? faultTypeName(s.fault_type) : "none", s.rain ? "true" : "false",
      s.smoke ? "true" : "false", ppm, finiteOrZero(s.voltage), current < 0.0 ? 0.0 : current,
      static_cast<long long>(s.ts));
  return finish(n, cap);
}

size_t buildStatusJson(char* buf, size_t cap, bool use_server_timestamp, int64_t now_s, int rssi_dbm) {
  if (!buf || cap == 0) return 0;

  char seen[48];
  if (use_server_timestamp) {
    std::snprintf(seen, sizeof(seen), "{\".sv\":\"timestamp\"}");
  } else {
    std::snprintf(seen, sizeof(seen), "%lld", static_cast<long long>(now_s));
  }

  int n;
  if (rssi_dbm != 0) {
    n = std::snprintf(buf, cap, "{\"last_seen\":%s,\"rssi\":%d}", seen, rssi_dbm);
  } else {
    n = std::snprintf(buf, cap, "{\"last_seen\":%s}", seen);
  }
  return finish(n, cap);
}

uint32_t historySlot(int64_t ts) {
  if (ts < 0) ts = 0;
  return static_cast<uint32_t>((ts / kHistoryIntervalS) % kHistorySlots);
}

void historyKey(char out[5], int64_t ts) {
  std::snprintf(out, 5, "%04u", static_cast<unsigned>(historySlot(ts)));
}

}  // namespace pg
