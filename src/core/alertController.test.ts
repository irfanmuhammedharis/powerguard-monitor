import AsyncStorage from '@react-native-async-storage/async-storage';
import { Vibration } from 'react-native';
import { makeReading } from '../test/factories';
import { DEFAULT_SETTINGS } from '../models/settings';
import { feedStore } from './deviceFeed';
import { resetAlertControllerForTests, startAlertController } from './alertController';
import { settingsStore } from '../store/settingsStore';
import * as notifications from '../services/notifications';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('../services/notifications', () => ({
  displayAlert: jest.fn().mockResolvedValue(undefined),
  cancelAlert: jest.fn().mockResolvedValue(undefined),
  requestPermissionOnce: jest.fn().mockResolvedValue('granted'),
}));
// The feed module pulls in native Firebase; only its store is needed here.
jest.mock('../services/firebase', () => ({}));

const NOW = 1_760_000_100;
const flush = () => new Promise<void>(resolve => setImmediate(resolve));

/** Delivers one live sample the way the Firebase listener would. */
function deliver(overrides: Parameters<typeof makeReading>[0], tsOffset: number) {
  feedStore.set({ live: makeReading({ ts: NOW + tsOffset, ...overrides }) });
}

let stop: () => void;

async function startOnline(deviceId = 'esp32_01') {
  feedStore.set({
    deviceId,
    live: null,
    status: { last_seen: NOW, rssi: -60 },
    phoneConnected: true,
    startedAt: NOW - 100,
    error: null,
  });
  stop = startAlertController();
  await flush(); // alert state loads from storage
}

beforeEach(async () => {
  jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });
  jest.setSystemTime(NOW * 1000);
  jest.spyOn(Vibration, 'vibrate').mockImplementation(() => undefined);
  jest.clearAllMocks();
  await AsyncStorage.clear();
  resetAlertControllerForTests();
  settingsStore.set({ settings: DEFAULT_SETTINGS, hydrated: true });
});

afterEach(() => {
  stop?.();
  jest.useRealTimers();
});

describe('alertController', () => {
  it('notifies once after two distinct samples and vibrates once', async () => {
    await startOnline();
    deliver({ smoke: true }, 0);
    expect(notifications.displayAlert).not.toHaveBeenCalled();
    deliver({ smoke: true }, 2);
    deliver({ smoke: true }, 4);
    expect(notifications.displayAlert).toHaveBeenCalledTimes(1);
    expect(notifications.displayAlert).toHaveBeenCalledWith('smoke', undefined);
    expect(Vibration.vibrate).toHaveBeenCalledTimes(1);
  });

  it('counts a re-delivered identical sample (same ts) only once', async () => {
    await startOnline();
    deliver({ smoke: true }, 0);
    deliver({ smoke: true }, 0); // cached value then server value after a reconnect
    deliver({ smoke: true }, 0);
    expect(notifications.displayAlert).not.toHaveBeenCalled();
    deliver({ smoke: true }, 2);
    expect(notifications.displayAlert).toHaveBeenCalledTimes(1);
  });

  it('passes the fault type for line faults', async () => {
    await startOnline();
    deliver({ line_fault: true, fault_type: 'over_current' }, 0);
    deliver({ line_fault: true, fault_type: 'over_current' }, 2);
    expect(notifications.displayAlert).toHaveBeenCalledWith('line_fault', 'over_current');
  });

  it('cancels the notification when the condition clears', async () => {
    await startOnline();
    deliver({ rain: true }, 0);
    deliver({ rain: true }, 2);
    deliver({}, 4);
    expect(notifications.cancelAlert).toHaveBeenCalledWith('rain');
  });

  it('respects the per-type setting', async () => {
    settingsStore.set({ settings: { ...DEFAULT_SETTINGS, alertSmoke: false } });
    await startOnline();
    deliver({ smoke: true }, 0);
    deliver({ smoke: true }, 2);
    expect(notifications.displayAlert).not.toHaveBeenCalled();
  });

  it('raises nothing while the device is offline (stale last_seen)', async () => {
    await startOnline();
    feedStore.set({ status: { last_seen: NOW - 60, rssi: -60 } });
    deliver({ smoke: true }, 0);
    deliver({ smoke: true }, 2);
    expect(notifications.displayAlert).not.toHaveBeenCalled();
  });

  it('raises nothing while the phone is offline', async () => {
    await startOnline();
    feedStore.set({ phoneConnected: false });
    deliver({ smoke: true }, 0);
    deliver({ smoke: true }, 2);
    expect(notifications.displayAlert).not.toHaveBeenCalled();
  });

  it('persists alert state, so a restart mid-episode does not notify again', async () => {
    await startOnline();
    deliver({ smoke: true }, 0);
    deliver({ smoke: true }, 2);
    expect(notifications.displayAlert).toHaveBeenCalledTimes(1);
    await flush();

    // "Restart": drop all in-memory state, keep storage.
    stop();
    resetAlertControllerForTests();
    jest.clearAllMocks();
    await startOnline();
    deliver({ smoke: true }, 10);
    deliver({ smoke: true }, 12);
    expect(notifications.displayAlert).not.toHaveBeenCalled();
  });

  it('keeps alert state separate per device', async () => {
    await startOnline('esp32_01');
    deliver({ smoke: true }, 0);
    deliver({ smoke: true }, 2);
    await flush();
    expect(notifications.displayAlert).toHaveBeenCalledTimes(1);

    // Switching device resets the feed; the new device has its own (empty) state.
    feedStore.set({ deviceId: 'esp32_02', live: null });
    await flush();
    deliver({ smoke: true }, 4);
    deliver({ smoke: true }, 6);
    expect(notifications.displayAlert).toHaveBeenCalledTimes(2);
    expect(await AsyncStorage.getItem('pg:alertState:v1:esp32_01')).toContain('"notified":true');
  });

  it('requests notification permission once, after the first live data', async () => {
    await startOnline();
    expect(notifications.requestPermissionOnce).not.toHaveBeenCalled();
    deliver({}, 0);
    deliver({}, 2);
    expect(notifications.requestPermissionOnce).toHaveBeenCalledTimes(1);
  });
});
