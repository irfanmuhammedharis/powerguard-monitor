import type { HistorySample, LiveReading } from '../models/device';

export const healthy: LiveReading = {
  line_fault: false,
  fault_type: 'none',
  rain: false,
  smoke: false,
  smoke_ppm: 412,
  tilt: false,
  tilt_deg: 0.4,
  voltage: 230.4,
  current: 1.82,
  ts: 1_760_000_000,
};

export const makeReading = (o: Partial<LiveReading> = {}): LiveReading => ({
  ...healthy,
  ...o,
});

export const makeSample = (
  id: string,
  o: Partial<LiveReading> = {},
): HistorySample => ({ ...healthy, ...o, id });

export const thresholds = { minVoltage: 180, maxVoltage: 260, maxCurrent: 10 };
