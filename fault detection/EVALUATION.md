# PowerGuard firmware evaluation (2026-10-15)

Static review plus host-side testing of the ESP32 firmware. **Nothing here was run on
real hardware**; findings marked *(inspection)* come from reading the code and need a
bench test to confirm.

## Evidence

| Check | Result |
|---|---|
| `pio test -e native` | 40/40 pass (36 existing + 4 added in this review) |
| `pio run` (esp32dev), clean build, `-Wall -Wextra` | 0 warnings, 0 errors |
| Flash / RAM | 971 061 B of 1 310 720 B (74.1 %), 47 556 B of 327 680 B (14.5 %). Flash headroom is 25.9 %, above the 20 % target |
| App: typecheck, lint (0 warnings), jest | pass, 97 tests |
| Static analysis (cppcheck / clang-tidy) | not installed, not run |
| Hardware, HIL, soak, EMC | not run |

Measured by the added tests: window leakage error is below 1 % for mains between 47 and
52 Hz. A short is reported on the third over-limit window (about 600 ms after the first),
because the 400 ms debounce is quantised by the 300 ms window cadence.

## Findings, most severe first

| # | Severity | Finding | Fix |
|---|---|---|---|
| 1 | High | **Fail-silent sensor loss.** `sensors.cpp` runs the fault detector only when both the voltage and current front ends are biased. If the ZMPT101B is unplugged or unpowered, over-current and short detection stop too and the unit reports "no fault". Nothing tells the cloud that sensing is degraded *(inspection)* | Evaluate current faults whenever the current channel is healthy. Publish a sensor-health flag, which needs a data-contract change |
| 2 | High | **No local alarm or protective output.** A fault or smoke event only reaches the user through Wi-Fi, Firebase and the phone. The only local indication is a blinking LED. The app docs already say this is not a certified safety system | Keep that disclaimer prominent. Optionally add a buzzer or relay with a defined safe state |
| 3 | Medium | **Power loss cannot be reported.** If the unit shares the monitored mains, a dead line also kills the unit. It then looks "offline", never `open_line`. `open_line` only works if the ESP32 has a separate supply | Decide the supply topology. If it is shared, add a supercap or battery "last gasp" write |
| 4 | Medium | **Blind spot in sampling.** Each cycle is a 200 ms window plus a 100 ms pause, so 33 % of the time is not measured. A short that trips the breaker within about 100 ms may never be seen | Sample continuously with ADC DMA, or at least drop the pause |
| 5 | Medium | **Reset cause is not logged and brown-out is not configured.** There is no `esp_reset_reason()` at boot. Field resets from the watchdog, the heap guard, the 10-minute no-upload restart or a brown-out are indistinguishable | Print the reset reason in `setup()` and keep a counter in NVS |
| 6 | Medium | **Stack headroom is unmeasured.** Tasks use 4096 B (sensors) and 12 288 B (cloud, which runs the TLS handshake). No `uxTaskGetStackHighWaterMark` is logged | Print high-water marks in `status`, and run a 24 h soak |
| 7 | Medium | **Voltage is reported before it is calibrated.** The default gain of 0.50 is a placeholder, so the app can show a wrong voltage while voltage faults are correctly suppressed | Omit `voltage` or flag it until `cal v` has run, or make the app show "uncalibrated" |
| 8 | Medium | **Single-point voltage calibration.** The ESP32 ADC is non-linear at 11 dB, so a gain fitted at about 230 V can be several percent off at the 180 V and 260 V trip points | Verify with a variac at 180, 230 and 260 V, and add a second calibration point if the error is too large |
| 9 | Low | **`cal mq` accepts any value.** It takes whatever Rs is read after 180 s of warm-up. A smoky room, or a sensor that has not burned in, gives a bad R0 | Reject an R0 outside a plausible range and require a stable reading |
| 10 | Low | **Calibration is stored as separate NVS keys.** A power cut between writes can leave a mix of old and new values | Store one versioned blob with a CRC |
| 11 | Low | **MQ-135 floor.** The `vout > 0.02 V` guard is below the ESP32 ADC's usable floor (about 0.1 V), so very high Rs readings are inaccurate | Raise the floor to about 0.1 V at the ADC pin |
| 12 | Low | **No OTA, no secure boot, no flash encryption.** Wi-Fi and Firebase credentials sit in plaintext flash, and updates need USB | Acceptable for a prototype. Add before shipping |
| 13 | Low | **Database rules.** `devices/$id` is readable by any authenticated user, and the app uses anonymous auth. Anyone holding the public API key can read every device | Add per-user ownership, which the docs already list as a v2 item |
| 14 | Info | **MQ-135 is not a smoke sensor.** It responds to alcohol, ammonia and cooking fumes too. Expect false positives, and tune with a real smoke test | None |

## What is done well

- The pure `powerguard_core` library has no Arduino dependency and runs on the host.
- Time is passed into the debouncers and uses unsigned subtraction, so it survives `millis()` wrap-around.
- Unsafe defaults are off: voltage faults and smoke sensing stay disabled until calibrated.
- NVS values are sanity-checked on load.
- Every network call has a timeout, the watchdog is fed per attempt, and failures back off from 2 s to 60 s.
- There are guards for low heap and for 10 minutes without a successful upload.
- Certificate validation uses pinned Google roots, and NTP is required first.
- `/status` is written only after `/live` succeeds, so "online" always means fresh data.

## Test gaps and next steps

1. **Bench:** check the ADC against a multimeter, linearity at 180, 230 and 260 V, the CT against a known load, and clip behaviour.
2. **Fault injection:** unplug each sensor, drop Wi-Fi, block the NTP server, revoke the auth user, and cut power mid-NVS-write. Confirm the unit recovers or fails safe.
3. **Soak:** run 72 hours while logging heap, stack high-water marks and reset causes.
4. **Static analysis:** run cppcheck and `-Werror` in CI.
5. **Requirement traceability:** link the `FR-*` and `NFR-*` IDs to firmware tests.
