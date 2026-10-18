import {
  activeAlerts,
  alertLabel,
  currentLevel,
  faultTypeLabel,
  power,
  rssiBars,
  voltageLevel,
  worstState,
} from './derive';
import type { Connectivity } from './connectivity';
import { makeReading, thresholds } from '../test/factories';

describe('power', () => {
  it('rounds V x A to whole watts', () => {
    expect(power(230.4, 1.82)).toBe(419);
    expect(power(0, 5)).toBe(0);
  });
});

describe('voltageLevel (180-260 V)', () => {
  it.each([
    [179.9, 'danger'],
    [260.1, 'danger'],
    [180, 'warning'],
    [188.9, 'warning'],
    [189, 'ok'],
    [230, 'ok'],
    [247, 'ok'],
    [247.1, 'warning'],
    [260, 'warning'],
  ])('%f V is %s', (v, level) => {
    expect(voltageLevel(v, thresholds)).toBe(level);
  });
});

describe('currentLevel (10 A)', () => {
  it.each([
    [10.01, 'danger'],
    [10, 'warning'],
    [8.51, 'warning'],
    [8.5, 'ok'],
    [0, 'ok'],
  ])('%f A is %s', (a, level) => {
    expect(currentLevel(a, thresholds)).toBe(level);
  });
});

describe('worstState priority', () => {
  const online: Connectivity = 'online';
  const state = (o: Parameters<typeof makeReading>[0], connectivity: Connectivity = online) =>
    worstState({ connectivity, reading: makeReading(o), thresholds });

  it('is ok for a healthy reading', () => {
    expect(state({})).toBe('ok');
  });

  it('follows phone_offline > device_offline > line_fault > smoke > danger > rain > warning', () => {
    const all = { line_fault: true, fault_type: 'short' as const, smoke: true, rain: true, voltage: 300 };
    expect(state(all, 'phone_offline')).toBe('phone_offline');
    expect(state(all, 'device_offline')).toBe('device_offline');
    expect(state(all)).toBe('line_fault');
    expect(state({ ...all, line_fault: false })).toBe('smoke');
    expect(state({ ...all, line_fault: false, smoke: false, tilt: true })).toBe('tilt');
    expect(state({ ...all, line_fault: false, smoke: false })).toBe('threshold_danger');
    expect(state({ rain: true, voltage: 230 })).toBe('rain');
    expect(state({ voltage: 185 })).toBe('threshold_warning');
    expect(state({ rain: true, voltage: 185 })).toBe('rain');
  });

  it('is ok while loading with no reading (skeleton, not a banner)', () => {
    expect(worstState({ connectivity: 'loading', reading: null, thresholds })).toBe('ok');
  });

  it('does not flag a missing reading as out of range', () => {
    expect(worstState({ connectivity: 'online', reading: null, thresholds })).toBe('ok');
  });
});

describe('labels', () => {
  it('activeAlerts is ordered line_fault, smoke, tilt, rain', () => {
    expect(
      activeAlerts(makeReading({ rain: true, smoke: true, tilt: true, line_fault: true })),
    ).toEqual(['line_fault', 'smoke', 'tilt', 'rain']);
    expect(activeAlerts(null)).toEqual([]);
  });

  it('formats fault labels', () => {
    expect(faultTypeLabel('over_current')).toBe('Over current');
    expect(faultTypeLabel('unknown')).toBe('Unknown fault');
    expect(alertLabel('line_fault', 'over_current')).toBe('Line fault: Over current');
    expect(alertLabel('smoke')).toBe('Smoke detected');
    expect(alertLabel('tilt')).toBe('Tilt detected');
    expect(alertLabel('rain')).toBe('Rain detected');
  });

  it('maps RSSI to 0-4 bars', () => {
    expect([-50, -55, -60, -65, -70, -75, -80, -85, -90].map(rssiBars)).toEqual([
      4, 4, 3, 3, 2, 2, 1, 1, 0,
    ]);
    expect(rssiBars(null)).toBeNull();
  });
});
