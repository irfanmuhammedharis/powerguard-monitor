# Changelog

All notable changes, one entry per completed build task. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions follow semver.

Each task entry uses this shape:

```
### T-NN — <task name> (YYYY-MM-DD)
- Added / Changed / Fixed: <what>
- Tests: <test files added>
- Verified: <how it was verified end to end>
- Notes: <assumptions made, TODOs raised>
```

Record blockers under a "Blocked" heading with what is missing and who can unblock it.

## [Unreleased]

### Firmware + app integration (2026-10-15)
- Added: complete ESP32 firmware in `fault detection/` (ZMPT101B voltage, SCT-013-015 current, MQ-135 smoke, rain plate, derived line faults, Wi-Fi/NTP/Firebase REST client, 24 h history ring buffer, serial calibration console, watchdogs). See ADR-0010.
- Added: `firebase/database.rules.json` and emulator config (the rules from 06-security.md, previously missing).
- Added: pure domain layer `src/domain/` (connectivity, thresholds/worst state, alert engine, history events, LTTB), `src/core/` feed + alert controller singletons, settings validation/store.
- Changed: alerts now run through one controller for the foreground and the foreground service; they require confirmed online samples, count a re-delivered snapshot once, persist per device and respect per-type settings. The foreground service only keeps the runtime alive.
- Changed: history is queried with `orderByChild('ts')` over real 5 min / 1 h / 24 h windows (was `limitToLast(60)` by key, wrong for a ring buffer); chart ranges are real and downsampled; History lists started/cleared transitions for 24 h grouped by day.
- Changed: notification channels now `critical-alerts` / `weather-alerts` / `monitoring-service` with fixed per-key ids and cancel-on-clear; permission is requested after first live data; "Alerts are off" card.
- Changed: Settings edits the device ID as a draft with validation and Save; slider limits follow FR-8; Battery optimization row; safety statement.
- Fixed: hero banner said "Out of range" while loading or with no data (an empty reading has voltage 0).
- Fixed: alert notifications referenced a missing `ic_notification` drawable, which makes Notifee reject the notification; added the drawable.
- Fixed (found by running on a phone): `ensureAnonymousAuth` threw synchronously without a Firebase config and crashed the render; it now rejects, giving the designed "Couldn't connect" state (regression test added). Also fixed the squeezed status card, missing safe-area insets (Android 15 edge-to-edge), clipped gauge labels, "All systems normal" shown while disconnected, and the "Alerts are off" card showing before the permission was ever requested.
- Fixed: lint 91 warnings -> 0 (`--max-warnings 0` now enforced by `npm run lint`).
- Tests: 97 app tests (domain, alert controller with mutation-checked behaviours, settings, firmware-contract), 36 firmware tests, 25 emulator tests.
- Verified: see README -> Verification. Launched on a phone without Firebase config (offline state only); not verified against live data or on an ESP32.
- Notes: ADR-0008 accepted; architecture open questions 1 and 2 resolved.

### Review — documentation and runtime alignment (2026-10-15)
- Fixed: live/status timestamp normalization, malformed-value fallbacks, strict sensor booleans, 10-second connectivity grace period, phone-offline state, dashboard empty state, threshold warnings, one-decimal gauges, rounded power, and two-sample foreground alerts.
- Fixed: Android foreground service now declares `specialUse` with the required permission and subtype, starts with the matching Notifee type, and has a Stop action.
- Tests: added `src/models/device.test.ts` (5 parsing cases).
- Verified: `npm test`, `npm run typecheck`, Metro Android bundle, and `assembleDebug` pass. `npm run lint` exits successfully with 91 warnings.
- Notes: This is a partial alignment pass, not completion of a build-plan task; the remaining gaps below prevent claiming the app meets the suite.

### Docs — Documentation suite created (2026-10-15)
- Added: full documentation suite (README, AGENTS, 00–09, glossary, ADR-0001 to ADR-0009).
- Notes: ADR-0008 is proposed and needs firmware confirmation. Android's `specialUse` manifest declaration has since been checked against the current platform and Notifee docs; Play Console acceptance remains a release-time review.

## Blocked / incomplete

- On-device verification is blocked: ADB cannot start in this environment (`could not install *smartsocket* listener: Operation not permitted`), no emulator or phone is available, `android/app/google-services.json` is absent, and no ESP32 is attached.
- The build plan is not complete: the simulator CLI, Maestro E2E flows, component/render-count/contrast tests, centralised strings and release verification are not present yet.
