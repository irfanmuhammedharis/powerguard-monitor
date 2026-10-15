# 0001 — React Native CLI (bare workflow) instead of Expo

- Status: accepted
- Date: 2026-10-15

## Context
The app needs native Firebase SDKs, a foreground service that keeps the JS runtime alive, custom notification channels, and full control over Gradle, the Android manifest and release signing. The owner explicitly asked for React Native CLI and no Expo.

## Options considered
- **React Native CLI (bare)** — full native freedom; foreground service and native Firebase work directly. Cons: more native setup to maintain; no Expo Go.
- **Expo managed + dev builds + config plugins** — faster start, managed upgrades. Cons: background behavior and some native modules need config plugins and custom dev builds; owner rejected Expo.

## Decision
React Native CLI, bare workflow, TypeScript, New Architecture and Hermes enabled. No Expo packages anywhere in `package.json`.

## Consequences
- Native setup (Gradle plugins, manifest permissions, signing, R8 keep rules) is the agent's responsibility and is spelled out in the build plan.
- React Native upgrades follow the RN Upgrade Helper.
- iOS folder is generated but unused.
