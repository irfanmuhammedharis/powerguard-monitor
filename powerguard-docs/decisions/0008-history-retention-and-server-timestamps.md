# 0008 — History ring buffer and server timestamps (firmware contract)

- Status: accepted (implemented by the firmware, see [ADR-0010](0010-firmware-design.md))
- Date: 2026-10-15

## Context
1. With `push()`, `/history` grows by ~8,640 entries per day forever; the app can't delete (read-only) and Spark has no scheduled functions.
2. Connectivity depends on `now − last_seen`. If the ESP32's NTP time drifts or fails, the phone shows false offline/online states.

## Options considered
- **Ring buffer** — firmware writes `/history/{slot}` where `slot = zeroPad(index mod 8640, 4)`; exactly 24 h retained. Cons: keys are not chronological (app must query by `ts`).
- **push() + manual cleanup** — simple firmware. Cons: unbounded growth until someone cleans up.
- **push() + Cloud Function cleanup** — automatic. Cons: Blaze plan.
- **Server timestamp for `last_seen`** — firmware writes `{".sv":"timestamp"}` (milliseconds, Firebase server clock). Cons: value is ms instead of seconds.

## Decision
- Recommend the ring buffer to the firmware team.
- Recommend `last_seen` as a server timestamp.
- The app is built to work **either way**: all history queries use `orderByChild('ts')`; all timestamps go through `toSeconds()`; `useHistory` detects ms-valued `ts`.

## Consequences
- No app change is needed whichever option the firmware picks.
- Confirmed: the firmware writes the ring buffer and the server-timestamp `last_seen`.
- Note: the first app build queried history with `limitToLast(60)` by key, which is chronological only for `push()` ids and returns arbitrary slots from a wrapped ring buffer. The app now queries `orderByChild('ts')` as this ADR requires.
