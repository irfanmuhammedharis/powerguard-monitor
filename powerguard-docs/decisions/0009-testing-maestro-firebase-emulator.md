# 0009 — Jest + RNTL, Firebase Emulator Suite and Maestro for testing

- Status: accepted
- Date: 2026-10-15

## Context
The app must be provably correct against realistic data without a physical ESP32, and E2E tests must be deterministic.

## Options considered
- **E2E: Maestro** — YAML flows, works with any Android build, can call HTTP from scripts to seed data. Cons: less fine-grained than Detox.
- **E2E: Detox** — gray-box, synchronizes with RN. Cons: heavier setup and native build config; more fragile across RN upgrades.
- **Backend for tests: Firebase Emulator Suite (`demo-powerguard`)** — offline, resettable, rules enforced. Cons: needs Java.
- **Backend for tests: a real test project** — realistic. Cons: shared state, network flakiness, quota use.

## Decision
Jest + React Native Testing Library for unit/integration/component tests; `@firebase/rules-unit-testing` for rules; Firebase Emulator Suite with project `demo-powerguard` for rules and E2E; Maestro for E2E, seeding data via the emulator REST API.

## Consequences
- CI needs Java 17 (already required for Android).
- A placeholder `google-services.demo.json` is committed for E2E/CI builds.
- Real notifications, the foreground service and jank are covered by manual checks M-2 to M-4.
