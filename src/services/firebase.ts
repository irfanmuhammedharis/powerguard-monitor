import auth from '@react-native-firebase/auth';
import database from '@react-native-firebase/database';

let signingIn: Promise<void> | null = null;

/**
 * Reuses the persisted session; concurrent callers share one sign-in request.
 * `async` on purpose: with a missing or broken Firebase config `auth()` throws
 * synchronously, and callers must see that as a rejected promise (-> the designed
 * "Couldn't connect" state), never as a crash inside a render or effect.
 */
export async function ensureAnonymousAuth(): Promise<void> {
  if (auth().currentUser) return;
  if (!signingIn) {
    signingIn = auth()
      .signInAnonymously()
      .then(() => undefined)
      .finally(() => {
        signingIn = null;
      });
  }
  await signingIn;
}
export const liveRef = (deviceId: string) =>
  database().ref(`/devices/${deviceId}/live`);
export const statusRef = (deviceId: string) =>
  database().ref(`/devices/${deviceId}/status`);
export const historyRef = (deviceId: string) =>
  database().ref(`/devices/${deviceId}/history`);
// React Native Firebase only accepts this special path without a leading slash.
export const connectionRef = () => database().ref('.info/connected');
