import type { FaultType, LiveReading } from '../models/device';
import type { Connectivity } from './connectivity';
import { ALERT_CONFIRM_SAMPLES } from './constants';
import { ALERT_KEYS, type AlertKey } from './derive';

export interface AlertKeyState {
  /** Consecutive true samples seen while online (capped at the confirm count). */
  streak: number;
  /** A notification was sent for the current episode. */
  notified: boolean;
}
export type AlertState = Record<AlertKey, AlertKeyState>;

export interface AlertInput {
  reading: LiveReading;
  connectivity: Connectivity;
  enabled: Record<AlertKey, boolean>;
}

export type AlertEffect =
  | { type: 'notify'; key: AlertKey; faultType?: FaultType }
  | { type: 'haptic' }
  | { type: 'cleared'; key: AlertKey };

export const initialAlertState: AlertState = {
  line_fault: { streak: 0, notified: false },
  smoke: { streak: 0, notified: false },
  tilt: { streak: 0, notified: false },
  rain: { streak: 0, notified: false },
};

/**
 * Pure alert reducer (02-architecture.md#alert-engine): no timers, I/O or clock.
 * A condition must be true on ALERT_CONFIRM_SAMPLES consecutive online samples
 * before it notifies, and notifies once per episode.
 *
 * `streak` is capped at the confirm count (behaviour-identical to counting
 * forever) so a long episode does not change the state, and therefore does not
 * trigger a storage write, on every sample.
 */
export function reduceAlerts(
  state: AlertState,
  input: AlertInput,
): { state: AlertState; effects: AlertEffect[] } {
  if (input.connectivity !== 'online') return { state, effects: [] };

  const effects: AlertEffect[] = [];
  const next: AlertState = { ...state };
  let notifiedAny = false;

  for (const key of ALERT_KEYS) {
    const active = input.reading[key];
    const cur = state[key];
    if (!active) {
      if (cur.notified) effects.push({ type: 'cleared', key });
      next[key] = { streak: 0, notified: false };
      continue;
    }
    const streak = Math.min(cur.streak + 1, ALERT_CONFIRM_SAMPLES);
    if (cur.notified) {
      next[key] = { streak, notified: true };
    } else if (streak >= ALERT_CONFIRM_SAMPLES && input.enabled[key]) {
      next[key] = { streak, notified: true };
      effects.push(
        key === 'line_fault'
          ? { type: 'notify', key, faultType: input.reading.fault_type }
          : { type: 'notify', key },
      );
      notifiedAny = true;
    } else {
      next[key] = { streak, notified: false };
    }
  }
  if (notifiedAny) effects.push({ type: 'haptic' });
  return { state: next, effects };
}

export function alertStateEquals(a: AlertState, b: AlertState): boolean {
  return ALERT_KEYS.every(
    k => a[k].streak === b[k].streak && a[k].notified === b[k].notified,
  );
}

/** Defensive parse of persisted state; anything malformed falls back to defaults. */
export function parseAlertState(raw: unknown): AlertState {
  if (!raw || typeof raw !== 'object') return initialAlertState;
  const o = raw as Record<string, unknown>;
  const out = { ...initialAlertState };
  for (const key of ALERT_KEYS) {
    const v = o[key] as Partial<AlertKeyState> | undefined;
    if (
      v &&
      typeof v.streak === 'number' &&
      Number.isFinite(v.streak) &&
      typeof v.notified === 'boolean'
    ) {
      out[key] = {
        streak: Math.max(0, Math.min(ALERT_CONFIRM_SAMPLES, Math.floor(v.streak))),
        notified: v.notified,
      };
    }
  }
  return out;
}
