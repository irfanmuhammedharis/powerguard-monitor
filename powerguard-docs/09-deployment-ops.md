# Deployment & Operations

## Environments

| Environment | Firebase target | App build | Used for |
|---|---|---|---|
| **Local / E2E** | Firebase Emulator Suite, project `demo-powerguard`, RTDB namespace `demo-powerguard-default-rtdb` | Debug build with `ENVFILE=.env.e2e`, `google-services.demo.json` | Development, automated E2E |
| **Dev** | Real Firebase project `powerguard-dev` `[ASSUMPTION]` | Debug build with `.env` (no emulator) | Testing with the real ESP32 unit |
| **Prod** | Real Firebase project `powerguard-prod` `[ASSUMPTION]` | Signed release build | Deployed phones |

Each real project needs its own `google-services.json`. Keep them outside git and copy the right one into `android/app/` before building (e.g. `cp ~/secrets/powerguard/prod/google-services.json android/app/`).

## Firebase project setup (one-time per real project)

1. Create the project in the Firebase console. Spark plan is enough.
2. **Build → Realtime Database → Create database.** Choose a region (e.g. `asia-southeast1` for India). Start in locked mode.
3. **Authentication → Sign-in method:** enable **Anonymous** and **Email/Password**.
4. **Authentication → Users → Add user:** create the ESP32 user (e.g. `device-esp32_01@powerguard.local` with a strong password). Copy its uid.
5. **Realtime Database → Data:** add `/config/writers/esp32_01` = `<ESP32 uid>`.
6. **Project settings → Add app → Android:** package `com.hexcodeplus.powerguard`; add the SHA-1 of your debug and release keystores (`cd android && ./gradlew signingReport`); download `google-services.json`.
7. If the database is not in `us-central1`, copy its URL (e.g. `https://<project>-default-rtdb.asia-southeast1.firebasedatabase.app`) into `FIREBASE_DATABASE_URL` in `.env`.
8. Deploy rules: `cd firebase && firebase use <project-id> && firebase deploy --only database`.
9. Give the firmware team the database URL, the ESP32 user's email/password, and the data contract in [03-data-model.md](03-data-model.md#rtdb-schema).

## Build & CI/CD

### Prerequisites

Node 20 LTS or newer `[ASSUMPTION]`, JDK 17, Android SDK (platform matching targetSdk, build-tools, emulator), Firebase CLI (`npm i -g firebase-tools`), Maestro (E2E only).

### Commands

| Task | Command |
|---|---|
| Install | `npm ci` |
| Run on device/emulator (debug) | `npx react-native run-android` |
| Run against emulator stack | `npm run emulators` then `npm run android:e2e` |
| Debug APK | `npm run build:android:debug` → `android/app/build/outputs/apk/debug/` |
| Release APK (split per ABI) | `npm run build:android:release` → `cd android && ./gradlew assembleRelease` |
| Play bundle | `npm run bundle:android` → `cd android && ./gradlew bundleRelease` |
| Signing report (SHA-1) | `cd android && ./gradlew signingReport` |

### CI pipeline (GitHub Actions `[ASSUMPTION]`)

`.github/workflows/ci.yml`, on every push and pull request:

1. Checkout; set up Node 20 and JDK 17; `npm ci`.
2. `npm run typecheck`
3. `npm run lint`
4. `npm run test:coverage`
5. `npm run test:rules` (installs `firebase-tools`; the emulator needs Java, which is already present)
6. Copy `google-services.demo.json` → `google-services.json`; `npm run build:android:debug`
7. Secret scan: fail if any tracked file matches `private_key`, `storePassword=`, or `"type": "service_account"`.

`.github/workflows/e2e.yml`, nightly and on `v*` tags: Android emulator action (API 34, x86_64) + Firebase emulators + `npm run android:e2e` + `npm run e2e`.

`.github/workflows/release.yml`, on `v*` tags: decode the keystore from the `PG_KEYSTORE_BASE64` secret, set the `PG_UPLOAD_*` env vars, write prod `google-services.json` from the `PG_GOOGLE_SERVICES_PROD` secret, run `bundleRelease` and `assembleRelease`, and upload the artifacts to the release.

