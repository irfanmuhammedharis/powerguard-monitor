#include "app_state.h"

#include <freertos/semphr.h>

namespace app {

namespace {
SemaphoreHandle_t g_mutex = nullptr;
Snapshot g_snapshot;
NetStatus g_net;
pg::Calibration g_cal;
}  // namespace

namespace detail {
void lock() { xSemaphoreTake(g_mutex, portMAX_DELAY); }
void unlock() { xSemaphoreGive(g_mutex); }
NetStatus& netRef() { return g_net; }
}  // namespace detail

void init(const pg::Calibration& cal) {
  g_mutex = xSemaphoreCreateMutex();
  g_cal = cal;
}

Snapshot snapshot() {
  detail::lock();
  Snapshot copy = g_snapshot;
  detail::unlock();
  return copy;
}

void publish(const Snapshot& s) {
  detail::lock();
  g_snapshot = s;
  detail::unlock();
}

NetStatus net() {
  detail::lock();
  NetStatus copy = g_net;
  detail::unlock();
  return copy;
}

pg::Calibration calibration() {
  detail::lock();
  pg::Calibration copy = g_cal;
  detail::unlock();
  return copy;
}

void setCalibration(const pg::Calibration& cal) {
  detail::lock();
  g_cal = cal;
  detail::unlock();
}

}  // namespace app
