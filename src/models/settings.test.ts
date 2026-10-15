import {
  DEFAULT_SETTINGS,
  isValidDeviceId,
  validateSettings,
} from './settings';

describe('validateSettings', () => {
  it('returns defaults for missing or corrupt input', () => {
    for (const raw of [undefined, null, 'x', 5, [], '{"deviceId":1}']) {
      expect(validateSettings(raw)).toEqual(DEFAULT_SETTINGS);
    }
  });

  it('keeps valid fields and replaces invalid ones individually', () => {
    const s = validateSettings({
      deviceId: 'esp32_02',
      alertSmoke: false,
      alertRain: 'no',
      maxCurrent: 'lots',
      theme: 'dark',
      minVoltage: 200,
    });
    expect(s.deviceId).toBe('esp32_02');
    expect(s.alertSmoke).toBe(false);
    expect(s.alertRain).toBe(true);
    expect(s.maxCurrent).toBe(10);
    expect(s.theme).toBe('dark');
    expect(s.minVoltage).toBe(200);
  });

  it('rejects out-of-range and non-finite numbers', () => {
    expect(validateSettings({ maxCurrent: 0 }).maxCurrent).toBe(10);
    expect(validateSettings({ maxCurrent: 101 }).maxCurrent).toBe(10);
    expect(validateSettings({ maxCurrent: NaN }).maxCurrent).toBe(10);
    expect(validateSettings({ maxCurrent: 0.5 }).maxCurrent).toBe(0.5);
  });

  it('keeps voltageMin at least 10 V below voltageMax', () => {
    const s = validateSettings({ minVoltage: 250, maxVoltage: 255 });
    expect([s.minVoltage, s.maxVoltage]).toEqual([180, 260]);
    expect(validateSettings({ minVoltage: 240, maxVoltage: 250 }).minVoltage).toBe(240);
  });

  it('rejects an invalid device id', () => {
    expect(validateSettings({ deviceId: '../x' }).deviceId).toBe('esp32_01');
    expect(validateSettings({ deviceId: '' }).deviceId).toBe('esp32_01');
  });
});

describe('isValidDeviceId', () => {
  it.each([
    ['esp32_01', true],
    ['A-b_9', true],
    ['x'.repeat(64), true],
    ['x'.repeat(65), false],
    ['', false],
    ['a b', false],
    ['a/b', false],
    ['é', false],
  ])('%s -> %s', (id, ok) => {
    expect(isValidDeviceId(id)).toBe(ok);
  });
});
