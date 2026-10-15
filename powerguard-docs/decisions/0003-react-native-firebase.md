# 0003 — @react-native-firebase instead of the Firebase JS SDK

- Status: accepted
- Date: 2026-10-15

## Context
Listeners must stay reliable while the app is backgrounded (with the foreground service), and the app benefits from an on-disk offline cache.

## Options considered
- **@react-native-firebase (native SDK wrapper)** — native listeners, `setPersistenceEnabled`, `.info/connected`, emulator support. Cons: requires `google-services.json` and Gradle plugin.
- **Firebase JS SDK (modular)** — no native setup. Cons: weaker background behavior, no native disk persistence for RTDB in RN, more JS-thread work.

## Decision
`@react-native-firebase/app`, `/auth`, `/database`.

## Consequences
- Each environment needs its own `google-services.json` (kept out of git; a placeholder `google-services.demo.json` is committed for E2E/CI).
- Regional databases may need `FIREBASE_DATABASE_URL` passed to `database(url)`.
