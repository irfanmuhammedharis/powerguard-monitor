import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_SETTINGS, type AppSettings } from '../models/settings';
const KEY = 'powerguard.settings.v1';

/** Raw stored value (unvalidated); callers run it through validateSettings. */
export async function readSettings(): Promise<AppSettings> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    return v ? (JSON.parse(v) as AppSettings) : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}
export async function saveSettings(settings: AppSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // keep running with in-memory settings
  }
}
