// The only source of these numbers (powerguard-docs/02-architecture.md#constants).
export const LIVE_INTERVAL_S = 2;
export const HISTORY_INTERVAL_S = 10;
export const OFFLINE_THRESHOLD_S = 15;
export const LOADING_TIMEOUT_S = 10;
export const CONNECTIVITY_TICK_MS = 1000;
export const ALERT_CONFIRM_SAMPLES = 2;
export const VOLTAGE_WARNING_MARGIN = 0.05;
export const CURRENT_WARNING_RATIO = 0.85;
export const MS_TIMESTAMP_THRESHOLD = 1e12;
export const HISTORY_EVENTS_WINDOW_S = 86_400;

export type ChartRange = '5m' | '1h' | '24h';
export const CHART_RANGES: Record<
  ChartRange,
  { seconds: number; maxPoints: number; label: string }
> = {
  '5m': { seconds: 300, maxPoints: 30, label: '5 min' },
  '1h': { seconds: 3600, maxPoints: 120, label: '1 h' },
  '24h': { seconds: 86_400, maxPoints: 150, label: '24 h' },
};
