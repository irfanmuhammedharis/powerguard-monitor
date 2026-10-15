# PowerGuard field unit (ESP32 firmware)

Measures mains voltage and load current, watches for smoke and rain, derives line faults and
publishes everything to Firebase Realtime Database for the PowerGuard Monitor app. It implements
the data contract in [`../powerguard-docs/03-data-model.md`](../powerguard-docs/03-data-model.md).

| Sensor | What it feeds | How |
|---|---|---|
| ZMPT101B | `voltage` | RMS of a 200 ms window (10 mains cycles) |
| SCT-013-015 | `current` | RMS of the same window |
| MQ-135 | `smoke`, `smoke_ppm` | Rs → CO₂-equivalent index, thresholded with hysteresis |
| Rain water detector | `rain` | Plate powered only while sampling, thresholded with hysteresis |
| *(derived)* | `line_fault`, `fault_type` | From voltage and current; there is no separate fault sensor |

## Hardware

Board: any **ESP32 DevKit (classic ESP32, `esp32dev`)**. All analog inputs are on ADC1 because ADC2 is
unusable while Wi-Fi is on. Pins are set in [`include/config.h`](include/config.h).

| Signal | GPIO | Notes |
|---|---|---|
| ZMPT101B OUT | 34 | through a 10 kΩ / 20 kΩ divider, 100 nF to GND at the pin |
| SCT-013-015 | 35 | on a VCC/2 bias network (below) |
| MQ-135 AO | 32 | through a 10 kΩ / 20 kΩ divider, 100 nF to GND at the pin |
| Rain AO | 33 | direct (module is powered from 3.3 V) |
| Rain module VCC | 27 | switched supply, see below |
| Status LED | 2 | on-board LED |

```
ZMPT101B  VCC → 5V    GND → GND    OUT ─10k─┬─ GPIO34          (ADC sees 2/3 of OUT; the module idles at 2.5 V → 1.67 V)
                                            ├─20k─ GND
                                            └─100nF─ GND

SCT-013-015 (voltage-output type, 15 A = 1 V RMS; NO burden resistor)
   3V3 ─10k─┬─10k─ GND          CT sleeve → bias node (┬)
            ├─10µF─ GND          CT tip    → GPIO35 (add 100 nF to GND at the pin)
            └─ bias node ≈ 1.65 V

MQ-135    VCC → 5V    GND → GND    AO ─10k─┬─ GPIO32           (heater needs 5 V; AO can reach ~5 V)
                                            ├─20k─ GND
                                            └─100nF─ GND

Rain      VCC → GPIO27   GND → GND   AO → GPIO33                (plate is powered ~30 ms per second only)
```

**Why these choices.** The ZMPT101B and MQ-135 modules run on 5 V, so their outputs can exceed the
ESP32's 3.3 V ADC limit; the divider is not optional. The rain plate corrodes quickly when held at a
DC voltage, so it is switched on only while sampling. If your CT is the current-output type
(SCT-013-000, 100 A : 50 mA) it needs an external burden resistor and a different `i_gain`; this
firmware assumes the `-015` voltage-output part.

> ⚠ **Mains safety.** Only qualified people should work on 230 V wiring. Fuse the ZMPT101B's AC
> input, keep mains conductors inside an enclosure away from the ESP32 side, clamp the CT around a
> **single** conductor (not the whole cable), and power the ESP32 from an isolated supply.
> PowerGuard is a monitoring aid, not a certified protection device.

## Setup

