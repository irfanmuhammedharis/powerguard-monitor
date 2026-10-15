# Security

## Authentication

| Principal | Mechanism | Lifetime / storage |
|---|---|---|
| **App user** | Firebase Anonymous Auth via `auth().signInAnonymously()` ([ADR-0007](decisions/0007-anonymous-auth.md)) | Session persisted by the Firebase SDK on the device. `ensureSignedIn()` reuses `auth().currentUser` if present; tokens refresh automatically. |
| **ESP32** | Dedicated Firebase email/password user (e.g. `device-esp32_01@<project>.local`), created in the Firebase console | Credentials live only in the firmware's `secrets.h` (out of scope here). Its uid is stored at `/config/writers/{deviceId}`. |
| **Developer simulator** | Firebase Admin SDK (service-account JSON via `GOOGLE_APPLICATION_CREDENTIALS`) or emulator | Bypasses rules. Dev machine only; never in the app bundle. |

Firebase console settings required: **Anonymous** and **Email/Password** sign-in providers enabled.

## Authorization

| Path | App user (anonymous) | ESP32 user | Anyone unauthenticated |
|---|---|---|---|
| `/devices/{id}/live` | read | read, write | none |
| `/devices/{id}/status` | read | read, write | none |
| `/devices/{id}/history` | read | read, write | none |
| `/config/**` | none | none | none (console/admin only) |
| anything else | none | none | none |

### RTDB rules

File: `firebase/database.rules.json`. Deploy with `firebase deploy --only database`.

```json
{
  "rules": {
    ".read": false,
    ".write": false,
    "devices": {
      "$deviceId": {
        ".read": "auth != null",
        ".validate": "$deviceId.matches(/^[A-Za-z0-9_-]{1,64}$/)",
        "live": {
          ".write": "auth != null && auth.uid === root.child('config/writers').child($deviceId).val()",
          ".validate": "newData.hasChildren(['line_fault','fault_type','rain','smoke','voltage','current','ts'])",
          "line_fault": { ".validate": "newData.isBoolean()" },
          "fault_type": { ".validate": "newData.isString() && newData.val().length <= 32" },
          "rain":       { ".validate": "newData.isBoolean()" },
          "smoke":      { ".validate": "newData.isBoolean()" },
          "smoke_ppm":  { ".validate": "newData.isNumber() && newData.val() >= 0" },
          "voltage":    { ".validate": "newData.isNumber()" },
          "current":    { ".validate": "newData.isNumber()" },
          "ts":         { ".validate": "newData.isNumber()" },
          "$other":     { ".validate": false }
        },
        "status": {
          ".write": "auth != null && auth.uid === root.child('config/writers').child($deviceId).val()",
          ".validate": "newData.hasChild('last_seen')",
          "last_seen": { ".validate": "newData.isNumber()" },
          "rssi":      { ".validate": "newData.isNumber()" },
          "$other":    { ".validate": false }
        },
        "history": {
          ".write": "auth != null && auth.uid === root.child('config/writers').child($deviceId).val()",
          ".indexOn": ["ts"],
          "$key": {
            ".validate": "newData.hasChildren(['voltage','current','ts'])"
          }
        }
      }
    },
    "config": {
      ".read": false,
      ".write": false
    }
  }
}
```

Notes:
- The `.validate` rules protect against firmware bugs writing garbage. The app still parses defensively, because rules can be relaxed in a test project.
- `/config/writers/{deviceId}` is set once from the Firebase console (admin bypasses rules).
- If the firmware team cannot meet the strict `$other: false` validation during bring-up, they may temporarily remove those lines in a dev project only. Production keeps them `[ASSUMPTION]`.

## Secrets & config

