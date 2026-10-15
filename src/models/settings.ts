import type { ThemeMode } from '../theme/tokens';
export interface AppSettings {
  deviceId: string;
  alertFault: boolean;
  alertSmoke: boolean;
  alertRain: boolean;
  minVoltage: number;
  maxVoltage: number;
  maxCurrent: number;
  backgroundMonitoring: boolean;
  theme: ThemeMode;
}
export const DEFAULT_SETTINGS: AppSettings = {
  deviceId: 'esp32_01',
  alertFault: true,
  alertSmoke: true,
  alertRain: true,
  minVoltage: 180,
  maxVoltage: 260,
  maxCurrent: 10,
  backgroundMonitoring: false,
  theme: 'system',
};

export const DEVICE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
export const isValidDeviceId = (id: string): boolean =>
  DEVICE_ID_PATTERN.test(id);

/** Voltage limits must keep at least this gap (FR-8). */
export const MIN_VOLTAGE_GAP = 10;

export const LIMITS = {
  minVoltage: { min: 0, max: 400 },
  maxVoltage: { min: 10, max: 500 },
  maxCurrent: { min: 0.5, max: 100, step: 0.5 },
} as const;

const inRange = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

/**
 * Merges untrusted stored values over the defaults field by field. Any field that
 * fails validation falls back to its default. Never throws.
 */
export function validateSettings(raw: unknown): AppSettings {
  const d = DEFAULT_SETTINGS;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...d };
  const o = raw as Record<string, unknown>;
  const bool = (v: unknown, fallback: boolean) =>
    typeof v === 'boolean' ? v : fallback;

  let minVoltage = inRange(o.minVoltage, LIMITS.minVoltage.min, LIMITS.minVoltage.max)
    ? o.minVoltage
    : d.minVoltage;
  let maxVoltage = inRange(o.maxVoltage, LIMITS.maxVoltage.min, LIMITS.maxVoltage.max)
    ? o.maxVoltage
    : d.maxVoltage;
  if (minVoltage > maxVoltage - MIN_VOLTAGE_GAP) {
    minVoltage = d.minVoltage;
    maxVoltage = d.maxVoltage;
  }
  return {
    deviceId:
      typeof o.deviceId === 'string' && isValidDeviceId(o.deviceId)
        ? o.deviceId
        : d.deviceId,
    alertFault: bool(o.alertFault, d.alertFault),
    alertSmoke: bool(o.alertSmoke, d.alertSmoke),
    alertRain: bool(o.alertRain, d.alertRain),
    minVoltage,
    maxVoltage,
    maxCurrent: inRange(o.maxCurrent, LIMITS.maxCurrent.min, LIMITS.maxCurrent.max)
      ? o.maxCurrent
      : d.maxCurrent,
    backgroundMonitoring: bool(o.backgroundMonitoring, d.backgroundMonitoring),
    theme:
      o.theme === 'system' || o.theme === 'dark' || o.theme === 'light'
        ? o.theme
        : d.theme,
  };
}