1. Do the one-time Firebase steps in
   [`../powerguard-docs/09-deployment-ops.md`](../powerguard-docs/09-deployment-ops.md#firebase-project-setup-one-time-per-real-project)
   and deploy [`../firebase/database.rules.json`](../firebase/database.rules.json).
2. `cp include/secrets.example.h include/secrets.h` and fill in Wi-Fi, API key, database host, the
   device user's email/password and `DEVICE_ID`. `secrets.h` is git-ignored.
3. `pio run -t upload`, then `pio device monitor`.
4. On the first successful sign-in the console prints the unit's **uid**. Store it at
   `/config/writers/<DEVICE_ID>` in the database (console step 5). Until then the log says
   `write refused (HTTP 401)` and explains what to set.
5. Calibrate (next section). Then open the app: Settings → Device ID must equal `DEVICE_ID`.

## Calibration (serial console, 115200 baud)

Calibration is stored in flash and survives re-flashing. Type `help` for the list.

| Step | Command | Condition |
|---|---|---|
| 1 | `cal vzero` | optional: ZMPT input disconnected from mains |
| 2 | `cal izero` | optional: no conductor through the CT |
| 3 | `cal v 231.5` | **required.** Mains on; the number is your multimeter's RMS reading. Turn the module's trim pot first so `status` shows the voltage channel at roughly 300–700 mV RMS (no `CLIPPING`) |
| 4 | `cal i 4.35` | optional: the default 15 A = 1 V is nominal. Use a known load and clamp meter to refine |
| 5 | `cal mq` | **required for smoke sensing.** After the 180 s warm-up, in clean air. A brand-new MQ-135 should burn in powered for ~24 h first |

Until `cal v` is done, voltage is reported but **voltage-based faults are suppressed**. Until
`cal mq` is done, **smoke sensing is OFF** and `smoke_ppm` is omitted from the payload (the app then shows
no ppm label on the Smoke tile). Both are announced on the console at boot. This is deliberate: with
placeholder values a healthy line or clean air could look faulty or smoky.

Other commands: `status`, `verbose on|off`, `cal show`, `cal clear`, `reboot`.

## What gets published

| Path | Every | Content |
|---|---|---|
| `/devices/{id}/live` | 2 s | `line_fault`, `fault_type`, `rain`, `smoke`, `smoke_ppm`, `voltage`, `current`, `ts` |
| `/devices/{id}/status` | 2 s, only after a good `/live` | `last_seen` (Firebase server clock), `rssi` |
| `/devices/{id}/history/{0000..8639}` | 10 s | same body as `/live`, in a 24 h ring buffer (`slot = (ts/10) mod 8640`) |

If sensing stalls for 5 s the unit stops writing, so the app correctly shows it offline instead of
trusting an old reading.

### Fault classification

Derived from voltage and current; each condition is debounced independently and the most severe active
one is reported. Defaults mirror the app's 180–260 V / 10 A window; change them in `config.h`.

| `fault_type` | Trips when | After |
|---|---|---|
| `short` | I > 14 A (or the CT output clips the ADC) | 0.4 s |
| `over_current` | I > 10 A | 3 s (rides through motor inrush) |
| `over_voltage` | V > 260 V | 3 s |
| `open_line` | V < 50 V | 3 s |
| `under_voltage` | V < 180 V | 3 s |

Faults clear after 3 s back inside limits (with 3 % hysteresis). If a front end is unplugged or railed
(DC bias outside 600–2700 mV) the detector is suppressed rather than inventing a fault.

### Status LED

Steady = healthy and uploading · slow blink (1 Hz) = not reaching the cloud · fast blink (5 Hz) = line
fault or smoke active.

### Reliability

Hardware watchdog on both worker tasks (40 s), automatic restart after 10 minutes without a successful
upload or if free heap stays under 30 KB, Wi-Fi reconnect, token refresh before expiry, exponential
back-off (2–60 s) on write failures, one retry on a stale keep-alive socket.

## Tests

| Command | What it proves |
|---|---|
| `pio test -e native` | 36 host-side tests of RMS maths, debouncing, fault logic, MQ-135 maths, JSON payloads and ring-buffer keys |
| `pio run` | The firmware compiles and links for `esp32dev` (`-Wall -Wextra`, no warnings) |
| `npm run test:rules` (repo root) | The firmware's real serializer output is accepted by the database rules in the Firebase emulator, and unauthorised or malformed writes are rejected |
| `npm test` (repo root) | The app's parsers accept that same output (`src/test/firmwareContract.test.ts`) |

**Not tested on hardware.** The ADC sampling rate and noise, the analog front ends, MQ-135/rain
thresholds, the TLS connection against the live Firebase endpoints, and the watchdog re-configuration
have only been compiled and reviewed, never run on an ESP32, because none was available. Treat
the first bring-up as the real test: watch `status` for `samples/window` (the firmware needs at least 300; thousands is typical), make sure
the raw RMS values are not clipping, and tune `SMOKE_*` and `RAIN_*` in `config.h` against real smoke and rain.

## Design notes

- **Firebase over REST, no Firebase library.** `src/cloud.cpp` talks to the documented Auth and RTDB
  REST endpoints with `HTTPClient` (keep-alive) and ArduinoJson. That keeps the dependency list to
  one library and makes the exact requests testable against the emulator
  (`tools/rules-tests/rules.test.js`). See [ADR-0010](../powerguard-docs/decisions/0010-firmware-design.md).
- **Pure core.** Everything with logic lives in `lib/powerguard_core` with no Arduino dependency, so
  it compiles and is tested on the host. `src/` is thin hardware glue.
- **TLS** verifies Google's root certificates (GTS Root R1 and R4, in `include/root_certs.h`); it never
  falls back to unverified connections. NTP must sync first because certificate validation needs the time.
