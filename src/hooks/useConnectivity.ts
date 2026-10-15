import { useEffect, useState } from 'react';
import { CONNECTIVITY_TICK_MS } from '../domain/constants';
import { computeConnectivity, type Connectivity } from '../domain/connectivity';
import { nowSeconds } from '../domain/time';
import { useFeed } from './useFeed';

/** Re-evaluated every second so staleness is noticed without a new RTDB event. */
export function useConnectivity(): {
  connectivity: Connectivity;
  secondsSinceUpdate: number | null;
  lastSeenS: number | null;
} {
  const phoneConnected = useFeed(s => s.phoneConnected);
  const lastSeenS = useFeed(s => s.status?.last_seen ?? null);
  const startedAt = useFeed(s => s.startedAt);
  const [nowS, setNowS] = useState(nowSeconds());

  useEffect(() => {
    setNowS(nowSeconds());
    const timer = setInterval(() => setNowS(nowSeconds()), CONNECTIVITY_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  return {
    connectivity: computeConnectivity({
      phoneConnected,
      lastSeenS,
      startedAtS: startedAt,
      nowS,
    }),
    secondsSinceUpdate: lastSeenS === null ? null : Math.max(0, nowS - lastSeenS),
    lastSeenS,
  };
}
