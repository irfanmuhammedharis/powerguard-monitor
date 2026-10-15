import type { FirebaseDatabaseTypes } from '@react-native-firebase/database';
import {
  parseLiveDetailed,
  parseStatus,
  type DeviceStatus,
  type InvalidFields,
  type LiveReading,
} from '../models/device';
import { nowSeconds } from '../domain/time';
import {
  connectionRef,
  ensureAnonymousAuth,
  liveRef,
  statusRef,
} from '../services/firebase';
import { createStore } from '../store/createStore';

export type FeedError = 'auth_failed' | 'db_permission_denied' | null;

export interface FeedState {
  deviceId: string;
  live: LiveReading | null;
  invalid: InvalidFields;
  /** `/live` is null / not an object: show "Waiting for device data". */
  liveEmpty: boolean;
  status: DeviceStatus | null;
  phoneConnected: boolean | null;
  /** Unix seconds when this subscription started (loading-timeout origin). */
  startedAt: number;
  error: FeedError;
}

const fresh = (deviceId: string): FeedState => ({
  deviceId,
  live: null,
  invalid: { voltage: false, current: false },
  liveEmpty: false,
  status: null,
  phoneConnected: null,
  startedAt: nowSeconds(),
  error: null,
});

export const feedStore = createStore<FeedState>(fresh(''));

let detach: (() => void) | null = null;
let generation = 0; // invalidates in-flight sign-ins when the device changes

const isPermissionDenied = (error: unknown): boolean =>
  (error as { code?: string } | null)?.code === 'database/permission-denied';

/**
 * Owns the realtime listeners for one device: `/live`, `/status` and
 * `/.info/connected`. Runs whether or not any screen is mounted, which is what
 * lets alerts keep working while the foreground service holds the process.
 */
export function startFeed(deviceId: string): void {
  stopFeed();
  const gen = ++generation;
  feedStore.set(fresh(deviceId));

  ensureAnonymousAuth()
    .then(() => {
      if (gen !== generation) return;

      const live = liveRef(deviceId);
      const status = statusRef(deviceId);
      const conn = connectionRef();

      const onLive = (snap: FirebaseDatabaseTypes.DataSnapshot) => {
        const parsed = parseLiveDetailed(
          snap.val(),
          feedStore.get().live,
          nowSeconds(),
        );
        if (!parsed) {
          feedStore.set({ live: null, liveEmpty: true, error: null });
        } else {
          feedStore.set({
            live: parsed.reading,
            invalid: parsed.invalid,
            liveEmpty: false,
            error: null,
          });
        }
      };
      const onStatus = (snap: FirebaseDatabaseTypes.DataSnapshot) => {
        feedStore.set({ status: parseStatus(snap.val()) });
      };
      const onConn = (snap: FirebaseDatabaseTypes.DataSnapshot) => {
        feedStore.set({ phoneConnected: snap.val() === true });
      };
      const onError = (error: unknown) => {
        if (gen !== generation) return;
        if (isPermissionDenied(error)) {
          feedStore.set({ error: 'db_permission_denied' });
        }
      };

      live.on('value', onLive, onError);
      status.on('value', onStatus, onError);
      conn.on('value', onConn);
      detach = () => {
        live.off('value', onLive);
        status.off('value', onStatus);
        conn.off('value', onConn);
      };
    })
    .catch(() => {
      if (gen === generation) feedStore.set({ error: 'auth_failed' });
    });
}

export function stopFeed(): void {
  generation += 1;
  detach?.();
  detach = null;
}

/** Re-runs sign-in and re-attaches listeners for the current device. */
export function retryFeed(): void {
  startFeed(feedStore.get().deviceId);
}

/** Removes the old device's listeners, resets to loading, attaches the new ones. */
export function switchDevice(deviceId: string): void {
  if (deviceId === feedStore.get().deviceId) return;
  startFeed(deviceId);
}
