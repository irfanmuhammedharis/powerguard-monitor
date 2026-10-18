import notifee, {
  AndroidImportance,
  AuthorizationStatus,
} from '@notifee/react-native';
import type { FaultType } from '../models/device';
import { alertLabel, type AlertKey } from '../domain/derive';
import { getJSON, keys, setJSON } from './storage';

export const CHANNEL = {
  critical: 'critical-alerts', // line fault, smoke, tilt
  weather: 'weather-alerts', // rain
  monitoring: 'monitoring-service', // persistent foreground-service notification
} as const;

const SMALL_ICON = 'ic_notification';

let channelsReady: Promise<void> | null = null;

/** Creates the three channels; idempotent and shared between callers. */
export function initNotifications(): Promise<void> {
  if (!channelsReady) {
    channelsReady = (async () => {
      await notifee.createChannel({
        id: CHANNEL.critical,
        name: 'Critical alerts',
        description: 'Line faults, smoke and tilt',
        importance: AndroidImportance.HIGH,
        vibration: true,
      });
      await notifee.createChannel({
        id: CHANNEL.weather,
        name: 'Weather alerts',
        description: 'Rain at the installation',
        importance: AndroidImportance.DEFAULT,
      });
      await notifee.createChannel({
        id: CHANNEL.monitoring,
        name: 'Background monitoring',
        importance: AndroidImportance.LOW,
      });
    })().catch(error => {
      channelsReady = null; // allow a retry on the next call
      throw error;
    });
  }
  return channelsReady;
}

export type PermissionStatus = 'granted' | 'denied';

export async function getPermissionStatus(): Promise<PermissionStatus> {
  const s = await notifee.getNotificationSettings();
  return s.authorizationStatus >= AuthorizationStatus.AUTHORIZED
    ? 'granted'
    : 'denied';
}

/**
 * Android 13+ prompt, shown at most once (after the first live data, not at
 * splash). Later calls only report the current status.
 */
export async function requestPermissionOnce(): Promise<PermissionStatus> {
  if (await getJSON<boolean>(keys.permissionAsked)) return getPermissionStatus();
  await setJSON(keys.permissionAsked, true);
  const s = await notifee.requestPermission();
  return s.authorizationStatus >= AuthorizationStatus.AUTHORIZED
    ? 'granted'
    : 'denied';
}

/** Used by the background-monitoring toggle, which needs an explicit answer. */
export async function ensurePermission(): Promise<PermissionStatus> {
  const current = await getPermissionStatus();
  if (current === 'granted') return current;
  const s = await notifee.requestPermission();
  return s.authorizationStatus >= AuthorizationStatus.AUTHORIZED
    ? 'granted'
    : 'denied';
}

const BODY: Record<AlertKey, string> = {
  line_fault: 'Check the installation as soon as it is safe to do so.',
  smoke: 'Smoke was detected at the installation.',
  tilt: 'The unit has tilted from its installed position.',
  rain: 'Rain was detected at the installation.',
};

/** Fixed id per key (`alert-<key>`), so an alert never appears twice in the shade. */
export async function displayAlert(
  key: AlertKey,
  faultType?: FaultType,
): Promise<void> {
  await initNotifications();
  await notifee.displayNotification({
    id: `alert-${key}`,
    title: alertLabel(key, faultType),
    body: BODY[key],
    android: {
      channelId: key === 'rain' ? CHANNEL.weather : CHANNEL.critical,
      smallIcon: SMALL_ICON,
      pressAction: { id: 'default' }, // tapping opens the app on the Dashboard
    },
  });
}

export async function cancelAlert(key: AlertKey): Promise<void> {
  await notifee.cancelNotification(`alert-${key}`);
}

export const openNotificationSettings = (): Promise<void> =>
  notifee.openNotificationSettings();

export const openBatteryOptimizationSettings = (): Promise<void> =>
  notifee.openBatteryOptimizationSettings();
