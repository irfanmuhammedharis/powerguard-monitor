#pragma once

namespace cloud {

// Starts the Wi-Fi/NTP/Firebase task on core 0. It writes, in the shape the
// PowerGuard app expects (powerguard-docs/03-data-model.md):
//   /devices/{id}/live            every 2 s   (overwritten)
//   /devices/{id}/status          every 2 s   (heartbeat, written only after a good /live)
//   /devices/{id}/history/{slot}  every 10 s  (8640-slot ring buffer = 24 h)
void start();

}  // namespace cloud
