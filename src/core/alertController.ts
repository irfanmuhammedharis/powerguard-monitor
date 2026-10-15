import { Vibration } from 'react-native';
import {
  alertStateEquals,
  initialAlertState,
  parseAlertState,
  reduceAlerts,
  type AlertEffect,
  type AlertState,
} from '../domain/alertEngine';
import { computeConnectivity } from '../domain/connectivity';
import { nowSeconds } from '../domain/time';
import type { LiveReading } from '../models/device';
import {
  cancelAlert,
  displayAlert,
  requestPermissionOnce,
} from '../services/notifications';
import { getJSON, keys, setJSON } from '../services/storage';
import { settingsStore } from '../store/settingsStore';
import { feedStore } from './deviceFeed';

const HAPTIC_MS = 70;

let state: AlertState = initialAlertState;
let loadedFor: string | null = null;
let loading: string | null = null;
let lastLive: LiveReading | null = null;
let lastTs: number | null = null;
let askedPermission = false;

function dispatch(effects: AlertEffect[]): void {
  for (const effect of effects) {
    if (effect.type === 'notify') {
      displayAlert(effect.key, effect.faultType).catch(() => undefined);
    } else if (effect.type === 'cleared') {
      cancelAlert(effect.key).catch(() => undefined);
    } else {
      Vibration.vibrate(HAPTIC_MS);
    }
  }
}

async function load(deviceId: string): Promise<void> {
  loading = deviceId;
  const stored = await getJSON(keys.alertState(deviceId));
  if (loading !== deviceId) return; // the device changed while loading
  state = parseAlertState(stored);
  loadedFor = deviceId;
  loading = null;
  evaluate();
}

/**
 * One live sample in, at most one set of effects out. Both the foreground UI and the
 * foreground service run through this single instance, so they cannot disagree or
 * notify twice.
 */
function evaluate(): void {
  const feed = feedStore.get();

  if (feed.deviceId !== loadedFor) {
    if (loading !== feed.deviceId) {
      loadedFor = null;
      state = initialAlertState;
      lastLive = null;
      lastTs = null;
      load(feed.deviceId).catch(() => undefined);
    }
    return;
  }
  if (!feed.live || feed.live === lastLive) return;
  lastLive = feed.live;

  // The same sample can be delivered twice (cached value, then the server's, after a
  // reconnect). It must count once toward the 2-sample confirmation.
  if (feed.live.ts === lastTs) return;
  lastTs = feed.live.ts;

  if (!askedPermission) {
    askedPermission = true; // first live data: a sensible moment to ask (FR-14)
    requestPermissionOnce().catch(() => undefined);
  }

  const s = settingsStore.get().settings;
  const connectivity = computeConnectivity({
    phoneConnected: feed.phoneConnected,
    lastSeenS: feed.status?.last_seen ?? null,
    startedAtS: feed.startedAt,
    nowS: nowSeconds(),
  });
  const result = reduceAlerts(state, {
    reading: feed.live,
    connectivity,
    enabled: {
      line_fault: s.alertFault,
      smoke: s.alertSmoke,
      rain: s.alertRain,
    },
  });
  if (!alertStateEquals(state, result.state)) {
    state = result.state;
    setJSON(keys.alertState(feed.deviceId), state).catch(() => undefined);
  }
  dispatch(result.effects);
}

/** Starts watching the feed. Returns an unsubscribe function. */
export function startAlertController(): () => void {
  const unsubscribe = feedStore.subscribe(evaluate);
  evaluate();
  return unsubscribe;
}

/** Test hook: forget all in-memory state. */
export function resetAlertControllerForTests(): void {
  state = initialAlertState;
  loadedFor = null;
  loading = null;
  lastLive = null;
  lastTs = null;
  askedPermission = false;
}
