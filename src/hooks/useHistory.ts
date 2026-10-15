import { useCallback, useEffect, useState } from 'react';
import { CHART_RANGES, HISTORY_EVENTS_WINDOW_S, type ChartRange } from '../domain/constants';
import { nowSeconds } from '../domain/time';
import { parseHistory, type HistorySample } from '../models/device';
import { ensureAnonymousAuth, historyRef } from '../services/firebase';
import { useFeed } from './useFeed';

export type HistoryStatus = 'loading' | 'success' | 'error';

/**
 * Samples for a chart range (or the 24 h event window).
 *
 * Queries order by the `ts` child, never by key: the firmware stores history in a
 * 24 h ring buffer whose keys wrap, so key order is not chronological (ADR-0008).
 * The 5 min range also follows new samples live.
 */
export function useHistory(range: ChartRange | 'events'): {
  status: HistoryStatus;
  samples: HistorySample[];
  refetch: () => void;
} {
  const deviceId = useFeed(s => s.deviceId);
  const [state, setState] = useState<{ status: HistoryStatus; samples: HistorySample[] }>({
    status: 'loading',
    samples: [],
  });
  const [nonce, setNonce] = useState(0);
  const refetch = useCallback(() => setNonce(n => n + 1), []);
  const windowS = range === 'events' ? HISTORY_EVENTS_WINDOW_S : CHART_RANGES[range].seconds;

  useEffect(() => {
    if (!deviceId) return undefined;
    let active = true;
    let detach: (() => void) | null = null;
    setState(prev => ({ status: 'loading', samples: prev.samples }));

    ensureAnonymousAuth()
      .then(() => historyRef(deviceId).orderByChild('ts').startAt(nowSeconds() - windowS).once('value'))
      .then(snapshot => {
        if (!active) return;
        const cutoff = nowSeconds() - windowS;
        // Re-filter on the normalized ts: a firmware writing milliseconds would make the
        // seconds-based startAt match everything.
        const samples = parseHistory(snapshot.val()).filter(x => x.ts >= cutoff);
        setState({ status: 'success', samples });

        if (range === '5m') {
          const live = historyRef(deviceId).orderByChild('ts').limitToLast(1);
          const onAdded = (snap: { key: string | null; val(): unknown }) => {
            if (!active || !snap.key) return;
            const [added] = parseHistory({ [snap.key]: snap.val() });
            if (!added) return;
            setState(prev =>
              prev.samples.some(x => x.id === added.id)
                ? prev
                : { status: 'success', samples: [...prev.samples, added].sort((a, b) => a.ts - b.ts) },
            );
          };
          live.on('child_added', onAdded);
          detach = () => live.off('child_added', onAdded);
        }
      })
      .catch(() => {
        if (active) setState(prev => ({ status: 'error', samples: prev.samples }));
      });

    return () => {
      active = false;
      detach?.();
    };
  }, [deviceId, range, windowS, nonce]);

  return { ...state, refetch };
}
