# 0007 — Firebase Anonymous Auth for the app

- Status: accepted (v1)
- Date: 2026-10-15

## Context
Rules must require authentication so the database isn't public, but v1 has no user accounts and a single device per install.

## Options considered
- **Anonymous Auth** — zero friction; satisfies `auth != null`. Cons: anyone with the APK and project config can sign in and read telemetry.
- **Email/password or Google sign-in** — per-user access control. Cons: account flows, password reset, privacy obligations; out of v1 scope.
- **Public read rules** — simplest. Cons: database readable by anyone on the internet.

## Decision
Anonymous Auth for the app; a dedicated email/password user for the ESP32, whitelisted for writes.

## Consequences
- Telemetry is readable by any authenticated install. Acceptable because the data is non-sensitive.
- v2 path: real accounts + `/users/{uid}/devices` access lists + App Check.
