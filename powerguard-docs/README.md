# PowerGuard Monitor — Documentation Suite

PowerGuard Monitor is an Android app, built with React Native CLI (no Expo), that shows live data from an ESP32 field unit through Firebase Realtime Database: line fault, rain, smoke, voltage, current and derived power. It raises local alerts when a fault, smoke or rain event starts.

This suite is the single source of truth for building the app. An AI coding agent should be able to build PowerGuard Monitor to a passing test suite using only these files.

**Owner:** HexCodePlus · **Package id:** `com.hexcodeplus.powerguard` · **Platform:** Android only

## How to use this suite (for AI agents)

Read in this order before writing any code:

1. [`AGENTS.md`](AGENTS.md): your operating manual and standing rules.
2. `README.md` (this file): the map.
3. [`00-product-brief.md`](00-product-brief.md) → [`07-testing-strategy.md`](07-testing-strategy.md): the spec.
4. [`08-build-plan.md`](08-build-plan.md): your ordered task list. Build from here.

Rules: follow `AGENTS.md` at all times. A task is done only when its tests pass and the change is verified end to end. Record every significant decision as an ADR in [`decisions/`](decisions/).

## Document index

| File | Purpose |
|---|---|
| [00-product-brief.md](00-product-brief.md) | Why we're building this, for whom, MVP scope and out-of-scope |
| [01-requirements.md](01-requirements.md) | Functional requirements with Given/When/Then acceptance criteria, NFRs, traceability |
| [02-architecture.md](02-architecture.md) | System context, layers, components, runtime flows, tech stack, conventions, repo layout |
| [03-data-model.md](03-data-model.md) | RTDB schema, TypeScript models, local persisted state, seed and fixture data |
| [04-api-spec.md](04-api-spec.md) | Data contract with the ESP32 (RTDB paths) and internal module interfaces |
| [05-ui-ux.md](05-ui-ux.md) | Design system, screens, states, components, motion, accessibility |
| [06-security.md](06-security.md) | Auth, RTDB rules, secrets, threat model |
| [07-testing-strategy.md](07-testing-strategy.md) | Test pyramid, coverage gates, exact commands, verify loop, CI gate |
| [08-build-plan.md](08-build-plan.md) | Ordered build tasks with skills, tests and Definition of Done |
| [09-deployment-ops.md](09-deployment-ops.md) | Environments, Firebase setup, build and release, config, runbooks |
| [AGENTS.md](AGENTS.md) | Operating manual for the AI development agent |
| [glossary.md](glossary.md) | Domain terms and names used in code |
| [decisions/](decisions/) | Architecture Decision Records 0001–0010 |
| [CHANGELOG.md](CHANGELOG.md) | Updated after every completed build task |

## Key numbers at a glance

| Constant | Value | Defined in |
|---|---|---|
| ESP32 `/live` write interval | 2 s | [03](03-data-model.md#rtdb-schema) |
| ESP32 `/history` write interval | 10 s | [03](03-data-model.md#rtdb-schema) |
| Device offline threshold | 15 s since `last_seen` | [02](02-architecture.md#connectivity-model) |
| Alert confirmation | 2 consecutive `true` samples | [02](02-architecture.md#alert-engine) |
| Default voltage window | 180–260 V | [03](03-data-model.md#settings) |
| Default current limit | 10 A | [03](03-data-model.md#settings) |

## Status

Mode: **greenfield**. Last updated: 2026-10-15.

Legend: `[ASSUMPTION]` chosen default · `[TODO]` open question · `[INFERRED]` read from code, unconfirmed (not used; no code exists yet).

Open questions that affect the ESP32 firmware are listed in [02-architecture.md → Open questions](02-architecture.md#open-questions).
