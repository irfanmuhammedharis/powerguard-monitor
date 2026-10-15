import notifee, {
  AndroidForegroundServiceType,
  EventType,
} from '@notifee/react-native';
import { patchSettings } from '../store/settingsStore';
import { CHANNEL, initNotifications } from './notifications';

const NOTIFICATION_ID = 'powerguard-monitoring';
let release: (() => void) | null = null;
let running = false;

/**
 * The foreground service only keeps the JS runtime (and with it the feed and the alert
 * controller singletons) alive. It creates no listeners of its own, which is what makes
 * duplicate alerts impossible. The returned promise never resolves until Stop.
 */
export function registerBackgroundMonitor(): void {
  notifee.registerForegroundService(
    () =>
      new Promise<void>(resolve => {
        release = resolve;
      }),
  );
}

async function show(text: string): Promise<void> {
  await initNotifications();
  await notifee.displayNotification({
    id: NOTIFICATION_ID,
    title: 'PowerGuard is monitoring',
    body: text,
    android: {
      channelId: CHANNEL.monitoring,
      smallIcon: 'ic_notification',
      asForegroundService: true,
      foregroundServiceTypes: [
        AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_SPECIAL_USE,
      ],
      actions: [{ title: 'Stop', pressAction: { id: 'stop' } }],
      pressAction: { id: 'default' },
    },
  });
}

export async function startBackgroundMonitor(text: string): Promise<void> {
  running = true;
  await show(text);
}

/** Refreshes the persistent notification text (e.g. on worst-state changes). */
export async function updateBackgroundText(text: string): Promise<void> {
  if (running) await show(text);
}

export async function stopBackgroundMonitor(): Promise<void> {
  running = false;
  release?.();
  release = null;
  await notifee.stopForegroundService();
  await notifee.cancelNotification(NOTIFICATION_ID);
}

export const isBackgroundMonitorRunning = (): boolean => running;

/** Handles the "Stop" action even when the app UI is not running. */
export function registerBackgroundEvents(): void {
  notifee.onBackgroundEvent(async ({ type, detail }) => {
    if (type !== EventType.ACTION_PRESS || detail.pressAction?.id !== 'stop') {
      return;
    }
    await stopBackgroundMonitor();
    await patchSettings({ backgroundMonitoring: false });
  });
}
