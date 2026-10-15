# Product Brief

## Problem

Power lines and electrical installations monitored by an ESP32 field unit produce useful signals (line faults, smoke, rain exposure, voltage and current), but those signals are only useful if a person sees them in time. Today the data sits in Firebase with no purpose-built way to watch it. Someone responsible for the installation needs to know **immediately** when a fault or smoke event starts, and needs a quick read on electrical health without opening the Firebase console.

## Target users

| Persona | Context | Pain |
|---|---|---|
| **Site owner / operator** (primary) | Owns or runs the installation; checks it from a phone during the day | No live view; finds out about faults late |
| **Maintenance technician** (secondary) | Responds to faults on site; needs voltage/current readings and fault type | Must ask someone else to read the console |
| **Project engineer at HexCodePlus** (secondary) | Builds and tests the ESP32 unit | Needs a clear way to validate the hardware end to end |

## Jobs to be done

- As an operator, see at a glance whether everything is normal, so I can stop worrying without reading numbers.
- As an operator, get alerted the moment a line fault or smoke is detected, so I can act before damage spreads.
- As a technician, read live voltage, current and fault type, so I can diagnose on site.
- As a technician, see when past faults, smoke and rain events happened, so I can find patterns.
- As an engineer, push test data and watch the app react, so I can validate the field unit without waiting for real faults.

## Success metrics

| Metric | Target |
|---|---|
| Update latency (RTDB write → visible on dashboard) | ≤ 1 s on normal Wi-Fi/4G |
| Alert correctness | 100% of rising edges notified exactly once in test scenarios; 0 duplicate notifications |
| Offline detection | Device shown OFFLINE within 16 s of its last update |
| Crash-free sessions | ≥ 99.5% (including malformed data scenarios) |
| Smoothness | Dashboard animations at 60 fps on a mid-range device (e.g. 4 GB RAM, 2021-era chipset) `[ASSUMPTION]` |

## Scope — MVP

- Dashboard: hero status banner, connection pill, voltage and current arc gauges, power chip, line-fault/smoke/rain status tiles, live chart (5 min / 1 h / 24 h).
- History screen: day-grouped list of fault/smoke/rain transitions with filters.
- Settings: device ID, per-type alert toggles, voltage/current thresholds, background monitoring toggle, theme.
- Local notifications and haptics on alert rising edges.
- Optional background monitoring via a foreground service (default OFF).
- Dark and light themes; designed loading/empty/error/offline states.
- Firebase Anonymous Auth; read-only access to RTDB.
- Dev tooling: a simulator script that writes scenario data to RTDB (real project or emulator).

## Out of scope (explicitly)

- ESP32 firmware (separate deliverable; this suite only defines its data contract).
- iOS build or iOS-specific code.
- Writing anything to RTDB from the app (no remote control, no acknowledgements stored in the cloud).
- Multiple devices shown at once, fleets, user accounts, roles or sharing.
- Server-side push notifications (FCM via Cloud Functions).
- Energy (kWh) accumulation, reports, CSV export, home-screen widgets.
- Localization beyond English (strings are centralized so it can be added later).
- Analytics, crash-reporting SDKs and ads.

## Constraints & assumptions

| Constraint | Value |
|---|---|
| Framework | React Native CLI, bare workflow, TypeScript strict. **No Expo packages.** ([ADR-0001](decisions/0001-react-native-cli.md)) |
| Backend | Firebase Realtime Database on the free Spark plan ([ADR-0002](decisions/0002-firebase-realtime-database.md)) |
| Platform | Android, minSdk 24, latest stable targetSdk |
| Budget | No paid services `[ASSUMPTION]` |
| Supply type | AC mains, nominal 230 V `[ASSUMPTION]` (Kerala/India context) |
| Devices per user | One (`esp32_01` by default) `[ASSUMPTION]` |
| Safety | The app is a monitoring aid, not a certified safety system. Alerts are best-effort ([ADR-0005](decisions/0005-local-notifications-foreground-service.md)). |
