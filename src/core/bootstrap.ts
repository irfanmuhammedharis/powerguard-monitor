import { worstState, worstHeadline, thresholdsOf } from '../domain/derive';
import { computeConnectivity } from '../domain/connectivity';
import { nowSeconds } from '../domain/time';
import {
  startBackgroundMonitor,
  stopBackgroundMonitor,
  updateBackgroundText,
} from '../services/backgroundMonitor';
import { initNotifications } from '../services/notifications';
import { hydrateSettings, settingsStore } from '../store/settingsStore';
import { startAlertController } from './alertController';
import { feedStore, startFeed, switchDevice } from './deviceFeed';

let booted: Promise<void> | null = null;

function monitoringText(): string {
  const feed = feedStore.get();
  const connectivity = computeConnectivity({
    phoneConnected: feed.phoneConnected,
    lastSeenS: feed.status?.last_seen ?? null,
    startedAtS: feed.startedAt,
    nowS: nowSeconds(),
  });
  const worst = worstState({
    connectivity,
    reading: feed.live,
    thresholds: thresholdsOf(settingsStore.get().settings),
  });
  return worstHeadline(worst, feed.live);
}

async function run(): Promise<void> {
  initNotifications().catch(() => undefined);
  await hydrateSettings();

  const initial = settingsStore.get().settings;
  startFeed(initial.deviceId);
  startAlertController();

  let device = initial.deviceId;
  let background = initial.backgroundMonitoring;
  settingsStore.subscribe(() => {
    const s = settingsStore.get().settings;
    if (s.deviceId !== device) {
      device = s.deviceId;
      switchDevice(device);
    }
    if (s.backgroundMonitoring !== background) {
      background = s.backgroundMonitoring;
      (background
        ? startBackgroundMonitor(monitoringText())
        : stopBackgroundMonitor()
      ).catch(() => undefined);
    }
  });

  // Keep the persistent notification's text in step with the worst state.
  let lastText = monitoringText();
  feedStore.subscribe(() => {
    const text = monitoringText();
    if (text !== lastText) {
      lastText = text;
      updateBackgroundText(text).catch(() => undefined);
    }
  });

  if (background) await startBackgroundMonitor(lastText).catch(() => undefined);
}

/** Starts the runtime (settings, feed, alerts, background service). Idempotent. */
export function bootstrap(): Promise<void> {
  if (!booted) booted = run();
  return booted;
}
