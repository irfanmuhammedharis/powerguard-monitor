# 0004 — Zustand for state instead of Redux Toolkit or Context only

- Status: accepted
- Date: 2026-10-15

## Context
Live data updates every 2 s. Only the widgets whose values changed should re-render. The alert controller and foreground service must read and subscribe to state outside React.

## Options considered
- **Zustand** — selector-level subscriptions, `getState()/subscribe()` outside React, `persist` middleware, tiny API. Cons: less enforced structure.
- **Redux Toolkit** — structure and devtools. Cons: more boilerplate for a small app; selectors need extra care to avoid re-renders.
- **React Context only** — no dependency. Cons: every consumer re-renders on each update; not usable outside React.

## Decision
Zustand: `deviceStore` (volatile) and `settingsStore` (persisted to AsyncStorage key `pg:settings:v1`).

## Consequences
- Components must select primitives (or use `shallow`) to keep re-renders minimal; a render-count test guards this.
- Core singletons subscribe with `store.subscribe`.
