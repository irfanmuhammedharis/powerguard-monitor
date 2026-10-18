import {
  parseHistory,
  parseLive,
  parseLiveDetailed,
  parseStatus,
  toSeconds,
} from './device';

const valid = {
  line_fault: true,
  fault_type: 'over_current',
  rain: false,
  smoke: true,
  smoke_ppm: 0,
  voltage: 230.4,
  current: 1.82,
  ts: 1_760_000_000,
};

describe('device data parsing', () => {
  it('normalizes millisecond timestamps', () => {
    expect(toSeconds(1_760_000_000_123)).toBe(1_760_000_000);
    expect(parseStatus({ last_seen: 1_760_000_000_123 })?.last_seen).toBe(
      1_760_000_000,
    );
  });

  it('accepts only true booleans and keeps zero smoke readings', () => {
    const reading = parseLive({ ...valid, rain: 1, smoke_ppm: 0 });
    expect(reading?.rain).toBe(false);
    expect(reading?.smoke_ppm).toBe(0);
  });

  it('parses tilt and drops invalid tilt angles', () => {
    expect(parseLive({ ...valid, tilt: true, tilt_deg: 12.5 })).toMatchObject({
      tilt: true,
      tilt_deg: 12.5,
    });
    // Older firmware sends neither field
    expect(parseLive(valid)).toMatchObject({ tilt: false, tilt_deg: null });
    expect(parseLive({ ...valid, tilt: 'yes', tilt_deg: -3 })).toMatchObject({
      tilt: false,
      tilt_deg: null,
    });
  });

  it('uses last valid measurements when incoming numeric data is invalid', () => {
    const previous = parseLive(valid, null, 1_760_000_001);
    const reading = parseLive(
      { ...valid, voltage: 'bad', current: Number.POSITIVE_INFINITY },
      previous,
      1_760_000_002,
    );
    expect(reading?.voltage).toBe(230.4);
    expect(reading?.current).toBe(1.82);
  });

  it('uses receive time for a missing live timestamp', () => {
    expect(
      parseLive({ ...valid, ts: undefined }, null, 1_760_000_123)?.ts,
    ).toBe(1_760_000_123);
  });

  it('reports unknown faults and rejects non-object payloads', () => {
    expect(
      parseLive({ ...valid, fault_type: 'unrecognized' })?.fault_type,
    ).toBe('unknown');
    expect(parseLive([])).toBeNull();
    expect(parseStatus({ last_seen: 0 })).toBeNull();
  });

  it('flags invalid voltage/current while keeping the last valid value', () => {
    const previous = parseLive(valid, null, 1)!;
    const result = parseLiveDetailed({ ...valid, voltage: 'abc', current: undefined }, previous, 2)!;
    expect(result.invalid).toEqual({ voltage: true, current: true });
    expect(result.reading.voltage).toBe(230.4);
    expect(parseLiveDetailed(valid)!.invalid).toEqual({ voltage: false, current: false });
    expect(parseLiveDetailed(null)).toBeNull();
  });

  it('parses history: drops samples without a valid ts, sorts ascending, normalizes ms', () => {
    const rows = parseHistory({
      '0002': { ...valid, ts: 1_760_000_020 },
      '0000': { ...valid, ts: 1_760_000_000_000 }, // milliseconds
      '0001': { ...valid, ts: undefined },
      '0003': 'garbage',
      '0004': { ...valid, ts: -5 },
    });
    expect(rows.map(r => r.id)).toEqual(['0000', '0002']);
    expect(rows[0].ts).toBe(1_760_000_000);
    expect(parseHistory(null)).toEqual([]);
    expect(parseHistory([])).toEqual([]);
  });
});
