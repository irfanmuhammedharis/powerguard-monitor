# Testing Strategy

## Philosophy & pyramid

- **A task is not done until its tests pass and the change is verified end to end.** This is the load-bearing rule. It is repeated in every Definition of Done in [08-build-plan.md](08-build-plan.md).
- **Test behavior, not implementation.** Assert what a user or caller can observe: returned values, store state, rendered text, effects emitted.
- **Every requirement traces to a test.** See the traceability table in [01-requirements.md](01-requirements.md#traceability). A requirement with no test is not delivered.
- **Cover the unhappy path.** Malformed data, offline, permission denied, empty history, boundary values at every threshold.
- **The alert engine gets the most scrutiny.** It is pure, so it is tested exhaustively, including a table-driven scenario test.

| Layer | Share | What | Tooling |
|---|---|---|---|
| Unit | ~60% | `src/domain/*` (parsers, connectivity, derive, alertEngine, downsample, events, time), `validateSettings` | Jest (node environment) |
| Integration | ~20% | Stores + core (subscriptionManager, alertController) with mocked Firebase/Notifee/AsyncStorage; hooks with fake timers | Jest + `@testing-library/react-native` |
| Component | ~15% | Domain components and screens in each state | `@testing-library/react-native` |
| Rules | small, critical | RTDB rules: app can read, cannot write; ESP32 uid can write | `@firebase/rules-unit-testing` + Database emulator |
| E2E | 6 flows | Real app on an Android emulator against the Firebase Emulator Suite | Maestro |
| Manual | 5 checks | Things automation can't cover well: real notifications, background service, jank, TalkBack | Checklist below |

## Coverage gates

Enforced by `coverageThreshold` in `jest.config.js`. `npm run test:coverage` fails if any gate is missed.

| Path | Lines | Branches |
|---|---|---|
| `src/domain/**` | ≥ 95% | ≥ 90% |
| `src/core/**`, `src/store/**`, `src/hooks/**` | ≥ 85% | ≥ 80% |
| Global (all `src/**` except `src/test/**`, `src/app/navigation/**`) | ≥ 75% | ≥ 70% |

Plus:
- 0 failing or skipped tests on `main` (`it.skip`/`describe.skip` are rejected by an ESLint rule).
- Every build task adds tests for its new behavior.
- Coverage is a floor. Assertions must check real outcomes; a test that only renders without asserting doesn't count.

## Test types

| Type | Use it to verify | Example |
|---|---|---|
| Unit | One function per spec, with edge cases | `voltageLevel(189, defaults) === 'ok'`, `voltageLevel(188.9, defaults) === 'warning'` |
| Table-driven scenario | Sequences through the alert reducer | Glitch, confirm, hold, clear, re-trigger, offline, disabled→enabled |
| Integration | Store + core with mocked native modules | Emitting a `/live` snapshot through the Firebase mock updates `deviceStore` and triggers `displayAlert` once |
| Component | Rendered output per state | `ArcGauge` with `level="danger"` shows "Out of range" and the danger color |
| Render-count | Selector efficiency (NFR-3) | Updating only `rain` doesn't re-render `ArcGauge` (count via `jest.fn` inside a wrapped component) |
| Contrast | Token pairs (NFR-6) | Every text token on `background` and `surface` ≥ 4.5:1 in both themes |
| Rules | RTDB authorization | `assertFails(appUser.ref('devices/esp32_01/live').set(...))` |
| E2E | Full user flows | Maestro flows in `.maestro/` |
| Regression | A fixed bug stays fixed | One test per bug, named `regression_<short-description>` |

## Test locations and naming

- Unit and integration tests sit next to the code: `src/domain/parsers.ts` → `src/domain/parsers.test.ts`. Components: `ArcGauge.tsx` → `ArcGauge.test.tsx`.
- Shared fixtures and factories: `src/test/fixtures/*`, `src/test/factories.ts` ([03-data-model.md → Fixtures](03-data-model.md#seed--fixture-data)).
- Native module mocks: `src/test/mocks/` (`firebase.ts`, `notifee.ts`, `asyncStorage.ts`, `haptics.ts`, `reanimated` via the official mock), registered in `jest.setup.ts`.
- Rules tests: `tools/rules-tests/rules.test.ts`.
- E2E: `.maestro/01-live-dashboard.yaml` … `06-malformed.yaml`, helper `.maestro/scripts/rtdb.js`.
- Test names state the behavior: `reduceAlerts_doesNotNotify_onSingleTrueSample`, or in `describe/it` form: `it('does not notify on a single true sample')`.

## How to write a good test

- **Arrange → Act → Assert**, one behavior per test.
- **Deterministic:** use `setClock()` for time and `jest.useFakeTimers()` for the connectivity ticker and the loading timeout. No real network.
- **Independent:** reset stores in `beforeEach` (`useDeviceStore.setState(initial)`), clear AsyncStorage mock, reset Firebase mock listeners.
- **Meaningful assertions:** check returned values, store state, effects and visible text, not just "didn't throw".
- **Use factories**, not copy-pasted literals.

### Firebase mock contract (`src/test/mocks/firebase.ts`)

The mock must support: `auth().currentUser`, `signInAnonymously()` (configurable success or failure), `database().ref(path)` with `.on('value'|'child_added', cb, errCb)`, `.off()`, `.orderByChild().startAt().once('value')`, `.limitToLast()`, `setPersistenceEnabled`, `useEmulator`. It must also provide test helpers: `__emit(path, value)`, `__emitError(path, code)`, `__setQueryResult(path, value | Error)`, `__listenerCount(path)`.

### Must-have alert engine cases (`alertEngine.test.ts`)

1. Single `true` sample → no notify (glitch).
2. Two consecutive `true` → exactly one `notify` + one `haptic`.
3. Third, fourth `true` → no further effects.
4. `true,true,false` → `cleared` on the false.
5. `true,true,false,true,true` → second `notify`.
6. Disabled type: `true,true` → no notify; enable, then `true` → notify.
7. Connectivity not `online` → state unchanged, no effects, for every key.
8. Two keys confirm on the same sample → two `notify`, one `haptic`.
9. Persisted state `notified: true` + `true` sample → no notify (restart case).
10. `line_fault` notify carries `faultType`.

### Must-have boundary cases (`derive.test.ts`)

Voltage with defaults: 179.9 → danger, 180 → warning, 188.9 → warning, 189 → ok, 247 → ok, 247.1 → warning, 260 → warning, 260.1 → danger. Current with max 10: 8.5 → ok, 8.51 → warning, 10 → warning, 10.01 → danger. Worst-state priority: every pair of states resolves per the order in [FR-4](01-requirements.md#fr-4-hero-status-banner).

## How to run tests

Run from the repo root. These are defined as npm scripts at T-01 and T-03.

```bash
# unit + integration + component
npm test                                   # jest

# coverage (enforces gates)
npm run test:coverage                      # jest --coverage

# static gates
npm run typecheck                          # tsc --noEmit
npm run lint                               # eslint . --max-warnings 0

# RTDB rules (starts the database emulator, runs, stops)
npm run test:rules                         # firebase emulators:exec --only database --project demo-powerguard "jest -c tools/rules-tests/jest.config.js"

# Android build gate
npm run build:android:debug                # cd android && ./gradlew assembleDebug

# E2E (needs: Android emulator running, Maestro installed, Java 17)
npm run emulators                          # terminal 1: firebase emulators:start --only auth,database --project demo-powerguard
npm run android:e2e                        # terminal 2: build + install with ENVFILE=.env.e2e
npm run e2e                                # adb reverse tcp:9000 tcp:9000 && adb reverse tcp:9099 tcp:9099 && maestro test .maestro/

# simulator (manual verification)
npm run sim -- --scenario smoke --target emulator
```

### E2E environment

- Firebase project id `demo-powerguard` (a "demo-" project needs no real Firebase project; the emulator accepts it offline).
- RTDB namespace: `demo-powerguard-default-rtdb`.
- The E2E build uses `android/app/google-services.demo.json` (committed; contains only placeholder values for project `demo-powerguard`), copied to `google-services.json` by `npm run android:e2e`.
- `.env.e2e`: `USE_FIREBASE_EMULATOR=true`, `FIREBASE_EMULATOR_HOST=localhost`, `FIREBASE_EMULATOR_DB_PORT=9000`, `FIREBASE_EMULATOR_AUTH_PORT=9099`, `DEFAULT_DEVICE_ID=esp32_e2e`. `adb reverse` maps the device's localhost to the host machine.
- Flows write data through `.maestro/scripts/rtdb.js`, which calls the emulator REST API (`PUT http://localhost:9000/devices/<id>/<path>.json?ns=demo-powerguard-default-rtdb`, header `Authorization: Bearer owner`, which bypasses rules on the emulator). `last_seen` is set to `Math.floor(Date.now()/1000)` at write time.

### E2E flows

| Flow | Steps | Asserts |
|---|---|---|
| `01-live-dashboard.yaml` | Clear device; write healthy live + status; launch app | "All systems normal", "230.4", "Online". Then write voltage 245 → "245.0" visible within 3 s |
| `02-alerts.yaml` | Healthy; then write `smoke: true` twice, 2.5 s apart | Banner "Smoke detected", Smoke tile "Detected". Write `smoke: false` → banner back to "All systems normal" |
| `03-offline.yaml` | Healthy; then write status with `last_seen = now − 60` | "Device offline" and "No data from device since" visible |
| `04-history.yaml` | Write 30 history samples with one smoke episode and one fault episode; open History | "Smoke detected", "Smoke cleared", "Line fault: Over current"; filter "Smoke" hides the fault row |
| `05-settings.yaml` | Settings → set device ID `nodata_01` → Save → Dashboard | "Waiting for device data" or "Device offline" within 12 s; switch theme to Light and back without crash |
| `06-malformed.yaml` | Write live with `voltage: "abc"`, `smoke: "true"` | App still running; "Invalid reading" visible; Smoke tile "Normal" |

### Manual checks (run at T-24 and before each release)

| ID | Check | Pass criteria |
|---|---|---|
| M-1 | Real phone + real Firebase project; `npm run sim -- --scenario healthy --target project --loop --yes` | Dashboard updates every ~2 s; latency ≤ 1 s by eye against simulator log timestamps |
| M-2 | Android 13+ fresh install: deny notifications, then allow from the card | Card appears on deny; after allowing, the smoke scenario posts one notification |
| M-3 | Background monitoring ON, app minimized, run `smoke` scenario | Exactly one "Smoke detected" notification; persistent notification text changes; "Stop" turns the toggle off |
| M-4 | `adb shell dumpsys gfxinfo com.hexcodeplus.powerguard reset`, run `healthy --loop` for 60 s with the Dashboard open, then `dumpsys gfxinfo` | Janky frames < 5% |
| M-5 | TalkBack on; font scale 1.3; Developer options → animation scale off | All controls reachable and announced; no clipped text; no animations play |

## The verify loop

Run this for **every** build-plan task before marking it done. `AGENTS.md` references it.

1. **Implement** the task per its spec sections.
2. **Write tests** for the new behavior, happy and unhappy paths, per this document.
3. **Run the focused tests** (`npx jest <path>`). Red → fix and repeat. Never edit a test just to make it pass unless the test itself is wrong.
4. **Run the full suite:** `npm test`. All green.
5. **Run the static gates:** `npm run typecheck && npm run lint`, plus `npm run build:android:debug` once T-01 is complete.
6. **Verify end to end at the real boundary.** Don't trust green unit tests alone:
   - Domain-only tasks (T-02, T-05–T-08): the unit tests are the boundary, but also run the relevant scenario through a quick script or test that feeds fixture sequences end to end.
   - Tasks touching the running app (T-04 onward): boot the app on an Android emulator against the Firebase emulator, push a simulator scenario, and confirm the visible result matches the acceptance criteria. Once the relevant Maestro flow exists, run it.
7. **Check the Definition of Done** for the task; update `CHANGELOG.md`.
8. Only then move to the next task.

If a step can't be completed (no Android emulator available, missing tool, ambiguous spec), stop and record a blocker per [AGENTS.md](AGENTS.md#6-when-youre-blocked). Do not fake a pass.

## Test data & fixtures

Use the fixtures and factories in [03-data-model.md → Seed & fixture data](03-data-model.md#seed--fixture-data). Tests create and clean up their own data. E2E flows start with `--clear` semantics (the first step deletes `/devices/<id>`).

## CI gate

A change can merge only if all of these pass ([09-deployment-ops.md → CI/CD](09-deployment-ops.md#build--cicd)):

1. `npm run typecheck`
2. `npm run lint`
3. `npm run test:coverage` (all tests green, all gates met)
4. `npm run test:rules`
5. `npm run build:android:debug`

E2E runs on a nightly job and before release tags (it needs an Android emulator, which is slow on CI).
