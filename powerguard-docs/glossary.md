# Glossary

Use these names consistently in code, UI text and docs.

| Term | Definition | Name in code |
|---|---|---|
| **Field unit / device** | The ESP32 board with sensors at the installation | `deviceId`, `/devices/{deviceId}` |
| **RTDB** | Firebase Realtime Database | `db()` |
| **Live reading** | The latest sensor snapshot at `/live`, overwritten every 2 s | `LiveReading` |
| **Status** | Device heartbeat at `/status` (`last_seen`, `rssi`) | `DeviceStatus` |
| **History sample** | A snapshot stored under `/history` every 10 s | `HistorySample` |
| **Line fault** | A fault on the monitored power line reported by the ESP32, with a type | `line_fault`, `fault_type` |
| **Fault type** | Category of line fault: `none`, `over_current`, `under_voltage`, `over_voltage`, `open_line`, `short`, or `unknown` (app-side fallback) | `FaultType` |
| **Smoke ppm** | Raw or calibrated reading from the MQ-series smoke sensor; display only | `smoke_ppm` |
| **RSSI** | Wi-Fi received signal strength in dBm | `rssi`, `rssiBars()` |
| **Power** | Voltage × current, computed in the app, shown in watts | `power()` |
| **Threshold** | User-set voltage window and current limit | `Settings.thresholds` |
| **Level** | Threshold evaluation of a reading: `ok`, `warning` (near limit), `danger` (out of range) | `Level` |
| **Connectivity** | Combined phone and device link state: `loading`, `online`, `device_offline`, `phone_offline` | `Connectivity` |
| **Stale** | Data shown while connectivity is offline; rendered muted | `stale` prop |
| **Worst state** | The single highest-priority condition shown in the hero banner | `WorstState`, `worstState()` |
| **Alert** | A notification + haptic for line fault, smoke or rain | `AlertKey` |
| **Rising edge** | A condition changing from false to true (confirmed over 2 samples) | — |
| **Episode** | The period from an alert's rising edge until its condition clears | `notified` flag |
| **Confirmation samples** | Consecutive true samples required before alerting (2) | `ALERT_CONFIRM_SAMPLES` |
| **Event** | A started/cleared transition derived from history for the History screen | `HistoryEvent` |
| **Foreground service (FGS)** | Android service with a persistent notification that keeps the app running in the background | `backgroundService` |
| **Background monitoring** | The user-facing name for the FGS feature | `backgroundMonitoring` setting |
| **Simulator** | Dev script that writes scenario data to RTDB | `tools/simulator/simulate.ts` |
| **Scenario** | A scripted sequence of readings for the simulator | `scenarios/*.json` |
| **Emulator (Firebase)** | Local Firebase Auth + RTDB used for dev, rules tests and E2E | project `demo-powerguard` |
| **Emulator (Android)** | Android Virtual Device used to run the app | — |
| **LTTB** | Largest-Triangle-Three-Buckets, the chart downsampling algorithm | `downsampleLTTB()` |
| **Ring buffer** | Fixed set of history slots overwritten in rotation (recommended firmware layout) | ADR-0008 |
| **Spark / Blaze** | Firebase free plan / pay-as-you-go plan | — |