The merge gate is defined in [07-testing-strategy.md → CI gate](07-testing-strategy.md#ci-gate).

### Versioning

`versionName` follows semver (`1.0.0`). `versionCode` = `major*10000 + minor*100 + patch` (1.0.0 → 10000). Both are set in `android/app/build.gradle` and bumped in the release commit with a `CHANGELOG.md` entry.

## Infrastructure

There are no servers. Infrastructure consists of:
- Firebase project(s): Auth + Realtime Database + rules (deployed via Firebase CLI from `firebase/`).
- Distribution: direct APK install (sideload) for early units; Google Play internal testing track when ready `[ASSUMPTION]`.

## Configuration

Build-time keys in `.env` (read via `react-native-config`, exposed only through `src/config/appConfig.ts`):

| Key | Type | Default | Purpose |
|---|---|---|---|
| `USE_FIREBASE_EMULATOR` | `true`/`false` | `false` | Point auth + database at the emulator (ignored in release unless `E2E=true`) |
| `FIREBASE_EMULATOR_HOST` | string | `localhost` | Emulator host (`10.0.2.2` without `adb reverse`) |
| `FIREBASE_EMULATOR_DB_PORT` | number | `9000` | Database emulator port |
| `FIREBASE_EMULATOR_AUTH_PORT` | number | `9099` | Auth emulator port |
| `FIREBASE_DATABASE_URL` | URL | empty | Override for regional databases; empty = use `google-services.json` |
| `DEFAULT_DEVICE_ID` | string | `esp32_01` | Initial device ID on first launch |
| `E2E` | `true`/`false` | `false` | Marks E2E builds |

Simulator environment variables (developer shell only): `GOOGLE_APPLICATION_CREDENTIALS`, `FIREBASE_DATABASE_URL` (project mode); `FIREBASE_DATABASE_EMULATOR_HOST=127.0.0.1:9000` (emulator mode).

Release signing (Gradle properties or env): `PG_UPLOAD_STORE_FILE`, `PG_UPLOAD_STORE_PASSWORD`, `PG_UPLOAD_KEY_ALIAS`, `PG_UPLOAD_KEY_PASSWORD`.

## Observability

There is no analytics or crash SDK in v1 (out of scope). Health is observed through:

| Signal | Where | Healthy looks like |
|---|---|---|
| Device heartbeat | RTDB console: `/devices/<id>/status/last_seen` | Advances every ~2 s |
| History growth | RTDB console: `/devices/<id>/history` child count | Stable at 8,640 with the ring buffer; grows ~8,640/day with `push()` (see [ADR-0008](decisions/0008-history-retention-and-server-timestamps.md)) |
| Usage and quotas | Firebase console → Realtime Database → Usage | Well within Spark limits (100 simultaneous connections, 1 GB stored, 10 GB/month download) |
| App logs (debug) | `npx react-native log-android` / Logcat tag `ReactNativeJS` | No repeated `parse` warnings |
| Foreground service | Persistent notification visible when enabled | Text updates with state |

Adding Firebase Crashlytics is the first observability upgrade if field crashes become a concern (future ADR).

## Runbooks

### Deploy a new app version

1. Make sure `main` is green (CI gate) and the nightly E2E passed.
2. Bump `versionName`/`versionCode`; add the `CHANGELOG.md` release section.
3. Run manual checks M-1 to M-5 ([07](07-testing-strategy.md#manual-checks-run-at-t-24-and-before-each-release)) on a release build.
4. Tag `vX.Y.Z` and push; the release workflow builds signed artifacts.
5. Distribute: upload the AAB to Play internal testing, or share the arm64 APK for sideloading.

### Roll back the app

1. Sideload: reinstall the previous release APK (same signing key; `versionCode` must not go lower for Play, so for Play, rebuild the old code with a higher `versionCode`).
2. Play: halt the staged rollout in the Play Console, then publish the rebuilt previous version.

### Roll back RTDB rules

1. `git checkout <last-good-tag> -- firebase/database.rules.json`
2. `npm run test:rules`
3. `firebase deploy --only database`

### Incident: app shows "Device offline" but the device seems on

1. Check `/devices/<id>/status/last_seen` in the console. If it isn't advancing, it's a device/Wi-Fi problem: power-cycle the ESP32 and check its serial log.
2. If it is advancing but the app says offline: compare `last_seen` with the current unix time. A large difference means the ESP32 clock is wrong (NTP failed); the fix is the server-timestamp change in [ADR-0008](decisions/0008-history-retention-and-server-timestamps.md). Also check the phone's clock is set automatically.
3. Confirm the app's device ID in Settings matches the path.

### Incident: "No access to this device"

1. Rules not deployed or wrong project: run `firebase deploy --only database` for the right project.
2. Anonymous sign-in disabled: enable it in Authentication → Sign-in method.
3. Wrong `google-services.json` or `FIREBASE_DATABASE_URL`: confirm the app is built against the same project the device writes to.

### Incident: no alerts while the app is minimized

1. Confirm Background monitoring is ON and the persistent notification is visible.
2. Confirm notifications are allowed and the `critical-alerts` channel isn't muted (Android app notification settings).
3. Set battery usage to "Unrestricted" for PowerGuard (Settings → Battery optimization row).
4. If the service is still being killed on that phone model, record it in a known-issues list; this is the documented limitation of [ADR-0005](decisions/0005-local-notifications-foreground-service.md).
