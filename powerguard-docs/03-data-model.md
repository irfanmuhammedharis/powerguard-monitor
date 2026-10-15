# Data Model

There are two stores of data:

1. **Remote**: Firebase Realtime Database, written by the ESP32 and read by the app.
2. **Local**: AsyncStorage on the phone, holding settings and alert state.

The app never writes remote data. TypeScript models live in `src/types/models.ts`; parsing rules live in `src/domain/parsers.ts` and are specified in [04-api-spec.md](04-api-spec.md#parsing-rules).

## RTDB schema

```
/devices
  /{deviceId}                         string, ^[A-Za-z0-9_-]{1,64}$  (default "esp32_01")
    /live        LiveReadingRaw        overwritten (set) every 2 s
    /status      DeviceStatusRaw       overwritten (set) every 2 s
    /history
      /{key}     HistorySampleRaw      every 10 s; key = push id OR ring-buffer slot "0000".."8639"
/config
  /writers
    /{deviceId}  string               uid of the ESP32's Firebase user (console-only; app cannot read)
```

### `live` — LiveReadingRaw

| Field | Type | Required | Constraints | Notes |
|---|---|---|---|---|
| `line_fault` | boolean | yes | | `true` = fault present |
| `fault_type` | string | yes | one of `none`, `over_current`, `under_voltage`, `over_voltage`, `open_line`, `short` | `none` when `line_fault = false` |
| `rain` | boolean | yes | | |
| `smoke` | boolean | yes | | |
| `smoke_ppm` | number | no | ≥ 0 | Raw MQ reading or ppm; display only |
| `voltage` | number | yes | finite, typically 0–500 | Volts (RMS for AC) |
| `current` | number | yes | finite, ≥ 0 | Amps (RMS for AC) |
| `ts` | number | yes | unix **seconds** (or ms, normalized) | Sample time from ESP32 NTP |

### `status` — DeviceStatusRaw

| Field | Type | Required | Constraints | Notes |
|---|---|---|---|---|
| `last_seen` | number | yes | unix seconds, or ms when written as server timestamp | Drives connectivity |
| `rssi` | number | no | dBm, typically −100…−30 | Wi-Fi signal |

### `history/{key}` — HistorySampleRaw

Same fields as `live`. `ts` is required for history (samples without a valid `ts` are dropped). Must be indexed on `ts` ([06-security.md → RTDB rules](06-security.md#rtdb-rules)).

## TypeScript models

```ts
// src/types/models.ts

export const FAULT_TYPES = [
  'none', 'over_current', 'under_voltage', 'over_voltage', 'open_line', 'short',
] as const;
export type KnownFaultType = typeof FAULT_TYPES[number];
export type FaultType = KnownFaultType | 'unknown';

export interface LiveReading {
  line_fault: boolean;
  fault_type: FaultType;
  rain: boolean;
  smoke: boolean;
  smoke_ppm: number | null;
  voltage: number;
  current: number;
  ts: number;               // unix seconds (normalized)
}

export interface InvalidFields {
  voltage: boolean;
  current: boolean;
}

export interface DeviceStatus {
  last_seen: number;        // unix seconds (normalized)
  rssi: number | null;
}

export interface HistorySample extends LiveReading {
  key: string;              // RTDB key
}

export type Connectivity = 'loading' | 'online' | 'device_offline' | 'phone_offline';

export type Level = 'ok' | 'warning' | 'danger';

export type WorstState =
  | 'phone_offline' | 'device_offline' | 'line_fault' | 'smoke'
  | 'threshold_danger' | 'rain' | 'threshold_warning' | 'ok';

export type AlertKey = 'line_fault' | 'smoke' | 'rain';

export interface HistoryEvent {
  id: string;               // `${key}:${sampleKey}`
  key: AlertKey;
  kind: 'started' | 'cleared';
  ts: number;               // unix seconds of the sample where the change was observed
  faultType: FaultType | null;  // only for line_fault started
}

export interface ChartPoint { t: number; v: number }  // t = unix seconds

export type ChartRange = '5m' | '1h' | '24h';

export type ThemePreference = 'system' | 'dark' | 'light';

export interface Settings {
  deviceId: string;
  alerts: Record<AlertKey, boolean>;
  thresholds: { voltageMin: number; voltageMax: number; currentMax: number };
  backgroundMonitoring: boolean;
  theme: ThemePreference;
}
```

### deviceStore state

| Field | Type | Initial | Notes |
|---|---|---|---|
| `deviceId` | string | from settings | Mirrors the active subscription |
| `live` | `LiveReading \| null` | `null` | Latest parsed reading |
| `invalid` | `InvalidFields` | all `false` | Flags from the last parse |
| `liveEmpty` | boolean | `false` | `true` when `/live` snapshot is null/non-object |
| `liveReceivedAt` | `number \| null` | `null` | Phone time (s) of last `/live` event |
| `status` | `DeviceStatus \| null` | `null` | |
| `phoneConnected` | `boolean \| null` | `null` | From `/.info/connected` |
| `startedAt` | number | now (s) | Reset on device switch; used for loading timeout |
| `error` | `AppError['code'] \| null` | `null` | `auth_failed`, `db_permission_denied` |

Actions: `setLive(reading, invalid, receivedAt)`, `setLiveEmpty()`, `setStatus(status)`, `setPhoneConnected(bool)`, `setError(code|null)`, `reset(deviceId)`.

## Local persisted state

| Key | Value | Written by | Notes |
|---|---|---|---|
| `pg:settings:v1` | `Settings` (JSON) | settingsStore (persist middleware) | Validated on hydrate; invalid → defaults |
| `pg:alertState:v1:<deviceId>` | `AlertState` (JSON) | alertController | One per device |
| `pg:permissionAsked:v1` | `true` | notificationService | So the Android 13+ prompt is requested once |
| `pg:permissionCardDismissed:v1` | `true` | Dashboard | Hides the "Alerts are off" card |

Keys carry a version suffix. A future schema change bumps the version and migrates or resets in `storageService.migrate()`. For v1, `migrate()` is a no-op.

### Settings

| Field | Type | Default | Validation |
|---|---|---|---|
| `deviceId` | string | `DEFAULT_DEVICE_ID` from config, else `esp32_01` | `^[A-Za-z0-9_-]{1,64}$` |
| `alerts.line_fault` | boolean | `true` | |
| `alerts.smoke` | boolean | `true` | |
| `alerts.rain` | boolean | `true` | |
| `thresholds.voltageMin` | number | `180` | 0–400, ≤ voltageMax − 10 |
| `thresholds.voltageMax` | number | `260` | 10–500, ≥ voltageMin + 10 |
| `thresholds.currentMax` | number | `10` | 0.5–100, step 0.5 |
| `backgroundMonitoring` | boolean | `false` | |
| `theme` | ThemePreference | `system` | |

`validateSettings(raw: unknown): Settings` merges `raw` over defaults field by field. Any field that fails validation falls back to its default. It never throws.

### AlertState default

```json
{
  "line_fault": { "streak": 0, "notified": false },
  "smoke":      { "streak": 0, "notified": false },
  "rain":       { "streak": 0, "notified": false }
}
```

## Relationships

```
Settings.deviceId ──1:1──> /devices/{deviceId}            (active subscription)
/devices/{deviceId} ──1:1──> live, status
/devices/{deviceId} ──1:N──> history samples
AlertState ──1:1──> deviceId                               (local, keyed per device)
HistoryEvent ──derived from──> consecutive HistorySample pairs (not stored)
```

There are no foreign keys or cascades. Deleting a device in RTDB simply leaves the app showing `device_offline`.

## Migrations

There is no database migration tool; RTDB is schemaless. The schema is enforced by:
- The parsers (client side).
- Optional `.validate` rules ([06-security.md](06-security.md#rtdb-rules)), which reject malformed firmware writes.

Local storage migrations go through `storageService.migrate(fromVersion, toVersion)`, which is called in `bootstrap` before hydration.

## Seed & fixture data

### Simulator scenarios (`tools/simulator/scenarios/`)

Each scenario is a JSON file with a list of steps. `simulate.ts` writes each step's `live` and `status` (with `last_seen` = now unless overridden) and, every 5th step, a `history` entry. Step interval defaults to 2 s.

| File | What it does |
|---|---|
| `healthy.json` | 230 V ± 3 V jitter, 1.5–2.5 A, all flags false |
| `line-fault.json` | 5 healthy steps, then `line_fault: true, fault_type: "over_current"`, current 12.5 A for 10 steps, then healthy |
| `smoke.json` | Healthy, then `smoke: true, smoke_ppm: 640` for 10 steps, then clear |
| `rain.json` | Healthy, then `rain: true` for 10 steps |
| `combined.json` | Fault + smoke + rain together, then clearing one at a time |
| `glitch.json` | `smoke: true` for exactly 1 step between healthy steps (must NOT alert) |
| `threshold.json` | Voltage ramps 230 → 250 → 265 → 175 → 230 (ok → warning → danger → danger → ok) |
| `malformed.json` | Steps with `voltage: "abc"`, `smoke: "true"`, missing `current`, `fault_type: "zap"`, `live: null` |
| `stale.json` | Healthy data, then stops writing `/status` (device goes offline after 15 s) |
| `history-24h.json` | One-shot: writes 8,640 history samples covering the last 24 h with 3 fault, 2 smoke and 4 rain episodes |

Usage (exact commands in [07-testing-strategy.md](07-testing-strategy.md#how-to-run-tests)):

```bash
npm run sim -- --scenario smoke --device esp32_01 --target emulator
npm run sim -- --scenario healthy --target project --loop --yes   # real Firebase project
```

### Unit test fixtures (`src/test/fixtures/`)

```ts
// src/test/fixtures/live.ts
export const healthyRaw = {
  line_fault: false, fault_type: 'none', rain: false, smoke: false,
  smoke_ppm: 120, voltage: 230.4, current: 1.82, ts: 1760000000,
};
export const faultRaw = { ...healthyRaw, line_fault: true, fault_type: 'over_current', current: 12.5 };
export const smokeRaw = { ...healthyRaw, smoke: true, smoke_ppm: 640 };
export const rainRaw = { ...healthyRaw, rain: true };
export const malformedRaws: unknown[] = [
  null, 'text', 42, [],
  { ...healthyRaw, voltage: 'abc' },
  { ...healthyRaw, current: undefined },
  { ...healthyRaw, voltage: Number.NaN },
  { ...healthyRaw, smoke: 'true', rain: 1 },
  { ...healthyRaw, line_fault: true, fault_type: 'zap' },
  { ...healthyRaw, ts: undefined },
  { ...healthyRaw, ts: 1760000000123 },        // milliseconds
];
export const statusRaw = { last_seen: 1760000000, rssi: -61 };
```

`src/test/factories.ts` provides `makeReading(overrides)`, `makeStatus(overrides)`, `makeHistory(count, { startTs, stepS, episodes })` and `makeSettings(overrides)`. Tests use factories rather than copying literals.

## Data lifecycle

- **Live/status:** overwritten every 2 s; no retention concern.
- **History:** firmware responsibility. The recommended ring buffer of 8,640 slots holds exactly 24 h at 10 s ([ADR-0008](decisions/0008-history-retention-and-server-timestamps.md)). The app only reads the last 24 h.
- **Local settings and alert state:** kept until the app is uninstalled or its data is cleared. Nothing is personal data.
- **Personal data:** none collected. The anonymous uid is the only identifier and is never displayed or logged in release ([06-security.md](06-security.md#data-protection)).
