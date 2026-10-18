export type FaultType =
  | 'none'
  | 'over_current'
  | 'under_voltage'
  | 'over_voltage'
  | 'open_line'
  | 'short'
  | 'unknown';
export interface LiveReading {
  line_fault: boolean;
  fault_type: FaultType;
  rain: boolean;
  smoke: boolean;
  smoke_ppm: number | null;
  /** Unit has moved beyond the firmware's limit from its power-on position. */
  tilt: boolean;
  /** Degrees from the power-on position; null when not reported. */
  tilt_deg: number | null;
  voltage: number;
  current: number;
  ts: number;
}
export interface DeviceStatus {
  last_seen: number;
  rssi: number | null;
}
export interface HistorySample extends LiveReading {
  id: string;
}
export interface InvalidFields {
  voltage: boolean;
  current: boolean;
}
export const EMPTY_READING: LiveReading = {
  line_fault: false,
  fault_type: 'none',
  rain: false,
  smoke: false,
  smoke_ppm: null,
  tilt: false,
  tilt_deg: null,
  voltage: 0,
  current: 0,
  ts: 0,
};
import { MS_TIMESTAMP_THRESHOLD } from '../domain/constants';
const numeric = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;
const faults: Exclude<FaultType, 'unknown'>[] = [
  'none',
  'over_current',
  'under_voltage',
  'over_voltage',
  'open_line',
  'short',
];
export function toSeconds(value: number): number {
  return value > MS_TIMESTAMP_THRESHOLD ? Math.floor(value / 1000) : value;
}

export function parseLiveDetailed(
  value: unknown,
  lastValid: LiveReading | null = null,
  receivedAt = Math.floor(Date.now() / 1000),
): { reading: LiveReading; invalid: InvalidFields } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const o = value as Record<string, unknown>;
  const voltage = numeric(o.voltage);
  const current = numeric(o.current);
  const ts = numeric(o.ts);
  const smokePpm = numeric(o.smoke_ppm);
  const tiltDeg = numeric(o.tilt_deg);
  const lineFault = o.line_fault === true;
  return {
    reading: {
      line_fault: lineFault,
      fault_type: !lineFault
        ? 'none'
        : faults.includes(o.fault_type as (typeof faults)[number])
        ? (o.fault_type as (typeof faults)[number])
        : 'unknown',
      rain: o.rain === true,
      smoke: o.smoke === true,
      smoke_ppm: smokePpm !== null && smokePpm >= 0 ? smokePpm : null,
      tilt: o.tilt === true,
      tilt_deg: tiltDeg !== null && tiltDeg >= 0 ? tiltDeg : null,
      voltage: voltage ?? lastValid?.voltage ?? 0,
      current: Math.abs(current ?? lastValid?.current ?? 0),
      ts: ts !== null && ts > 0 ? toSeconds(ts) : receivedAt,
    },
    invalid: { voltage: voltage === null, current: current === null },
  };
}

export function parseLive(
  value: unknown,
  lastValid: LiveReading | null = null,
  receivedAt = Math.floor(Date.now() / 1000),
): LiveReading | null {
  return parseLiveDetailed(value, lastValid, receivedAt)?.reading ?? null;
}

/** Parses a `/history` snapshot: drops samples without a valid ts, sorted ascending. */
export function parseHistory(value: unknown): HistorySample[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>)
    .flatMap(([id, item]) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
      const ts = numeric((item as Record<string, unknown>).ts);
      if (ts === null || ts <= 0) return [];
      const reading = parseLive(item, null, 0);
      return reading ? [{ ...reading, id }] : [];
    })
    .sort((a, b) => a.ts - b.ts);
}

export function parseStatus(value: unknown): DeviceStatus | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const lastSeen = numeric(raw.last_seen);
  if (lastSeen === null || lastSeen <= 0) return null;
  return { last_seen: toSeconds(lastSeen), rssi: numeric(raw.rssi) };
}
