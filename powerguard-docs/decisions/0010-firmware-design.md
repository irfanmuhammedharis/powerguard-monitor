# 0010 — Firmware: REST client, derived faults, calibration-gated alarms

- Status: accepted
- Date: 2026-10-15

## Context
The ESP32 firmware (`fault detection/`) was a separate deliverable that only had a data contract.
The unit has four sensors: ZMPT101B (mains voltage), SCT-013-015 (current), MQ-135 (air quality)
and a rain-water plate. There is **no dedicated line-fault input**, although the contract has
`line_fault` and `fault_type`. Several analog parts cannot be trusted until calibrated per unit.

## Options considered
- **Firebase client: `Firebase-ESP-Client` library** (named in ADR-0002) vs **plain REST over `HTTPClient`**.
  The library is feature-rich but large and hides the exact requests. REST needs ~150 lines for
  sign-in, token refresh and `PUT`, depends only on ArduinoJson, and the identical requests can be
  replayed against the Firebase Emulator Suite.
- **Fault source:** derive from voltage and current (chosen) vs add a hardware fault input (not
  available).
- **Uncalibrated behaviour:** report best-effort numbers and alarm anyway, vs suppress alarms that
  depend on an unknown calibration.
- **Smoke fallback:** auto-calibrate R0 from the first reading after boot vs require an explicit
  `cal mq`.

## Decision
- Use REST. Auth: `accounts:signInWithPassword` then `securetoken` refresh before expiry. Writes:
  `PUT /devices/{id}/{live|status|history/{slot}}.json?print=silent&auth=<idToken>` over a kept-alive
  TLS connection. TLS verifies GTS Root R1 and R4 (both are needed: the Auth endpoints chain to R4,
  the regional RTDB host to R1); there is no insecure fallback.
- Derive `line_fault` from voltage and current: `short` (I > 14 A or CT clipping), `over_current`
  (I > 10 A), `over_voltage` (V > 260), `open_line` (V < 50), `under_voltage` (V < 180), each
  debounced separately, most severe wins. Limits default to the app's own 180–260 V / 10 A window.
- Adopt both recommendations of [ADR-0008](0008-history-retention-and-server-timestamps.md):
  `last_seen` is `{".sv":"timestamp"}` and history is an 8,640-slot ring buffer
  (`slot = (ts / 10) mod 8640`).
- Calibration is stored in NVS and edited over serial. Until `cal v` runs, the fault detector sees a
  nominal 230 V so only current faults can trip. Until `cal mq` runs, smoke sensing is off and
  `smoke_ppm` is omitted. No auto-calibration: a unit booted in smoky air would calibrate to it and
  go blind.
- `/status` is written only after `/live` succeeds, and not at all if sensing has stalled, so the app's
  "online" always means fresh data.

## Consequences
- The MQ-135 gives a CO₂-equivalent contamination index, not a calibrated smoke concentration; the
  `SMOKE_*` thresholds must be tuned against a real smoke test.
- While `smoke_ppm` is absent the app shows the Smoke tile as CLEAR with no ppm label. The contract has
  no "sensor unavailable" field, so this is the only signal. Adding one would need a contract change
  (and a firmware and rules change), so it is left for a future ADR.
- The faults are inferences. `open_line` assumes the ESP32 stays powered (from a separate supply or
  backup) while the monitored line is dead; if it is powered from the same line the unit simply goes offline.
- The REST client was verified against the Auth and Database emulators and Google's real TLS chains
  with `openssl`, but never run on hardware (see the firmware README).
