# PowerGuard Monitor

Android only React Native CLI application for read only monitoring of one ESP32 device through Firebase Realtime Database. The dashboard displays line fault, rain and smoke alerts, voltage, current, calculated power and a compact history chart.

## Project layout

```text
App.tsx                      App shell: theme, navigation, error boundary
index.js                     Boots the runtime (feed + alerts) and registers the foreground service
src/domain/                  Pure, tested logic: connectivity, thresholds, alert engine, events, LTTB
src/core/                    Singletons outside React: deviceFeed (RTDB listeners), alertController, bootstrap
src/store/                   Tiny observable stores (device feed state, persisted settings)
src/hooks/                   useFeed, useConnectivity, useHistory, usePermission
src/models/                  Defensive typed parsing of Firebase data and settings validation
src/services/                Firebase auth/refs, Notifee notifications + foreground service, storage
src/screens/                 Dashboard, History, Settings
src/components/              Cards, gauges, connection pill, chart
fault detection/             ESP32 firmware (PlatformIO) - see its README
firebase/                    database.rules.json + emulator config
tools/rules-tests/           Emulator tests: firmware payloads vs. rules vs. auth flow
powerguard-docs/             The specification suite and ADRs
android/                     React Native CLI scaffold and Android Firebase/notification setup
```

## The whole system

```text
ESP32 (ZMPT101B, SCT-013-015, MQ-135, rain)  --HTTPS REST-->  Firebase Realtime Database  --listeners-->  this app
        fault detection/                                          firebase/database.rules.json
```

Bring-up order: Firebase project and rules (below) -> flash and calibrate the unit
([`fault detection/README.md`](fault%20detection/README.md)) -> install the app.

## Requirements and setup

Use Node 22+, JDK 17, Android SDK (API 36), Android platform tools and a physical Android device or emulator. This project targets React Native 0.84.0, Android only, Hermes, TypeScript strict mode and minSdk 24. Keep `google-services.json` out of source control; the Google Services Gradle plugin is enabled when that file is present.

1. Install dependencies with `npm install`.
2. Create a Firebase project and enable **Anonymous** and **Email/Password** sign-in and **Realtime Database**. Create the ESP32's user and whitelist its uid as described in [`fault detection/README.md`](fault%20detection/README.md#setup).
3. Register an Android app with package ID `com.hexcodeplus.powerguard`. Add your debug/release SHA-1 fingerprints in Firebase, download `google-services.json` and place it in `android/app/google-services.json`. That file is ignored by Git.
4. Ensure Realtime Database is initialized in the Firebase console. The downloaded Android configuration supplies the Firebase project and database configuration. The default device ID is `esp32_01` and can be changed in Settings.
5. Connect an Android device with USB debugging enabled, or start an emulator. Run `npx react-native run-android`.

Build a debug APK with `cd android && ./gradlew assembleDebug`; the APK is at `android/app/build/outputs/apk/debug/app-debug.apk`. The build uses JDK 17. Start Metro with `npm start` for a development install via `npx react-native run-android`.

For a signed release, store the keystore outside version control and supply `MYAPP_UPLOAD_STORE_FILE`, `MYAPP_UPLOAD_KEY_ALIAS`, `MYAPP_UPLOAD_STORE_PASSWORD` and `MYAPP_UPLOAD_KEY_PASSWORD` through environment variables or local `~/.gradle/gradle.properties`. Configure those values in `android/app/build.gradle`, then run `cd android && ./gradlew assembleRelease` or `./gradlew bundleRelease` for an AAB. Never commit signing credentials.

## Firebase data and security

The app reads `/devices/{deviceId}/live`, `/devices/{deviceId}/status` and the latest 60 entries under `/devices/{deviceId}/history`. `live` is overwritten about every 2 seconds and one `history` sample is written every 10 seconds into a 24-hour ring buffer, so history keys wrap and the app always queries by the `ts` child. The ESP32 uses its own credentials to write; this app only authenticates anonymously to read.

The complete rules (device-only writes, ring-buffer index on `ts`, payload validation) are in [`firebase/database.rules.json`](firebase/database.rules.json); deploy them with `cd firebase && firebase use <project-id> && firebase deploy --only database`. Minimal read-only equivalent for reference:

```json
{
  "rules": {
    "devices": {
      "$deviceId": {
        ".read": "auth != null",
        ".write": false
      }
    }
  }
}
```

## Simulate data

In the Firebase console, select `/devices/esp32_01/live` and paste one object at a time. Set `/devices/esp32_01/status` to `{ "last_seen": 1760000000, "rssi": -60 }` using current Unix seconds for the online state. Replace the sample `ts` and `last_seen` fields with the current time when pasting so the status is not immediately stale.

Healthy:

```json
{
  "line_fault": false,
  "fault_type": "none",
  "rain": false,
  "smoke": false,
  "smoke_ppm": 0,
  "voltage": 230.4,
  "current": 1.82,
  "ts": 1760000000
}
```

Fault:

```json
{
  "line_fault": true,
  "fault_type": "over_current",
  "rain": false,
  "smoke": false,
  "smoke_ppm": 0,
  "voltage": 230.4,
  "current": 12.4,
  "ts": 1760000000
}
```

Smoke:

```json
{
  "line_fault": false,
  "fault_type": "none",
  "rain": false,
  "smoke": true,
  "smoke_ppm": 175,
  "voltage": 230.1,
  "current": 1.8,
  "ts": 1760000000
}
```

Rain:

```json
{
  "line_fault": false,
  "fault_type": "none",
  "rain": true,
  "smoke": false,
  "smoke_ppm": 0,
  "voltage": 229.9,
  "current": 1.7,
  "ts": 1760000000
}
```

A status timestamp older than 15 seconds makes the device appear offline. Local notification permission is requested on first launch. Android battery optimization may still limit background monitoring.

## Verification

Everything below was run on this machine on 2026-10-15. Run the quick set with `npm run verify`.

| Check | Command | Result |
|---|---|---|
| App typecheck | `npm run typecheck` | pass |
| App lint, zero warnings | `npm run lint` | pass (was 91 warnings) |
| App unit and integration tests | `npm test` | 97 tests, 10 suites pass |
| Firmware logic tests (host) | `npm run test:firmware` | 36 tests pass |
| Firmware build | `npm run build:firmware` | pass, no warnings; 74 % flash, 14.5 % RAM |
| Rules + auth flow + firmware payloads | `npm run test:rules` (Firebase emulator, needs Java) | 25 tests pass |
| Android bundle / debug APK | Metro bundle; `JAVA_HOME=<jdk17> ./gradlew assembleDebug` | pass |

**On a device:** the debug build was installed and launched on a Motorola Edge 40 (Android 15) over ADB. Because there is
no `google-services.json`, Firebase cannot connect, so what was checked there is the offline behaviour only: the app starts,
shows "Not connected" with a Retry button and "No data" gauges, and the layout fits with the system bars. This found and fixed
a crash (a missing Firebase config threw synchronously inside an effect), a squeezed status card, content under the status bar
and nav bar, and clipped gauge labels.

**Not verified:** live updates from a real database, Android 13+ permission prompts, notifications, the foreground service and
reduce-motion all need a Firebase project (`google-services.json`) and have not been seen working on the phone. The firmware has
never run on an ESP32 (see its README for the list). Real Firebase TLS from the ESP32 is verified only by checking that Google's
served chains validate against the pinned roots with `openssl`.

Known remaining gaps against the documentation suite: Maestro E2E flows, a simulator CLI, Jest
component/render-count/contrast tests, centralised strings, and system navigation-bar colouring are not built.
