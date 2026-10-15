# 0002 — Firebase Realtime Database instead of Firestore

- Status: accepted
- Date: 2026-10-15

## Context
The ESP32 writes a small JSON snapshot every 2 s and a history sample every 10 s. The app needs sub-second updates and must stay on the free Spark plan.

## Options considered
- **Realtime Database** — very low latency for a single small node; mature ESP32 library (Firebase-ESP-Client); billed on storage and download, not per write. Cons: basic querying; history retention must be managed.
- **Cloud Firestore** — richer queries. Cons: billed per document write; a 2 s cadence is ~43,200 live writes/day/device, which exhausts the free 20,000 writes/day quota; heavier ESP32 client.

## Decision
Realtime Database.

## Consequences
- History events are computed client-side from samples.
- `/history` needs an index on `ts` and a retention strategy (ADR-0008).
- Live data lives at a fixed path that is simply overwritten.
