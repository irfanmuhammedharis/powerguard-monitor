import { DEFAULT_SETTINGS, validateSettings, type AppSettings } from '../models/settings';
import { readSettings, saveSettings } from '../services/settings';
import { createStore, useStore } from './createStore';

interface SettingsState {
  settings: AppSettings;
  hydrated: boolean;
}

export const settingsStore = createStore<SettingsState>({
  settings: DEFAULT_SETTINGS,
  hydrated: false,
});

let hydration: Promise<void> | null = null;

/** Loads and validates stored settings once; safe to call from any entry point. */
export function hydrateSettings(): Promise<void> {
  if (!hydration) {
    hydration = readSettings().then(settings => {
      settingsStore.set({ settings: validateSettings(settings), hydrated: true });
    });
  }
  return hydration;
}

/**
 * Applies a patch and persists it. Waits for hydration first so a patch made from a
 * headless context (e.g. the notification "Stop" action) can never overwrite stored
 * settings with defaults.
 */
export async function patchSettings(patch: Partial<AppSettings>): Promise<void> {
  await hydrateSettings();
  const next = validateSettings({ ...settingsStore.get().settings, ...patch });
  settingsStore.set({ settings: next });
  await saveSettings(next);
}

export const useSettings = <S>(selector: (s: AppSettings) => S): S =>
  useStore(settingsStore, state => selector(state.settings));

export const useSettingsHydrated = (): boolean =>
  useStore(settingsStore, state => state.hydrated);
