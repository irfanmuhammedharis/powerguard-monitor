#pragma once

namespace sensors {

// Configures the ADC/GPIO and starts the sensing task on core 1. It keeps
// app::Snapshot up to date: ZMPT101B voltage, SCT-013 current, line-fault
// classification, MQ-135 smoke and rain.
void start();

}  // namespace sensors
