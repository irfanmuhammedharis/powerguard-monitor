# Graph Report - .  (2026-10-15)

## Corpus Check
- 122 files · ~54,666 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 822 nodes · 1556 edges · 79 communities (63 shown, 16 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 123 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_UI Gauge Components|UI Gauge Components]]
- [[_COMMUNITY_Alert Controller|Alert Controller]]
- [[_COMMUNITY_App Shell and Tabs|App Shell and Tabs]]
- [[_COMMUNITY_Bootstrap and Device Feed|Bootstrap and Device Feed]]
- [[_COMMUNITY_Firmware Cloud Task|Firmware Cloud Task]]
- [[_COMMUNITY_Calibration CLI|Calibration CLI]]
- [[_COMMUNITY_Fault Detector Tests|Fault Detector Tests]]
- [[_COMMUNITY_App Dependencies|App Dependencies]]
- [[_COMMUNITY_Dev Dependencies|Dev Dependencies]]
- [[_COMMUNITY_Alerts and Live Flow|Alerts and Live Flow]]
- [[_COMMUNITY_Device Model Parsing|Device Model Parsing]]
- [[_COMMUNITY_ADR-0010 Firmware Design|ADR-0010 Firmware Design]]
- [[_COMMUNITY_Firebase Rules Tests|Firebase Rules Tests]]
- [[_COMMUNITY_Zustand State and Settings|Zustand State and Settings]]
- [[_COMMUNITY_History Retention|History Retention]]
- [[_COMMUNITY_Product Brief and Reliability|Product Brief and Reliability]]
- [[_COMMUNITY_Status Derivation UI|Status Derivation UI]]
- [[_COMMUNITY_RN CLI and RTDB Decisions|RN CLI and RTDB Decisions]]
- [[_COMMUNITY_Notifications and Storage|Notifications and Storage]]
- [[_COMMUNITY_Testing and CI|Testing and CI]]
- [[_COMMUNITY_Test Tooling ADR|Test Tooling ADR]]
- [[_COMMUNITY_Firmware Verification Gaps|Firmware Verification Gaps]]
- [[_COMMUNITY_NPM Scripts|NPM Scripts]]
- [[_COMMUNITY_Charts and History Events|Charts and History Events]]
- [[_COMMUNITY_Firmware Shared State|Firmware Shared State]]
- [[_COMMUNITY_Domain Layer Concepts|Domain Layer Concepts]]
- [[_COMMUNITY_MQ-135 Gas Math|MQ-135 Gas Math]]
- [[_COMMUNITY_Live Payload Builder|Live Payload Builder]]
- [[_COMMUNITY_Theme and Accessibility|Theme and Accessibility]]
- [[_COMMUNITY_Malformed Data Handling|Malformed Data Handling]]
- [[_COMMUNITY_AC RMS Accumulator|AC RMS Accumulator]]
- [[_COMMUNITY_Status and History Payload|Status and History Payload]]
- [[_COMMUNITY_Firmware Hardware README|Firmware Hardware README]]
- [[_COMMUNITY_Architecture Constants|Architecture Constants]]
- [[_COMMUNITY_Sensor Sampling Task|Sensor Sampling Task]]
- [[_COMMUNITY_Startup and Auth|Startup and Auth]]
- [[_COMMUNITY_Changelog and Blocked Work|Changelog and Blocked Work]]
- [[_COMMUNITY_Debounce Helpers|Debounce Helpers]]
- [[_COMMUNITY_Fault Detector Core|Fault Detector Core]]
- [[_COMMUNITY_Background Monitoring|Background Monitoring]]
- [[_COMMUNITY_TypeScript Config|TypeScript Config]]
- [[_COMMUNITY_Android MainActivity|Android MainActivity]]
- [[_COMMUNITY_Security and Setup Docs|Security and Setup Docs]]
- [[_COMMUNITY_Device Switching|Device Switching]]
- [[_COMMUNITY_Android MainApplication|Android MainApplication]]
- [[_COMMUNITY_Security Threat Model|Security Threat Model]]
- [[_COMMUNITY_Package Manifest|Package Manifest]]
- [[_COMMUNITY_Root README Overview|Root README Overview]]
- [[_COMMUNITY_RMS Unit Tests|RMS Unit Tests]]
- [[_COMMUNITY_RTDB Read Contract|RTDB Read Contract]]
- [[_COMMUNITY_Firmware Payload Fixture|Firmware Payload Fixture]]
- [[_COMMUNITY_Misc The verify loop|Misc: The verify loop]]
- [[_COMMUNITY_Misc namespace|Misc: namespace]]
- [[_COMMUNITY_Misc namespace|Misc: namespace]]
- [[_COMMUNITY_Misc namespace|Misc: namespace]]
- [[_COMMUNITY_Misc namespace|Misc: namespace]]
- [[_COMMUNITY_Misc namespace|Misc: namespace]]
- [[_COMMUNITY_Misc namespace|Misc: namespace]]
- [[_COMMUNITY_Misc namespace|Misc: namespace]]
- [[_COMMUNITY_Misc namespace|Misc: namespace]]
- [[_COMMUNITY_Misc metro.config.js|Misc: metro.config.js]]
- [[_COMMUNITY_Misc NFR-7 Reduce-motion support|Misc: NFR-7 Reduce-motion support]]
- [[_COMMUNITY_Misc Status LED patterns|Misc: Status LED patterns]]
- [[_COMMUNITY_Misc 03 Data Model|Misc: 03 Data Model]]
- [[_COMMUNITY_Misc 04 API  Interface Spec|Misc: 04 API / Interface Spec]]
- [[_COMMUNITY_Misc 05 UI  UX|Misc: 05 UI / UX]]
- [[_COMMUNITY_Misc Typography (Inter, JetBrains M|Misc: Typography (Inter, JetBrains M]]
- [[_COMMUNITY_Misc 06 Security|Misc: 06 Security]]

## God Nodes (most connected - your core abstractions)
1. `Firebase` - 21 edges
2. `ADR-0005 Local Notifications and Foreground Service` - 16 edges
3. `RTDB security rules (database.rules.json)` - 16 edges
4. `DashboardScreen()` - 15 edges
5. `cloudTask()` - 13 edges
6. `AGENTS.md (AI agent operating manual)` - 13 edges
7. `ADR-0008 History Retention and Server Timestamps` - 13 edges
8. `ADR-0010 Firmware Design` - 13 edges
9. `run()` - 12 edges
10. `scripts` - 12 edges

## Surprising Connections (you probably didn't know these)
- `Setup and requirements (Node 22, JDK 17, RN 0.84, minSdk 24)` --semantically_similar_to--> `Firebase project setup (one-time)`  [INFERRED] [semantically similar]
  README.md → powerguard-docs/09-deployment-ops.md
- `powerguard_core pure library (no Arduino dependency)` --semantically_similar_to--> `alertEngine (pure reduceAlerts reducer)`  [INFERRED] [semantically similar]
  fault detection/README.md → powerguard-docs/02-architecture.md
- `Fault classification and debounce (short, over_current, over_voltage, open_line, under_voltage)` --semantically_similar_to--> `alertEngine (pure reduceAlerts reducer)`  [INFERRED] [semantically similar]
  fault detection/README.md → powerguard-docs/02-architecture.md
- `Project Layout (src/domain, core, store, hooks, ...)` --semantically_similar_to--> `Repository layout`  [INFERRED] [semantically similar]
  README.md → powerguard-docs/02-architecture.md
- `Simulate data by pasting into Firebase console` --semantically_similar_to--> `Simulator scenarios (healthy, line-fault, smoke, rain, glitch, malformed, stale, history-24h, ...)`  [INFERRED] [semantically similar]
  README.md → powerguard-docs/03-data-model.md

## Import Cycles
- 1-file cycle: `metro.config.js -> metro.config.js`

## Hyperedges (group relationships)
- **Live update to alert pipeline (RTDB to notification)** — powerguard_docs_02_architecture_subscription_manager, powerguard_docs_02_architecture_parsers, powerguard_docs_02_architecture_device_store, powerguard_docs_02_architecture_alert_controller, powerguard_docs_02_architecture_alert_engine, powerguard_docs_02_architecture_notification_service, powerguard_docs_02_architecture_haptic_service [EXTRACTED 1.00]
- **Shared ESP32/Firebase/App data contract** — fault_detection_readme_esp32_firmware, powerguard_docs_03_data_model_rtdb_schema, powerguard_docs_06_security_rtdb_rules, powerguard_docs_04_api_spec_parsing_rules, powerguard_docs_03_data_model_simulator_scenarios [INFERRED 0.85]
- **Layered verification stack (unit, rules, E2E, manual, CI gate)** — powerguard_docs_07_testing_strategy_verify_loop, powerguard_docs_07_testing_strategy_rules_tests, powerguard_docs_07_testing_strategy_e2e_flows, powerguard_docs_07_testing_strategy_manual_checks, powerguard_docs_07_testing_strategy_ci_gate, powerguard_docs_07_testing_strategy_coverage_gates [EXTRACTED 1.00]
- **History retention flow: firmware ring buffer, server timestamps and app ts-ordered queries** — decisions_0008_history_retention_and_server_timestamps_ring_buffer, decisions_0008_history_retention_and_server_timestamps_server_timestamp, decisions_0008_history_retention_and_server_timestamps_order_by_ts, decisions_0010_firmware_design, powerguard_docs_changelog_history_query_fix [EXTRACTED 1.00]
- **Spark free-plan driven architecture: RTDB, local notifications, no Cloud Functions** — decisions_0002_firebase_realtime_database_spark_plan, decisions_0002_firebase_realtime_database_rtdb, decisions_0005_local_notifications_foreground_service_notifee, decisions_0008_history_retention_and_server_timestamps_ring_buffer [INFERRED 0.85]
- **Test and verification pipeline: Jest/RNTL, rules tests, Firebase emulator, Maestro, manual checks** — decisions_0009_testing_maestro_firebase_emulator_jest_rntl, decisions_0009_testing_maestro_firebase_emulator_rules_testing, decisions_0009_testing_maestro_firebase_emulator_emulator_suite, decisions_0009_testing_maestro_firebase_emulator_maestro, decisions_0009_testing_maestro_firebase_emulator_manual_checks, powerguard_docs_agents_build_loop [EXTRACTED 1.00]

## Communities (79 total, 16 thin omitted)

### Community 0 - "UI Gauge Components"
Cohesion: 0.08
Nodes (44): ArcGauge(), s, ConnectionPill(), LABEL, s, SignalBars(), LineChart(), Props (+36 more)

### Community 1 - "Alert Controller"
Cohesion: 0.07
Nodes (48): dispatch(), evaluate(), load(), resetAlertControllerForTests(), startAlertController(), deliver(), flush(), startOnline() (+40 more)

### Community 2 - "App Shell and Tabs"
Cohesion: 0.06
Nodes (39): s, Shell(), Tabs, Card(), styles, ErrorBoundary, s, State (+31 more)

### Community 3 - "Bootstrap and Device Feed"
Cohesion: 0.10
Nodes (29): displayName, name, bootstrap(), run(), FeedError, FeedState, feedStore, fresh() (+21 more)

### Community 4 - "Firmware Cloud Task"
Cohesion: 0.11
Nodes (20): LiveSample, String, JsonDocument, Snapshot, cloudTask(), due(), ensureTime(), Firebase (+12 more)

### Community 5 - "Calibration CLI"
Cohesion: 0.17
Nodes (20): Calibration, Calibration, clearCalibration(), loadCalibration(), sane(), saveCalibration(), calCurrent(), calMq() (+12 more)

### Community 6 - "Fault Detector Tests"
Cohesion: 0.13
Nodes (12): FaultType, FaultDetector, run(), test_fault_clears_only_after_staying_in_limits(), test_fault_dead_line_is_open_line_not_under_voltage(), test_fault_hysteresis_prevents_chatter_near_the_limit(), test_fault_normal_operation_stays_clear(), test_fault_over_and_under_voltage() (+4 more)

### Community 7 - "App Dependencies"
Cohesion: 0.11
Nodes (19): dependencies, @notifee/react-native, react, react-native, @react-native-async-storage/async-storage, @react-native-community/slider, @react-native-firebase/app, @react-native-firebase/auth (+11 more)

### Community 8 - "Dev Dependencies"
Cohesion: 0.11
Nodes (19): devDependencies, @babel/core, @babel/preset-env, @babel/runtime, eslint, jest, prettier, @react-native/babel-preset (+11 more)

### Community 9 - "Alerts and Live Flow"
Cohesion: 0.18
Nodes (18): TLS with pinned Google roots (GTS Root R1/R4) and NTP-first, FR-14 Notification permission, FR-7 Alerts (2-sample confirm, dedupe, persisted), alertController (store subscriber, persists state, dispatches effects), alertEngine (pure reduceAlerts reducer), hapticService, Live update and alert flow, Notification channels (critical-alerts, weather-alerts, monitoring-service) (+10 more)

### Community 10 - "Device Model Parsing"
Cohesion: 0.20
Nodes (13): EMPTY_READING, faults, numeric(), parseHistory(), parseLive(), parseLiveDetailed(), parseStatus(), valid (+5 more)

### Community 11 - "ADR-0010 Firmware Design"
Cohesion: 0.17
Nodes (17): Dedicated email/password ESP32 user with whitelisted writes, ADR-0010 Firmware Design, Calibration-gated alarms (cal v, cal mq, NVS, no auto-calibration), Derived line fault (short, over_current, over_voltage, open_line, under_voltage), MQ-135 gives CO2-equivalent index, smoke_ppm absent shown as CLEAR, Firmware plain REST client (HTTPClient, no Firebase-ESP-Client), Sensors: ZMPT101B, SCT-013-015, MQ-135, rain plate, TLS verification with GTS Root R1 and R4 (+9 more)

### Community 12 - "Firebase Rules Tests"
Cohesion: 0.12
Nodes (9): assert, coreSrc, { execFileSync }, fs, os, path, payloads, repoRoot (+1 more)

### Community 13 - "Zustand State and Settings"
Cohesion: 0.21
Nodes (15): ADR-0004 Zustand State, Redux Toolkit and React Context (rejected), FR-1 Live readings, FR-8 Settings, bootstrap (idempotent runtime startup), settingsStore (Zustand + persist), Settings model and validateSettings, App icon and splash (+7 more)

### Community 14 - "History Retention"
Cohesion: 0.17
Nodes (15): LiveChart component, react-native-svg + Reanimated, ADR-0008 History Retention and Server Timestamps, App history queries via orderByChild(ts) and toSeconds(), push() with manual or Cloud Function cleanup (rejected), 8640-slot history ring buffer (24 h), 24 h ring-buffer history (8640 slots, slot=(ts/10) mod 8640), Chart and history pipeline (+7 more)

### Community 15 - "Product Brief and Reliability"
Cohesion: 0.18
Nodes (15): Firmware reliability (watchdog, reboot, token refresh, back-off), 00 Product Brief, Jobs to be done, MVP scope, Out of scope (firmware, iOS, writes, FCM, analytics), Problem statement (signals not seen in time), Success metrics (<=1 s latency, 16 s offline detection, 99.5% crash-free), Target personas (operator, technician, HexCodePlus engineer) (+7 more)

### Community 16 - "Status Derivation UI"
Cohesion: 0.25
Nodes (15): FR-2 Connectivity status, FR-3 Threshold evaluation, FR-4 Hero status banner (worst-state priority), derive (power, levels, worstState, labels), ArcGauge, ConnectionPill, Core components (Card, AppText, Skeleton, Slider, ...), Dashboard screen (+7 more)

### Community 17 - "RN CLI and RTDB Decisions"
Cohesion: 0.18
Nodes (14): ADR-0001 React Native CLI, React Native CLI bare workflow (TypeScript, New Architecture, Hermes), Expo managed workflow (rejected), ADR-0002 Firebase Realtime Database, Cloud Firestore (rejected), Firebase Realtime Database (RTDB), Firebase Spark Free Plan constraint, ADR-0003 React Native Firebase (+6 more)

### Community 18 - "Notifications and Storage"
Cohesion: 0.18
Nodes (14): Settings persisted to AsyncStorage key pg:settings:v1, Zustand (deviceStore, settingsStore), ADR-0005 Local Notifications and Foreground Service, Android foreground-service types documentation, FCM via Cloud Functions (deferred, Blaze plan), Notifee local notifications, Notifee foreground-service documentation, Foreground service type specialUse (+6 more)

### Community 19 - "Testing and CI"
Cohesion: 0.18
Nodes (14): NFR-11 Release APK <= 30 MB (arm64), Secrets and config handling, CI gate (typecheck, lint, coverage, rules, debug build), E2E environment (demo-powerguard emulator, .env.e2e, adb reverse), Maestro E2E flows 01-06, Manual checks M-1 to M-5, T-22 E2E flows, T-23 Release build and README (+6 more)

### Community 20 - "Test Tooling ADR"
Cohesion: 0.24
Nodes (13): ADR-0009 Testing: Maestro + Firebase Emulator, Firebase Emulator Suite (demo-powerguard), Jest + React Native Testing Library, Maestro E2E flows, Manual checks M-2 to M-4 (notifications, FGS, jank), @firebase/rules-unit-testing, AGENTS.md (AI agent operating manual), Per-task Build Loop (+5 more)

### Community 21 - "Firmware Verification Gaps"
Cohesion: 0.21
Nodes (13): Firebase over REST, no Firebase library, Firmware tests (pio test native, pio run, test:rules, npm test), Firmware not tested on real ESP32 hardware, NFR-10 Security: app cannot write /devices/**, HistorySampleRaw, QUERY /devices/{id}/history (orderByChild ts), Timestamp unit detection (seconds vs ms, re-query), Authorization matrix (+5 more)

### Community 22 - "NPM Scripts"
Cohesion: 0.17
Nodes (12): scripts, android, build:android:debug, build:firmware, lint, start, test, test:coverage (+4 more)

### Community 23 - "Charts and History Events"
Cohesion: 0.29
Nodes (11): ADR-0006 Custom SVG Charts, gifted-charts / Victory Native / Skia (rejected), FR-5 Live chart, FR-6 History events, downsample (LTTB), events (extractEvents / groupEventsByDay), History screen, LiveChart (dual-axis SVG) (+3 more)

### Community 24 - "Firmware Shared State"
Cohesion: 0.42
Nodes (10): Calibration, NetStatus, calibration(), init(), lock(), net(), publish(), setCalibration() (+2 more)

### Community 25 - "Domain Layer Concepts"
Cohesion: 0.24
Nodes (10): ArcGauge component, last_seen as Firebase server timestamp (.sv), /status written only after /live succeeds, Pure Domain Layer (src/domain), Connectivity (loading, online, device_offline, phone_offline), History Event (HistoryEvent), Level (ok, warning, danger), Device Status (/status, DeviceStatus) (+2 more)

### Community 26 - "MQ-135 Gas Math"
Cohesion: 0.24
Nodes (9): Mq135Params, mq135Ppm(), mq135R0FromCleanAir(), mq135RsKohm(), test_mq135_clean_air_calibration_reads_400ppm(), test_mq135_ppm_is_clamped_and_safe(), test_mq135_ppm_rises_as_resistance_falls(), test_mq135_rejects_railed_readings() (+1 more)

### Community 27 - "Live Payload Builder"
Cohesion: 0.31
Nodes (10): LiveSample, LiveSample, buildLiveJson(), healthy(), test_live_json_fault_smoke_and_rain(), test_live_json_forces_fault_type_none_when_no_fault(), test_live_json_matches_the_documented_example(), test_live_json_never_emits_nan_or_negative_current() (+2 more)

### Community 28 - "Theme and Accessibility"
Cohesion: 0.24
Nodes (10): FR-11 Theme, NFR-6 Accessibility (contrast 4.5:1, 48 dp targets), ThemeProvider, Accessibility and responsiveness, Design direction (control room look), Design tokens (color, spacing, radius), Coverage gates, Testing philosophy and pyramid (+2 more)

### Community 29 - "Malformed Data Handling"
Cohesion: 0.29
Nodes (10): FR-12 Malformed data handling, NFR-5 Zero crashes across all fixtures, parsers (never throw), useHistory hook, TypeScript models (src/types/models.ts), Unit test fixtures and factories, Parsing rules (toSeconds, parseLiveReading, parseStatus, parseHistory), T-02 Domain foundation (types, constants, time, errors) (+2 more)

### Community 30 - "AC RMS Accumulator"
Cohesion: 0.25
Nodes (4): scaleAc(), test_scaleAc_applies_gain(), test_scaleAc_deadband_and_noise_floor_give_exact_zero(), test_scaleAc_subtracts_noise_in_quadrature()

### Community 31 - "Status and History Payload"
Cohesion: 0.31
Nodes (8): buildStatusJson(), finish(), finiteOrZero(), historyKey(), historySlot(), test_history_ring_buffer_slots(), test_history_slots_stay_in_range_for_far_future_timestamps(), test_status_json_variants()

### Community 32 - "Firmware Hardware README"
Cohesion: 0.33
Nodes (9): Firmware README (PowerGuard field unit), GPIO / ADC1 pin map (34,35,32,33,27,2), Analog front-end design (dividers, bias network), ESP32 Firmware (PowerGuard field unit), MQ-135 smoke/gas sensor, Rain water detector (switched supply), SCT-013-015 current transformer, ZMPT101B voltage sensor (+1 more)

### Community 33 - "Architecture Constants"
Cohesion: 0.28
Nodes (9): Published RTDB paths and cadence (live 2s, status 2s, history 10s), Connectivity model and computeConnectivity, Shared constants (LIVE_INTERVAL_S, OFFLINE_THRESHOLD_S, ALERT_CONFIRM_SAMPLES, ...), Layered architecture (UI, State, Runtime core, Domain, Services), Repository layout, useConnectivity hook (1 s tick), Domain module interfaces, Incident: app shows Device offline but device seems on (+1 more)

### Community 34 - "Sensor Sampling Task"
Cohesion: 0.44
Nodes (8): AcAccumulator, biasOk(), configurePins(), readAverageMv(), readRainMv(), sampleAcWindow(), sensorTask(), start()

### Community 35 - "Startup and Auth"
Cohesion: 0.28
Nodes (9): FR-13 Startup and authentication, Cross-cutting concerns (config, time, errors, logging, strings, theming, perf, a11y), firebaseService, Startup flow, Error model (AppError, AppErrorCode), Firebase mock contract, T-04 Firebase integration in app, Build-time configuration keys (.env, appConfig) (+1 more)

### Community 36 - "Changelog and Blocked Work"
Cohesion: 0.25
Nodes (8): Firmware never run on hardware (verified against emulators and openssl), Blocked Work Policy, CHANGELOG, Blocked: On-device Verification (no ADB, emulator, phone, google-services.json, ESP32), Review: Documentation and Runtime Alignment, Glossary, Field Unit / Device (ESP32), Documentation Index (00-09)

### Community 37 - "Debounce Helpers"
Cohesion: 0.25
Nodes (4): namespace, namespace, pg(), pg()

### Community 38 - "Fault Detector Core"
Cohesion: 0.32
Nodes (6): FaultType, FaultThresholds, FaultDetector(), faultTypeName(), update(), test_fault_type_names_match_the_contract()

### Community 39 - "Background Monitoring"
Cohesion: 0.29
Nodes (8): powerguard_core pure library (no Arduino dependency), FR-10 Background monitoring, Background monitoring flow, backgroundService (foreground service), Layer rules (screens never import services; domain imports no React/native), Service interfaces (Firebase, Notification, Background, Storage, Haptic), T-21 Background monitoring, Incident: no alerts while app minimized

### Community 40 - "TypeScript Config"
Cohesion: 0.25
Nodes (7): compilerOptions, noEmit, strict, types, exclude, extends, include

### Community 41 - "Android MainActivity"
Cohesion: 0.29
Nodes (4): String, MainActivity, ReactActivity, ReactActivityDelegate

### Community 42 - "Security and Setup Docs"
Cohesion: 0.43
Nodes (7): Serial calibration console (cal vzero/izero/v/i/mq), Fault classification and debounce (short, over_current, over_voltage, open_line, under_voltage), Firmware setup procedure (secrets.h, pio upload, uid whitelist), /config/writers/{deviceId} (ESP32 uid whitelist), RTDB schema (/devices/{id}/live|status|history, /config/writers), Authentication (anonymous app user, ESP32 email/password, admin simulator), Firebase project setup (one-time)

### Community 43 - "Device Switching"
Cohesion: 0.33
Nodes (7): FR-9 Device switching, NFR-3 Single-field update re-renders only readers, deviceStore (Zustand), Device switch flow, subscriptionManager (owns RTDB listeners), deviceStore state shape, Core and hook interfaces

### Community 44 - "Android MainApplication"
Cohesion: 0.33
Nodes (4): Application, MainApplication, ReactApplication, ReactHost

### Community 45 - "Security Threat Model"
Cohesion: 0.33
Nodes (6): ADR-0007 Anonymous Auth, v2 path: user accounts, /users/{uid}/devices, App Check, Mains safety warning, Monitoring aid, not a certified safety system, Architecture risks and mitigations, Threat model (T1-T8, STRIDE)

### Community 46 - "Package Manifest"
Cohesion: 0.33
Nodes (5): engines, node, name, private, version

### Community 47 - "Root README Overview"
Cohesion: 0.47
Nodes (6): 09 Deployment and Ops, Root README (PowerGuard Monitor), Firebase data paths and rules (README summary), PowerGuard Monitor Android App, Setup and requirements (Node 22, JDK 17, RN 0.84, minSdk 24), Whole system: ESP32 -> HTTPS REST -> Firebase RTDB -> app

### Community 48 - "RMS Unit Tests"
Cohesion: 0.40
Nodes (5): AcAccumulator, sine(), test_rms_removes_dc_bias(), test_rms_reset_clears_everything(), test_rms_tracks_min_max_for_clipping_detection()

### Community 49 - "RTDB Read Contract"
Cohesion: 0.40
Nodes (5): DeviceStatusRaw, READ /.info/connected, READ /devices/{id}/live, RTDB contract (read paths and outcomes), READ /devices/{id}/status

### Community 50 - "Firmware Payload Fixture"
Cohesion: 0.70
Nodes (4): emit(), emitLive(), main(), LiveSample

### Community 51 - "Misc: The verify loop"
Cohesion: 0.50
Nodes (4): The verify loop, 08 Build Plan, Build plan dependency graph, Standard Definition of Done

## Ambiguous Edges - Review These
- `Release signing via env vars (MYAPP_UPLOAD_*)` → `CI/CD pipeline (ci.yml, e2e.yml, release.yml)`  [AMBIGUOUS]
  README.md · relation: conceptually_related_to
- `Core components (Card, AppText, Skeleton, Slider, ...)` → `T-14 Domain components`  [AMBIGUOUS]
  powerguard-docs/08-build-plan.md · relation: references
- `Alert (AlertKey)` → `MQ-135 gives CO2-equivalent index, smoke_ppm absent shown as CLEAR`  [AMBIGUOUS]
  powerguard-docs/decisions/0010-firmware-design.md · relation: conceptually_related_to

## Knowledge Gaps
- **187 isolated node(s):** `Tabs`, `s`, `String`, `ReactActivityDelegate`, `ReactHost` (+182 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Release signing via env vars (MYAPP_UPLOAD_*)` and `CI/CD pipeline (ci.yml, e2e.yml, release.yml)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Core components (Card, AppText, Skeleton, Slider, ...)` and `T-14 Domain components`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `Alert (AlertKey)` and `MQ-135 gives CO2-equivalent index, smoke_ppm absent shown as CLEAR`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `ADR-0005 Local Notifications and Foreground Service` connect `Notifications and Storage` to `Background Monitoring`, `Alerts and Live Flow`, `Security Threat Model`, `Product Brief and Reliability`, `RN CLI and RTDB Decisions`, `Test Tooling ADR`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Why does `ADR-0008 History Retention and Server Timestamps` connect `History Retention` to `Architecture Constants`, `Alerts and Live Flow`, `ADR-0010 Firmware Design`, `Security Threat Model`, `RN CLI and RTDB Decisions`, `Domain Layer Concepts`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `AGENTS.md (AI agent operating manual)` connect `Test Tooling ADR` to `Changelog and Blocked Work`, `ADR-0010 Firmware Design`, `RN CLI and RTDB Decisions`, `Notifications and Storage`, `Testing and CI`, `Misc: The verify loop`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `ADR-0005 Local Notifications and Foreground Service` (e.g. with `React Native CLI bare workflow (TypeScript, New Architecture, Hermes)` and `Manual checks M-2 to M-4 (notifications, FGS, jank)`) actually correct?**
  _`ADR-0005 Local Notifications and Foreground Service` has 4 INFERRED edges - model-reasoned connections that need verification._