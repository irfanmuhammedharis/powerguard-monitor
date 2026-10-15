import { computeConnectivity } from './connectivity';

const base = { phoneConnected: true, lastSeenS: 1000, startedAtS: 900, nowS: 1005 };

describe('computeConnectivity', () => {
  it('is online when last_seen is within 15 s', () => {
    expect(computeConnectivity(base)).toBe('online');
    expect(computeConnectivity({ ...base, nowS: 1015 })).toBe('online');
  });

  it('is device_offline once last_seen is older than 15 s', () => {
    expect(computeConnectivity({ ...base, nowS: 1016 })).toBe('device_offline');
  });

  it('is loading until the 10 s timeout, then device_offline, when no status arrived', () => {
    const noStatus = { ...base, lastSeenS: null, startedAtS: 1000 };
    expect(computeConnectivity({ ...noStatus, nowS: 1000 })).toBe('loading');
    expect(computeConnectivity({ ...noStatus, nowS: 1010 })).toBe('loading');
    expect(computeConnectivity({ ...noStatus, nowS: 1011 })).toBe('device_offline');
  });

  it('phone_offline outranks everything', () => {
    expect(computeConnectivity({ ...base, phoneConnected: false })).toBe('phone_offline');
    expect(
      computeConnectivity({ ...base, phoneConnected: false, lastSeenS: null, nowS: 5000 }),
    ).toBe('phone_offline');
  });

  it('treats an unknown phone connection (null) as connected', () => {
    expect(computeConnectivity({ ...base, phoneConnected: null })).toBe('online');
  });

  it('recovers to online when a fresh last_seen arrives', () => {
    const stale = computeConnectivity({ ...base, nowS: 1100 });
    const fresh = computeConnectivity({ ...base, lastSeenS: 1099, nowS: 1100 });
    expect([stale, fresh]).toEqual(['device_offline', 'online']);
  });
});
