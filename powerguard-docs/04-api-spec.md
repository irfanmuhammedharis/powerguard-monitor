# Interface Specification

PowerGuard Monitor has **no HTTP API and no backend code**. Its external interface is the Firebase Realtime Database data contract shared with the ESP32. This document specifies:

1. The RTDB contract: every path the app reads, how it reads it, and what happens on each outcome.
2. The parsing rules that turn raw values into typed models.
3. The internal module interfaces, so each layer can be built and mocked independently.
4. The error model.
5. The simulator CLI contract.

## Conventions

| Item | Value |
|---|---|
| Transport | Firebase RTDB realtime listeners via `@react-native-firebase/database` |
| Base path | `/devices/{deviceId}` |
| Auth | Firebase Auth ID token (anonymous user). Required for every read. |
| Encoding | JSON; snake_case field names (firmware-facing) |
| Time | Unix seconds. Values > 10¹² are treated as milliseconds and divided by 1000. |
| Direction | ESP32 writes, app reads. The app performs **zero writes** under `/devices`. |
| Offline cache | `database().setPersistenceEnabled(true)` before first use. Cached data is shown only with an offline indicator (connectivity rules apply). |

## RTDB contract

### READ `/devices/{deviceId}/live` — Live reading

- **Auth:** signed-in user (`auth != null`).
- **Listener:** `ref.on('value', onValue, onError)`, attached by `subscriptionManager`.
- **Payload:** `LiveReadingRaw` ([03-data-model.md](03-data-model.md#live--livereadingraw)).
- **Outcomes:**

| Outcome | App behavior |
|---|---|
| Valid object | `parseLiveReading` → `deviceStore.setLive(reading, invalid, nowSeconds())` |
| Object with bad fields | Parsed with fallbacks; `invalid.voltage/current` set; still stored |
| `null` / non-object | `deviceStore.setLiveEmpty()` (dashboard shows "Waiting for device data") |
| `onError` `database/permission-denied` | `deviceStore.setError('db_permission_denied')`; Dashboard error state "No access to this device" + Retry (re-runs bootstrap) |

- **Example payload:**
```json
{ "line_fault": false, "fault_type": "none", "rain": false, "smoke": false,
  "smoke_ppm": 120, "voltage": 230.4, "current": 1.82, "ts": 1760000000 }
```

### READ `/devices/{deviceId}/status` — Device status

- **Auth:** signed-in user.
- **Listener:** `ref.on('value', ...)`.
- **Payload:** `DeviceStatusRaw`.
- **Outcomes:** valid → `setStatus`; `null`/invalid `last_seen` → `setStatus(null)` (connectivity falls back to the loading-timeout rule); permission error → as above.
- **Example:** `{ "last_seen": 1760000000, "rssi": -61 }`, or `{ "last_seen": 1760000000123 }` when written as a server timestamp.

### READ `/.info/connected` — Phone connectivity

- **Auth:** none (local Firebase SDK path).
- **Listener:** `ref.on('value', ...)` → `deviceStore.setPhoneConnected(snapshot.val() === true)`.

### QUERY `/devices/{deviceId}/history` — History range

- **Auth:** signed-in user.
- **Query:** `ref.orderByChild('ts').startAt(nowSeconds() − rangeSeconds).once('value')`.
- **Requires:** `.indexOn: ["ts"]` (otherwise Firebase logs a warning and downloads everything). The rules file in [06-security.md](06-security.md#rtdb-rules) includes it.
- **Live append (5 m range only):** `ref.orderByChild('ts').limitToLast(1).on('child_added', ...)`. Samples with `ts` already in the list are ignored (dedupe by key).
- **Outcomes:**

| Outcome | App behavior |
|---|---|
| Snapshot with children | `parseHistory` → sorted `HistorySample[]` → `{ status: 'success', samples }` |
| Empty snapshot | `{ status: 'success', samples: [] }` (UI shows the empty state) |
| Error | `{ status: 'error', error: 'db_query_failed' }` with `refetch()` |

- **Note on timestamps:** if the firmware writes `ts` in milliseconds, `startAt` in seconds would match everything. `useHistory` therefore detects the unit from the first returned sample. If it is milliseconds, it re-runs the query once with `startAt` in milliseconds and caches the detected unit for the session.

## Parsing rules

All functions live in `src/domain/parsers.ts`, are pure, and **never throw**.

```ts
export function toSeconds(t: number): number;                 // t > 1e12 ? Math.floor(t / 1000) : t
export function parseLiveReading(raw: unknown, lastValid: LiveReading | null, receivedAtS: number):
  { kind: 'empty' } | { kind: 'reading'; reading: LiveReading; invalid: InvalidFields };
export function parseStatus(raw: unknown): DeviceStatus | null;
export function parseHistory(raw: unknown): HistorySample[];   // sorted ascending by ts
```

| Field | Rule |
|---|---|
| object check | `raw` must be a non-null, non-array object, else `{ kind: 'empty' }` (live) / `null` (status) / `[]` (history) |
| booleans (`line_fault`, `rain`, `smoke`) | `value === true` → `true`; anything else → `false` |
| `fault_type` | If `line_fault` is `false` → `'none'`. Else if a known value → that value; else `'unknown'` |
| `voltage`, `current` | If `typeof === 'number' && Number.isFinite` → value; else `lastValid?.field ?? 0` and `invalid.field = true`. `current < 0` → `Math.abs` |
| `smoke_ppm` | Finite number ≥ 0 → value; else `null` |
| `ts` (live) | Finite number > 0 → `toSeconds(value)`; else `receivedAtS` |
| `ts` (history) | Finite number > 0 → `toSeconds(value)`; else **drop the sample** |
| `last_seen` | Finite number > 0 → `toSeconds(value)`; else the whole status is `null` |
| `rssi` | Finite number → value; else `null` |

In `__DEV__`, each fallback logs `logger.warn('parse', field, value)` once per field per session.

## Internal module interfaces

These are binding. Implementations may add private helpers but must keep these signatures.

### Domain (`src/domain/`)

```ts
// constants.ts — see 02-architecture.md#constants

// time.ts
export function nowSeconds(): number;
export function setClock(fn: () => number): void;   // tests only
export function resetClock(): void;

// connectivity.ts
export function computeConnectivity(i: {
  phoneConnected: boolean | null; lastSeenS: number | null; startedAtS: number; nowS: number;
}): Connectivity;

// derive.ts
export function power(voltage: number, current: number): number;          // Math.round(v * i)
export function voltageLevel(v: number, t: Settings['thresholds']): Level;
export function currentLevel(i: number, t: Settings['thresholds']): Level;
export function worstState(i: {
  connectivity: Connectivity; reading: LiveReading | null; thresholds: Settings['thresholds'];
}): WorstState;
export function activeAlerts(reading: LiveReading | null): AlertKey[];    // ordered line_fault, smoke, rain
export function faultTypeLabel(t: FaultType): string;                     // 'over_current' → 'Over current'
export function rssiBars(rssi: number | null): 0 | 1 | 2 | 3 | 4 | null;  // ≥-55:4, ≥-65:3, ≥-75:2, ≥-85:1, else 0

// alertEngine.ts — see 02-architecture.md#alert-engine
export const initialAlertState: AlertState;
export function reduceAlerts(s: AlertState, i: AlertInput): { state: AlertState; effects: AlertEffect[] };

// downsample.ts
export function downsampleLTTB(points: ChartPoint[], maxPoints: number): ChartPoint[];
// Returns input unchanged if length ≤ maxPoints; always keeps first and last points; preserves order.

// events.ts
export function extractEvents(samples: HistorySample[]): HistoryEvent[];  // newest first
export function groupEventsByDay(events: HistoryEvent[], nowS: number): { title: string; data: HistoryEvent[] }[];
```

`worstState` rules: `phone_offline`/`device_offline` pass through from connectivity. `loading` with a null reading → `ok`, since the UI shows skeletons, not the banner. Then `line_fault` → `smoke` → any `danger` level → `rain` → any `warning` level → `ok`.

### Services (`src/services/`)

```ts
// firebase.ts
export interface FirebaseService {
  ensureSignedIn(): Promise<string>;                 // returns uid; rejects AppError('auth_failed')
  db(): FirebaseDatabaseTypes.Module;                // configured instance (URL, emulator, persistence)
  ref(path: string): FirebaseDatabaseTypes.Reference;
}

// notifications.ts
export interface NotificationService {
  init(): Promise<void>;                             // creates the 3 channels; idempotent
  ensurePermission(opts: { prompt: boolean }): Promise<'granted' | 'denied'>;
  displayAlert(key: AlertKey, faultType?: FaultType): Promise<void>;   // fixed id `alert-${key}`
  cancelAlert(key: AlertKey): Promise<void>;
  openSettings(): Promise<void>;                     // app notification settings
  openBatteryOptimizationSettings(): Promise<void>;
}

// background.ts
export interface BackgroundService {
  start(): Promise<'started' | 'permission_denied'>;
  stop(): Promise<void>;
  update(text: string): Promise<void>;               // persistent notification body
  isRunning(): boolean;
}
export function registerForegroundTask(): void;      // called from index.js
export function registerBackgroundEvents(): void;    // handles 'stop' action press; called from index.js

// storage.ts
export interface StorageService {
  getJSON<T>(key: string): Promise<T | null>;        // null on missing or parse failure
  setJSON(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
  migrate(): Promise<void>;
}

// haptics.ts
export interface HapticService { alert(): void }      // 'notificationWarning' pattern
```

### Core (`src/core/`)

```ts
// bootstrap.ts
export function bootstrap(): Promise<void>;          // idempotent; concurrent calls share one promise

// subscriptionManager.ts
export function startSubscriptions(deviceId: string): void;
export function stopSubscriptions(): void;
export function switchDevice(deviceId: string): void; // stop → deviceStore.reset → start

// alertController.ts
export function startAlertController(): Promise<void>; // loads state for current device, subscribes
export function stopAlertController(): void;
```

### Hooks (`src/hooks/`)

```ts
export function useLive<T>(selector: (r: LiveReading | null) => T): T;
export function useConnectivity(): { connectivity: Connectivity; secondsSinceUpdate: number | null };
export function useWorstState(): WorstState;
export function useHistory(range: ChartRange | 'events'):
  { status: 'loading' | 'success' | 'error'; samples: HistorySample[]; refetch: () => void };
export function useReducedMotion(): boolean;
```

## Error model

```ts
export class AppError extends Error {
  constructor(public code: AppErrorCode, message: string, public cause?: unknown) { super(message); }
}
export type AppErrorCode =
  | 'auth_failed' | 'db_permission_denied' | 'db_query_failed'
  | 'notification_permission_denied' | 'storage_failed';
```

| Code | Raised by | Meaning | UI remedy |
|---|---|---|---|
| `auth_failed` | `ensureSignedIn` | Anonymous sign-in failed (no network, Anonymous provider disabled, bad config) | Dashboard error "Couldn't connect to the server" + Retry |
| `db_permission_denied` | listeners | Rules rejected the read (not signed in, wrong project, rules not deployed) | Dashboard error "No access to this device" + Retry |
| `db_query_failed` | `useHistory` | History query failed | Chart/History error card + Retry |
| `notification_permission_denied` | `ensurePermission`, `background.start` | User denied notifications | Permission card; background toggle reverts |
| `storage_failed` | `storageService` | AsyncStorage error | Logged; the app continues with in-memory state |

## Simulator CLI contract

`tools/simulator/simulate.ts`, run with `npm run sim -- <flags>`.

| Flag | Values | Default | Meaning |
|---|---|---|---|
| `--scenario` | file name in `scenarios/` without `.json` | `healthy` | Which scenario to play |
| `--device` | device id | `esp32_01` | Target device path |
| `--target` | `emulator` \| `project` | `emulator` | Emulator uses `FIREBASE_DATABASE_EMULATOR_HOST=127.0.0.1:9000`; project uses `GOOGLE_APPLICATION_CREDENTIALS` + `FIREBASE_DATABASE_URL` |
| `--interval` | seconds | `2` | Delay between steps |
| `--loop` | flag | off | Repeat the scenario until Ctrl+C |
| `--stale` | flag | off | Stop writing `/status` after the last step |
| `--clear` | flag | off | Delete `/devices/{device}` before starting |

Exit codes: `0` success, `1` invalid flags or scenario not found, `2` Firebase error. The simulator must refuse `--target project` unless `--yes` is also passed, to prevent accidental writes to production data.
