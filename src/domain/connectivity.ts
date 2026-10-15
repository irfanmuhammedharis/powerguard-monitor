import { LOADING_TIMEOUT_S, OFFLINE_THRESHOLD_S } from './constants';

export type Connectivity =
  | 'loading'
  | 'online'
  | 'device_offline'
  | 'phone_offline';

export interface ConnectivityInput {
  /** `/.info/connected`; null until known (treated as connected). */
  phoneConnected: boolean | null;
  /** `status.last_seen` in unix seconds, or null if no status has arrived. */
  lastSeenS: number | null;
  /** When the current subscription started, unix seconds. */
  startedAtS: number;
  nowS: number;
}

/** Pure; see 02-architecture.md#connectivity-model. */
export function computeConnectivity(i: ConnectivityInput): Connectivity {
  if (i.phoneConnected === false) return 'phone_offline';
  if (i.lastSeenS === null) {
    return i.nowS - i.startedAtS <= LOADING_TIMEOUT_S
      ? 'loading'
      : 'device_offline';
  }
  return i.nowS - i.lastSeenS <= OFFLINE_THRESHOLD_S
    ? 'online'
    : 'device_offline';
}
