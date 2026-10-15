import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import {
  getPermissionStatus,
  type PermissionStatus,
} from '../services/notifications';
import { getJSON, keys, setJSON } from '../services/storage';

/** Notification permission, refreshed whenever the app returns to the foreground. */
export function usePermission(): {
  status: PermissionStatus | null;
  /** The system prompt has been shown at least once; before that, "off" is not a refusal. */
  asked: boolean;
  cardDismissed: boolean;
  dismissCard: () => void;
} {
  const [status, setStatus] = useState<PermissionStatus | null>(null);
  const [asked, setAsked] = useState(false);
  const [cardDismissed, setCardDismissed] = useState(true); // hidden until storage is read

  useEffect(() => {
    const refresh = () => {
      getPermissionStatus()
        .then(setStatus)
        .catch(() => undefined);
      getJSON<boolean>(keys.permissionAsked)
        .then(v => setAsked(v === true))
        .catch(() => undefined);
    };
    refresh();
    getJSON<boolean>(keys.permissionCardDismissed)
      .then(v => setCardDismissed(v === true))
      .catch(() => undefined);
    const sub = AppState.addEventListener(
      'change',
      s => s === 'active' && refresh(),
    );
    return () => sub.remove();
  }, []);

  const dismissCard = useCallback(() => {
    setCardDismissed(true);
    setJSON(keys.permissionCardDismissed, true).catch(() => undefined);
  }, []);

  return { status, asked, cardDismissed, dismissCard };
}