| Item | Where it lives | In git? |
|---|---|---|
| `android/app/google-services.json` | Downloaded from the Firebase console | **No**, gitignored. README explains how to get it. |
| `.env`, `.env.e2e` | Repo root, created from `.env.example` | **No**, gitignored |
| Release keystore (`powerguard-release.keystore`) | Outside the repo (e.g. `~/keystores/`) | **No** |
| Keystore passwords | `~/.gradle/gradle.properties` or CI secrets: `PG_UPLOAD_STORE_FILE`, `PG_UPLOAD_STORE_PASSWORD`, `PG_UPLOAD_KEY_ALIAS`, `PG_UPLOAD_KEY_PASSWORD` | **No** |
| Service-account JSON (simulator, project mode) | Developer machine, path in `GOOGLE_APPLICATION_CREDENTIALS` | **No** |
| `firebase/.firebaserc` | Local; from `.firebaserc.example` | **No** |

`.gitignore` must include: `android/app/google-services.json`, `.env`, `.env.*` (but not `.env.example`), `*.keystore`, `*.jks`, `firebase/.firebaserc`, `service-account*.json`.

Google API keys inside `google-services.json` are not secret in the usual sense; access is controlled by the rules above. They are still kept out of git so the repo can be shared.

## Data protection

- **In transit:** Firebase uses TLS for all traffic. Cleartext traffic is disabled (`android:usesCleartextTraffic="false"`), except a debug-only network security config that allows `10.0.2.2` and `localhost` for the emulator.
- **At rest (cloud):** Firebase encrypts at rest by default.
- **At rest (device):** AsyncStorage holds only settings and alert flags. Nothing personal or secret.
- **Personal data:** none. No names, emails, location or phone identifiers are collected. The anonymous uid is never displayed and never logged in release builds.
- **Logs:** release builds log only `warn`/`error` without payloads.
- **Backups:** `android:allowBackup="false"` `[ASSUMPTION]`, so settings don't restore onto other devices with stale device IDs.

## Threat model

| # | Threat (STRIDE) | Scenario | Mitigation |
|---|---|---|---|
| T1 | Tampering | A user extracts the API key and writes fake "all normal" data | Rules allow writes only from the whitelisted ESP32 uid; rules tests prove it |
| T2 | Spoofing | Someone signs in as the ESP32 | ESP32 credentials only in firmware; strong unique password; rotate if a unit is lost |
| T3 | Information disclosure | Anyone with the APK and project config can sign in anonymously and read telemetry | Accepted for v1 (non-sensitive data, [ADR-0007](decisions/0007-anonymous-auth.md)); v2 adds real accounts and per-user access |
| T4 | Denial of service | Mass anonymous sign-ins or reads | Firebase quotas; enable App Check (Play Integrity) in v2 `[TODO]` |
| T5 | Tampering (data quality) | Firmware bug writes malformed values | `.validate` rules + defensive parsers + malformed-data tests |
| T6 | Repudiation / safety | User relies on the app as a safety system and misses an alert while the phone is off or the app is killed | Clear in-app statement in Settings → About: "PowerGuard is a monitoring aid, not a certified safety system." Background limitations documented. |
| T7 | Elevation of privilege | Debug emulator config shipped in release | Emulator use gated by `appConfig.useEmulator`, which is forced `false` when `!__DEV__` and not an E2E build; release network config disallows cleartext |
| T8 | Information disclosure | Secrets committed to git | `.gitignore` rules; a pre-commit check (`git secrets`-style grep for `private_key`, `storePassword`) in CI |

## Compliance

No regulated personal data is processed. GDPR, India's DPDP Act 2023 and similar regimes have minimal impact because nothing personal is collected. If v2 adds accounts, revisit this section (privacy policy, consent, data deletion).

Google Play requirements that apply:
- **Foreground service type declaration:** `specialUse` ([ADR-0005](decisions/0005-local-notifications-foreground-service.md)) with a justification in the Play Console ("continuous monitoring of user-owned IoT sensor alerts, enabled by the user").
- **Notification permission** handling on Android 13+.
- **Data safety form:** "No data collected" (anonymous auth uid is not linked to the user), consistent with the above `[ASSUMPTION]`; confirm before Play submission `[TODO]`.
