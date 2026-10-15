import AsyncStorage from '@react-native-async-storage/async-storage';

/** Typed JSON get/set. Never throws: a failure reads as null / is swallowed. */
export async function getJSON<T = unknown>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

export async function setJSON(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage failure must never take the monitor down; in-memory state continues.
  }
}

export async function removeKey(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // see above
  }
}

export const keys = {
  alertState: (deviceId: string) => `pg:alertState:v1:${deviceId}`,
  permissionAsked: 'pg:permissionAsked:v1',
  permissionCardDismissed: 'pg:permissionCardDismissed:v1',
};
