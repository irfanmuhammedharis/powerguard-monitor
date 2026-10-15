# 0006 — Custom SVG chart and gauges instead of a chart library

- Status: accepted
- Date: 2026-10-15

## Context
The design calls for arc gauges with gradient strokes, threshold ticks, state glows and animated sweeps, plus a dual-axis chart with gradient fills and a touch tooltip. It must run smoothly on mid-range phones.

## Options considered
- **Hand-built on react-native-svg + Reanimated** — full control over the design; small bundle; animations on the UI thread. Cons: more code and tests.
- **react-native-gifted-charts** — quick line charts. Cons: limited gauge support; styling and dual-axis tooltips fight the design.
- **Victory Native / Skia-based libraries** — powerful. Cons: heavier dependencies (Skia) for two small visuals.

## Decision
Hand-build `ArcGauge` and `LiveChart` on `react-native-svg` with Reanimated; keep the math (scales, paths) in pure helpers that are unit-tested.

## Consequences
- Pure helpers (`chartScale`, path builders) get their own tests.
- If schedule slips, `react-native-gifted-charts` is an acceptable fallback for `LiveChart` only, via a new ADR.
