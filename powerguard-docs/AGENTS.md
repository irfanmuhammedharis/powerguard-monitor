# AGENTS.md — Operating Manual for the AI Development Agent

You are building **PowerGuard Monitor**, a React Native CLI Android app that shows live ESP32 data from Firebase Realtime Database and raises local alerts. This file is your standing instruction set. Follow it for every task.

When this file and a specific doc disagree, the specific doc wins for that detail. When in doubt about process, this file wins.

## 1. Before you write any code

- Read [`README.md`](README.md), then this file, then [`00`](00-product-brief.md)–[`07`](07-testing-strategy.md), then [`08-build-plan.md`](08-build-plan.md).
- Build strictly from `08-build-plan.md`, in order. Do not start a task whose dependencies aren't done and verified.
- If anything is ambiguous or missing, do NOT invent product behavior. Add a `[TODO]` in the relevant doc, then either ask or proceed with a clearly marked `[ASSUMPTION]`. Never guess silently.
- Hard boundaries from [00-product-brief.md → Out of scope](00-product-brief.md#out-of-scope-explicitly): no Expo packages, no iOS work, no writes to RTDB from the app, no FCM/Cloud Functions, no analytics SDKs, no features beyond the spec.

## 2. Coding standards

- **Language:** TypeScript, `strict: true`. No `any` in `src/types` or `src/domain`; elsewhere only with a comment explaining why.
- **Style:** Prettier defaults (single quotes, trailing commas). ESLint with `--max-warnings 0`.
- **Naming:** components `PascalCase.tsx`; hooks `useX.ts`; everything else `camelCase.ts`. RTDB field names stay snake_case in models (they mirror the firmware contract); all other identifiers are camelCase.
- **Structure:** put files where [02-architecture.md → Repository layout](02-architecture.md#repository-layout) says. Respect the [layer rules](02-architecture.md#layer-rules): screens and components never import services or Firebase; the domain imports nothing from React or native modules.
- **Constants:** import timing and threshold values from `src/domain/constants.ts`. Never repeat the numbers.
- **Cross-cutting rules:** config via `appConfig`, time via `time.ts`, text via `strings.ts`, colors via tokens, logging via `logger`, errors as `AppError` ([02 → Cross-cutting concerns](02-architecture.md#cross-cutting-concerns)).
- **Performance:** select primitives from stores; `React.memo` on domain components; animations on the UI thread with Reanimated.
- **Commits:** small and scoped; one logical change per commit; the message says what and why and names the task (e.g. `T-08: alert engine reducer with confirmation and dedupe`).
- **Secrets:** never commit `google-services.json` (except the placeholder `google-services.demo.json`), `.env`, keystores or service-account files ([06-security.md](06-security.md#secrets--config)).

## 3. The build loop (run for EVERY task)

1. Read the task in `08-build-plan.md` and every spec section it links to.
2. Implement the smallest correct version that satisfies the acceptance criteria.
3. Write tests for the new behavior, happy path AND unhappy path, per [07-testing-strategy.md](07-testing-strategy.md).
4. Run the focused tests (`npx jest <path>`) and fix until green. Don't weaken a test to make it pass.
5. Run the full suite, lint, typecheck and debug build: `npm test && npm run typecheck && npm run lint && npm run build:android:debug`. All must pass.
6. Verify end to end at the real boundary: run the app on an Android emulator against the Firebase emulator, play a simulator scenario (`npm run sim -- --scenario <name>`), and confirm what you see matches the acceptance criteria. Run the matching Maestro flow once it exists.
7. Tick the task's Definition of Done and update `CHANGELOG.md`.
8. Only then start the next task.

A task is DONE only when steps 3–7 are all satisfied. Green unit tests alone are not "done."

## 4. Which skill or tool to use

Prefer a purpose-built skill or the library's official tooling over ad-hoc code. If your environment has a skill registry, check it when a task matches a skill's trigger.

| Kind of work | Use |
|---|---|
| Project scaffolding | `npx @react-native-community/cli@latest init` (never `create-expo-app`) |
| Native library install | The library's current Android install docs; `npm install` then Gradle sync. Autolinking handles most; follow any manual steps listed |
| Firebase backend locally | Firebase CLI: `firebase emulators:start`, `emulators:exec`, `deploy --only database` |
| Pushing test data | `npm run sim` (the project simulator), or the emulator REST API from Maestro scripts |
| UI and visual design | The specs in [05-ui-ux.md](05-ui-ux.md); a `frontend-design` skill if available for visual judgment; never invent new colors, use tokens |
| Charts and gauges | `react-native-svg` + Reanimated, hand-built ([ADR-0006](decisions/0006-custom-svg-charts.md)) |
| Notifications / foreground service | `@notifee/react-native` |
| Unit, integration, component tests | Jest + `@testing-library/react-native`, mocks in `src/test/mocks/` |
| Rules tests | `@firebase/rules-unit-testing` under `firebase emulators:exec` |
| E2E tests | Maestro (`maestro test .maestro/`) |
| Performance checks | `adb shell dumpsys gfxinfo com.hexcodeplus.powerguard` |
| Release build | Gradle (`assembleRelease`, `bundleRelease`) with signing from env |

## 5. Decisions

The settled decisions are in [`decisions/`](decisions/) (ADR-0001 to ADR-0009). Do not re-decide them silently. Any new non-trivial technical choice (a new dependency, a change to the data contract, a different foreground-service type) gets a new ADR **before** you implement it, using the format of the existing ADRs.

The data contract in [03-data-model.md](03-data-model.md#rtdb-schema) is shared with the ESP32 firmware. Never rename or remove a field. If a change is unavoidable, write an ADR and flag it to the user, because the firmware must change too.

## 6. When you're blocked

- **Missing tool** (no Android emulator, no Java, Maestro not installed): stop, note it in `CHANGELOG.md` under "Blocked", and tell the user exactly what's missing. Don't fake around it.
- **Ambiguous requirement:** mark `[TODO]`, pick the lowest-risk interpretation, flag it to the user.
- **A library's current docs contradict this suite** (e.g. a renamed API, a new Android requirement): follow the library docs, update this suite to match, and record it in an ADR or the changelog.
- **A test shows the spec is wrong:** fix the spec (and its ADR) first, then the code, then the test.
- **Never** delete, skip or weaken a failing test to make the build green.

## 7. Definition of Done (global)

The product is done when:
- all 24 build-plan tasks are complete and their Definitions of Done are ticked;
- every functional requirement in [01-requirements.md](01-requirements.md) traces to a passing test;
- coverage gates in [07-testing-strategy.md](07-testing-strategy.md#coverage-gates) are met;
- typecheck, lint, rules tests, debug and release builds, and the CI gate are green;
- all six Maestro flows pass three times in a row;
- manual checks M-1 to M-5 pass on real hardware;
- every `[TODO]` in the suite is resolved or explicitly deferred with the user's agreement.
