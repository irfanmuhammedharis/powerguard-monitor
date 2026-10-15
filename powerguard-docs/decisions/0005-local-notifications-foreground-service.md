# 0005 — Local notifications + optional foreground service instead of FCM push

- Status: accepted (v1)
- Date: 2026-10-15

## Context
Alerts must reach the user when a fault, smoke or rain event starts. Server-side push needs a trigger on the server (Cloud Functions), which requires the paid Blaze plan. v1 must stay on Spark.

## Options considered
- **Local notifications (Notifee) + opt-in foreground service** — free; works while the app is open or the service is running. Cons: no alerts when the app is force-stopped or the OEM kills the service; persistent notification while enabled.
- **FCM via Cloud Functions on RTDB triggers** — works when the app is killed; low battery use. Cons: Blaze plan; token management; server code to maintain.

## Decision
Local notifications with an opt-in foreground service (default OFF).

Foreground service type: **`specialUse`** `[ASSUMPTION]`, with `FOREGROUND_SERVICE_SPECIAL_USE` permission and a `PROPERTY_SPECIAL_USE_FGS_SUBTYPE` value such as "Continuous monitoring of user-owned IoT sensor alerts". Reason: from Android 15 (targetSdk 35), `dataSync` foreground services are limited to about 6 hours per 24 hours, which breaks continuous monitoring. The Android 14+ manifest requirements were checked against the [current Android foreground-service type documentation](https://developer.android.com/develop/background-work/services/fgs/service-types) and [Notifee's foreground-service documentation](https://notifee.app/react-native/docs/foreground-service/). Notifee's service declaration is overridden in the app manifest (`tools:replace="android:foregroundServiceType"`), and notifications pass the matching `foregroundServiceTypes`. Google Play's review of the declared special use remains a release-time check.

## Consequences
- Alerts are best-effort; the app states it is a monitoring aid, not a certified safety system.
- Settings links to battery-optimization settings.
- Google Play requires a justification for `specialUse` in the Console declaration.
- Revisit for safety-critical deployments: FCM is the first item in Future work.
