import type { FaultType, LiveReading } from '../models/device';
import type { AppSettings } from '../models/settings';
import type { Connectivity } from './connectivity';
import { CURRENT_WARNING_RATIO, VOLTAGE_WARNING_MARGIN } from './constants';

export type Level = 'ok' | 'warning' | 'danger';
export type AlertKey = 'line_fault' | 'smoke' | 'tilt' | 'rain';
export const ALERT_KEYS: readonly AlertKey[] = ['line_fault', 'smoke', 'tilt', 'rain'];

export type WorstState =
  | 'phone_offline'
  | 'device_offline'
  | 'line_fault'
  | 'smoke'
  | 'tilt'
  | 'threshold_danger'
  | 'rain'
  | 'threshold_warning'
  | 'ok';

export interface Thresholds {
  minVoltage: number;
  maxVoltage: number;
  maxCurrent: number;
}

export const thresholdsOf = (s: AppSettings): Thresholds => ({
  minVoltage: s.minVoltage,
  maxVoltage: s.maxVoltage,
  maxCurrent: s.maxCurrent,
});

export const power = (voltage: number, current: number): number =>
  Math.round(voltage * current);

export function voltageLevel(v: number, t: Thresholds): Level {
  if (v < t.minVoltage || v > t.maxVoltage) return 'danger';
  if (
    v < t.minVoltage * (1 + VOLTAGE_WARNING_MARGIN) ||
    v > t.maxVoltage * (1 - VOLTAGE_WARNING_MARGIN)
  ) {
    return 'warning';
  }
  return 'ok';
}

export function currentLevel(i: number, t: Thresholds): Level {
  if (i > t.maxCurrent) return 'danger';
  if (i > t.maxCurrent * CURRENT_WARNING_RATIO) return 'warning';
  return 'ok';
}

export function worstState(i: {
  connectivity: Connectivity;
  reading: LiveReading | null;
  thresholds: Thresholds;
}): WorstState {
  if (i.connectivity === 'phone_offline') return 'phone_offline';
  if (i.connectivity === 'device_offline') return 'device_offline';
  const r = i.reading;
  if (!r) return 'ok'; // loading: the UI shows skeletons, not the banner
  if (r.line_fault) return 'line_fault';
  if (r.smoke) return 'smoke';
  if (r.tilt) return 'tilt';
  const levels = [
    voltageLevel(r.voltage, i.thresholds),
    currentLevel(r.current, i.thresholds),
  ];
  if (levels.includes('danger')) return 'threshold_danger';
  if (r.rain) return 'rain';
  if (levels.includes('warning')) return 'threshold_warning';
  return 'ok';
}

/** Active alert conditions in display order. */
export function activeAlerts(reading: LiveReading | null): AlertKey[] {
  if (!reading) return [];
  return ALERT_KEYS.filter(k => reading[k]);
}

const FAULT_LABELS: Record<FaultType, string> = {
  none: 'None',
  over_current: 'Over current',
  under_voltage: 'Under voltage',
  over_voltage: 'Over voltage',
  open_line: 'Open line',
  short: 'Short circuit',
  unknown: 'Unknown fault',
};
export const faultTypeLabel = (t: FaultType): string => FAULT_LABELS[t];

export function alertLabel(key: AlertKey, faultType?: FaultType): string {
  if (key === 'line_fault') {
    return `Line fault: ${faultTypeLabel(faultType ?? 'unknown')}`;
  }
  if (key === 'smoke') return 'Smoke detected';
  return key === 'tilt' ? 'Tilt detected' : 'Rain detected';
}

/** 0-4 bars: >=-55:4, >=-65:3, >=-75:2, >=-85:1, else 0; null when unknown. */
export function rssiBars(rssi: number | null): 0 | 1 | 2 | 3 | 4 | null {
  if (rssi === null) return null;
  if (rssi >= -55) return 4;
  if (rssi >= -65) return 3;
  if (rssi >= -75) return 2;
  if (rssi >= -85) return 1;
  return 0;
}

export const LEVEL_LABEL: Record<Level, string> = {
  ok: 'Normal',
  warning: 'Near limit',
  danger: 'Out of range',
};

/** Banner text for a worst state (also the foreground-service notification body). */
export function worstHeadline(
  state: WorstState,
  reading: LiveReading | null,
): string {
  switch (state) {
    case 'phone_offline':
      return 'You\u2019re offline';
    case 'device_offline':
      return 'Device offline';
    case 'line_fault':
      return `Line fault: ${faultTypeLabel(reading?.fault_type ?? 'unknown')}`;
    case 'smoke':
      return 'Smoke detected';
    case 'tilt':
      return 'Tilt detected';
    case 'threshold_danger':
      return 'Out of range';
    case 'rain':
      return 'Rain detected';
    case 'threshold_warning':
      return 'Near limit';
    default:
      return 'All systems normal';
  }
}
