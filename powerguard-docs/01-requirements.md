# Requirements

All timing constants referenced here are defined once in [02-architecture.md → Constants](02-architecture.md#constants). Data shapes are in [03-data-model.md](03-data-model.md).

## Functional requirements

### FR-1 Live readings

**Story:** As an operator, I want to see the latest line-fault, rain, smoke, voltage, current and power values, so that I know the state of the installation right now.

**Acceptance criteria:**
- Given the device is online, when `/devices/{id}/live` changes in RTDB, then the dashboard shows the new values within 1 s.
- Given `voltage = 230.4` and `current = 1.82`, when the dashboard renders, then power shows `419 W` (V × A, rounded to the nearest whole watt) and voltage/current show one decimal place (`230.4 V`, `1.8 A`).
- Given `smoke_ppm` is present, when the Smoke tile renders, then it shows the ppm value as a secondary label; given it is absent or null, then no ppm label is shown.
- Given `line_fault = true` and `fault_type = "over_current"`, when the Line Fault tile renders, then it shows the label "Over current".
- Given only one field changes between updates, when the store updates, then components that read unchanged fields do not re-render (verified by a render-count test).

### FR-2 Connectivity status

**Story:** As an operator, I want to know whether the device and my phone are connected, so that I don't trust stale numbers.

**Acceptance criteria:**
- Given the app has just started and no status has arrived, when 0–10 s have passed, then connectivity is `loading` and skeletons are shown.
- Given no status has arrived after 10 s, when the timeout fires, then connectivity becomes `device_offline`.
- Given `now − last_seen ≤ 15 s`, then connectivity is `online`, the connection pill shows "Online" with a pulsing dot and "Updated Ns ago", refreshed every second.
- Given `now − last_seen > 15 s`, then connectivity becomes `device_offline` within 1 s, the pill shows "Device offline", a banner says "No data from device since HH:MM", and live values render in the muted (greyed) style.
- Given `/.info/connected` is `false`, then connectivity is `phone_offline` and the banner says "You're offline. Showing last known data." This takes priority over `device_offline`.
- Given `last_seen` is in milliseconds (value > 10¹²), then it is normalized to seconds before comparison.
- Given `rssi` is present, then the pill shows a 0–4 bar signal indicator; given it is absent, then no indicator is shown.

### FR-3 Threshold evaluation

**Story:** As a technician, I want readings outside safe limits highlighted, so that I notice abnormal voltage or current immediately.

**Acceptance criteria:**
- Given thresholds `voltageMin = 180`, `voltageMax = 260`, when voltage is `< 180` or `> 260`, then voltage level is `danger`.
- Given the same thresholds, when voltage is in `[180, 189)` or `(247, 260]` (within 5% of a limit), then voltage level is `warning`; otherwise `ok`.
- Given `currentMax = 10`, when current is `> 10`, then current level is `danger`; when current is in `(8.5, 10]` (above 85%), then `warning`; otherwise `ok`.
- Given a level, when the gauge renders, then its arc and value color use the `ok`/`warning`/`danger` token and its label reads "Normal" / "Near limit" / "Out of range".
- Threshold breaches change visuals only. They never trigger notifications (see FR-7).

### FR-4 Hero status banner

**Story:** As an operator, I want a single summary of the worst current condition, so that I can tell at a glance whether anything needs attention.

**Acceptance criteria:**
- Given multiple conditions are active, then the banner shows the highest-priority one using this order: `phone_offline` > `device_offline` > `line_fault` > `smoke` > `threshold_danger` > `rain` > `threshold_warning` > `ok`.
- Given the state is `ok`, then the banner is green with the text "All systems normal".
- Given `line_fault` is active, then the banner is red with "Line fault: <Fault type label>".
- Given `smoke` is active, then the banner is red, pulsing (unless reduce-motion is on), with "Smoke detected".
- Given more than one alert is active, then a secondary line lists the others (e.g. "+ Rain detected").

### FR-5 Live chart

**Story:** As a technician, I want to see how voltage and current changed recently, so that I can spot sags, spikes and trends.

**Acceptance criteria:**
- Given the 5 min range, when history loads, then the chart plots all samples with `ts ≥ now − 300` (≤ 30 points at 10 s cadence).
- Given the 1 h range, then the chart plots samples with `ts ≥ now − 3600`, downsampled to ≤ 120 points.
- Given the 24 h range, then the chart plots samples with `ts ≥ now − 86400`, downsampled to ≤ 150 points.
- Given the user touches the chart, then a tooltip shows the time (HH:MM:SS), voltage and current of the nearest point.
- Given fewer than 2 samples in range, then the chart card shows the empty state "Not enough data yet".
- Given the history query fails, then the chart card shows an error state with a "Retry" action that re-runs the query.
- Given the 5 min range is selected, then the chart refreshes when new history entries arrive (live child listener); other ranges refresh when re-selected or on pull-to-refresh.

### FR-6 History events

**Story:** As a technician, I want a list of when faults, smoke and rain started and cleared, so that I can find patterns.

**Acceptance criteria:**
- Given history samples for the last 24 h, then the History screen lists one event per transition of `line_fault`, `smoke` or `rain` (`started` when false→true, `cleared` when true→false), newest first.
- Given events on different days, then they are grouped under day headers ("Today", "Yesterday", or "Mon, 12 Oct").
- Given a filter chip (All / Fault / Smoke / Rain) is selected, then only matching events are shown.
- Given a `line_fault` started event, then its row shows the fault type label.
- Given no events in the window, then the empty state "No events in the last 24 hours" is shown.
- Given the first sample in the window already has a condition `true`, then no `started` event is generated for it (the start happened before the window).

### FR-7 Alerts

**Story:** As an operator, I want a notification and a vibration the moment a fault, smoke or rain starts, so that I can act quickly.

**Acceptance criteria:**
- Given alerts for `smoke` are enabled and connectivity is `online`, when `smoke` becomes `true` on 2 consecutive live updates, then exactly one notification "Smoke detected" is posted on the `critical-alerts` channel and one haptic pulse fires.
- Given `smoke` stays `true` on later updates, then no further notifications are posted.
- Given `smoke` returns to `false` and later becomes `true` again (2 consecutive samples), then a new notification is posted.
- Given `smoke` is `true` for only one sample and then `false`, then no notification is posted (glitch suppression).
- Given alerts for a type are disabled in Settings, then no notification or haptic is produced for that type, but the dashboard still shows the condition.
- Given connectivity is `device_offline` or `phone_offline`, then no alerts are generated from any data.
- Given the app restarts while a condition that was already notified is still `true`, then no new notification is posted (alert state is persisted per device).
- Given the app starts and a condition is already `true` that was never notified, then one notification is posted after the confirmation samples.
- Line fault uses `critical-alerts` with the text "Line fault: <Fault type label>". Rain uses `weather-alerts` with "Rain detected".
- Tapping a notification opens the app on the Dashboard.

### FR-8 Settings

**Story:** As an operator, I want to configure the device, alert types, limits and appearance, so that the app fits my installation.

**Acceptance criteria:**
- Given the Settings screen, then it shows: Device ID, alert toggles (Line fault, Smoke, Rain), voltage min/max sliders, current max slider, Background monitoring toggle, Theme selector (System / Dark / Light).
- Given a change to any setting, then it is saved to AsyncStorage immediately and survives an app restart.
- Given the user enters a device ID that doesn't match `^[A-Za-z0-9_-]{1,64}$`, then the Save button is disabled and an inline error "Use letters, numbers, - or _ (max 64)" is shown.
- Given `voltageMin ≥ voltageMax`, then the sliders prevent it (min slider max = voltageMax − 10; max slider min = voltageMin + 10).
- Slider ranges: voltageMin 0–400 V, voltageMax 10–500 V, currentMax 0.5–100 A (step 0.5). Each slider shows its live value label.
- Given stored settings are missing or corrupt, then defaults are used and the corrupt value is overwritten on next save.

### FR-9 Device switching

**Story:** As an engineer, I want to point the app at a different device ID, so that I can test another unit.

**Acceptance criteria:**
- Given a new valid device ID is saved, then listeners on the old device are removed, the device store resets to `loading`, and listeners attach to the new device's paths.
- Given a new device ID, then alert state for the new device is loaded separately (state is keyed by device ID); the old device's state is untouched.
- Given the new device has no data, then the dashboard shows the `device_offline` state after the 10 s loading timeout.

### FR-10 Background monitoring

**Story:** As an operator, I want the app to keep watching while minimized, so that I get alerts without keeping it open.

**Acceptance criteria:**
- Given the toggle is OFF (default), then no foreground service runs.
- Given the user turns it ON and notification permission is granted, then a foreground service starts with a persistent low-importance notification "PowerGuard is monitoring · <worst state text>" and a "Stop" action.
- Given the service is running and the app is backgrounded, when smoke becomes true (2 samples), then the alert notification is posted exactly once (same alert engine instance as the UI).
- Given the user taps "Stop" on the persistent notification, then the service stops and the Settings toggle shows OFF.
- Given the toggle is ON when the app is launched, then the service is started again.
- Given permission is denied, then the toggle reverts to OFF and an inline message explains why.
- Settings shows a "Battery optimization" row that opens the system battery-optimization settings, with a one-line explanation that some phones may still stop monitoring.

### FR-11 Theme

**Story:** As a user, I want dark and light themes, so that the app is comfortable in any lighting.

**Acceptance criteria:**
- Given theme = System, then the app follows the OS color scheme and updates live when it changes.
- Given theme = Dark or Light, then that theme is used regardless of the OS.
- Given either theme, then all text meets a contrast ratio ≥ 4.5:1 against its background (verified by a token contrast test).
- The status bar and navigation bar colors match the active theme.

### FR-12 Malformed data handling

**Story:** As an operator, I want the app to stay usable if the device sends bad data, so that a firmware bug doesn't crash my monitor.

**Acceptance criteria:**
- Given `/live` is `null` or not an object, then the dashboard shows the "Waiting for device data" empty state and nothing crashes.
- Given a boolean field holds anything other than `true` (e.g. `"true"`, `1`, `null`), then it is treated as `false`.
- Given `voltage` or `current` is missing, a string, `NaN` or infinite, then the last valid value is kept (or `0` if none), and the gauge shows a small "invalid reading" marker.
- Given an unknown `fault_type` string with `line_fault = true`, then the label "Unknown fault" is shown.
- Given `ts` is missing, then the reading is still displayed and `ts` falls back to the receive time.

### FR-13 Startup and authentication

**Story:** As a user, I want the app to open quickly and connect automatically, so that I don't have to sign in.

**Acceptance criteria:**
- Given a cold start, then a splash screen shows, then the skeleton dashboard within 500 ms of JS start.
- Given network is available, then the app signs in anonymously and receives first live data within 2 s of sign-in on a normal connection.
- Given anonymous sign-in fails, then the dashboard shows an error state "Couldn't connect to the server" with a "Retry" action that retries sign-in.
- Given the user is already signed in from a previous session, then no new sign-in request is made.

### FR-14 Notification permission

**Story:** As a user on Android 13+, I want to be asked for notification permission at a sensible moment, so that alerts can reach me.

**Acceptance criteria:**
- Given Android 13+ and permission not yet decided, then the app requests `POST_NOTIFICATIONS` once after the dashboard first shows live data (not at splash).
- Given permission is denied, then a dismissible card on the Dashboard says "Alerts are off. Enable notifications to get fault and smoke alerts." with an "Open settings" action.
- Given Android 12 or lower, then no runtime prompt is shown.

## Non-functional requirements

| ID | Category | Requirement (measurable) |
|---|---|---|
| NFR-1 | Latency | RTDB write → dashboard update ≤ 1 s (p95) on normal Wi-Fi/4G |
| NFR-2 | Performance | Dashboard animations ≥ 55 fps average on a mid-range device; JS thread not blocked > 50 ms by a live update |
| NFR-3 | Rendering | A single-field live update re-renders only the components that read that field |
| NFR-4 | Startup | Skeleton visible < 500 ms after JS start; first live data < 2 s after sign-in |
| NFR-5 | Reliability | Zero crashes across all fixtures in [03-data-model.md → Fixtures](03-data-model.md#seed--fixture-data), including malformed ones |
| NFR-6 | Accessibility | Text contrast ≥ 4.5:1; touch targets ≥ 48 dp; every state conveyed by icon + text, never color alone; all interactive elements have accessibility labels |
| NFR-7 | Motion | All non-essential animation disabled when the OS reduce-motion setting is on |
| NFR-8 | Compatibility | minSdk 24; latest stable targetSdk; works on Android 7.0 through current |
| NFR-9 | Cost | Runs on Firebase Spark plan; no paid services |
| NFR-10 | Security | No secrets in the repo; the app cannot write to `/devices/**` (enforced by rules, tested) |
| NFR-11 | Size | Release APK (single ABI, arm64-v8a) ≤ 30 MB `[ASSUMPTION]` |
| NFR-12 | Code quality | TypeScript strict, no `any` in `src/types` or `src/domain`; ESLint clean |

## Traceability

Build tasks are defined in [08-build-plan.md](08-build-plan.md). Test files follow the naming in [07-testing-strategy.md](07-testing-strategy.md#test-locations-and-naming).

| Requirement | Build task(s) | Test(s) |
|---|---|---|
| FR-1 | T-05, T-10, T-14, T-17 | `parsers.test.ts`, `derive.test.ts`, `DashboardScreen.test.tsx`, `deviceStore.render.test.tsx`, E2E `01-live-dashboard.yaml` |
| FR-2 | T-10, T-14, T-17 | `connectivity.test.ts`, `ConnectionPill.test.tsx`, E2E `03-offline.yaml` |
| FR-3 | T-06, T-14 | `derive.test.ts`, `ArcGauge.test.tsx` |
| FR-4 | T-06, T-14, T-17 | `derive.test.ts` (worstState), `HeroStatusBanner.test.tsx` |
| FR-5 | T-07, T-11, T-15, T-17 | `downsample.test.ts`, `useHistory.test.ts`, `LiveChart.test.tsx` |
| FR-6 | T-07, T-11, T-18 | `events.test.ts`, `HistoryScreen.test.tsx`, E2E `04-history.yaml` |
| FR-7 | T-08, T-20 | `alertEngine.test.ts`, `alertWiring.test.ts`, E2E `02-alerts.yaml` |
| FR-8 | T-09, T-19 | `settingsStore.test.ts`, `SettingsScreen.test.tsx`, E2E `05-settings.yaml` |
| FR-9 | T-10, T-19 | `deviceStore.test.ts` (switchDevice), E2E `05-settings.yaml` |
| FR-10 | T-21 | `background.test.ts`, manual check M-3 |
| FR-11 | T-12, T-19 | `tokens.contrast.test.ts`, `ThemeProvider.test.tsx` |
| FR-12 | T-05 | `parsers.test.ts` (malformed fixtures), E2E `06-malformed.yaml` |
| FR-13 | T-04, T-17 | `firebase.test.ts`, `DashboardScreen.test.tsx` (error state) |
| FR-14 | T-20 | `notifications.test.ts`, manual check M-2 |
| NFR-2, NFR-3 | T-10, T-24 | `deviceStore.render.test.tsx`, manual check M-4 |
| NFR-6, NFR-7 | T-12, T-24 | `tokens.contrast.test.ts`, `a11y.test.tsx`, manual check M-5 |
| NFR-10 | T-03 | `rules.test.ts` |
