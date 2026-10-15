/// <reference types="node" />
/**
 * Contract test: compiles the firmware's real payload serializer
 * (fault detection/lib/powerguard_core) and feeds its exact output through the app's
 * parsers. If either side drifts from powerguard-docs/03-data-model.md, this fails.
 * Requires g++ (the same toolchain PlatformIO's native tests use).
 */
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { parseHistory, parseLiveDetailed, parseStatus } from '../models/device';

interface Payload {
  name: string;
  path: string;
  body: Record<string, unknown>;
}

const root = path.resolve(__dirname, '..', '..');
const core = path.join(root, 'fault detection', 'lib', 'powerguard_core', 'src');

function firmwarePayloads(): Payload[] {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pg-contract-'));
  const bin = path.join(dir, 'dump');
  execFileSync('g++', [
    '-std=gnu++17',
    '-I',
    core,
    path.join(root, 'tools', 'rules-tests', 'firmware_payloads.cpp'),
    path.join(core, 'payload.cpp'),
    path.join(core, 'fault_detector.cpp'),
    '-o',
    bin,
  ]);
  return execFileSync(bin, { encoding: 'utf8' })
    .trim()
    .split('\n')
    .map(line => JSON.parse(line) as Payload);
}

const payloads = firmwarePayloads();
const get = (name: string): Payload => {
  const found = payloads.find(p => p.name === name);
  if (!found) throw new Error(`missing firmware payload ${name}`);
  return found;
};

describe('firmware -> app data contract', () => {
  it('parses a healthy live payload exactly, with no invalid fields', () => {
    const parsed = parseLiveDetailed(get('live-healthy').body);
    expect(parsed?.invalid).toEqual({ voltage: false, current: false });
    expect(parsed?.reading).toEqual({
      line_fault: false,
      fault_type: 'none',
      rain: false,
      smoke: false,
      smoke_ppm: 412,
      voltage: 230.4,
      current: 1.82,
      ts: 1_760_000_000,
    });
  });

  it.each([
    ['live-short', 'short'],
    ['live-over-current', 'over_current'],
    ['live-open-line', 'open_line'],
  ])('%s is a recognised fault type (%s), never "unknown"', (name, type) => {
    const reading = parseLiveDetailed(get(name).body)?.reading;
    expect(reading?.line_fault).toBe(true);
    expect(reading?.fault_type).toBe(type);
  });

  it('carries smoke and rain flags', () => {
    expect(parseLiveDetailed(get('live-smoke').body)?.reading).toMatchObject({
      smoke: true,
      smoke_ppm: 2310,
    });
    expect(parseLiveDetailed(get('live-rain').body)?.reading.rain).toBe(true);
  });

  it('omits smoke_ppm during MQ-135 warm-up, which the app shows as no ppm label', () => {
    expect('smoke_ppm' in get('live-warmup').body).toBe(false);
    expect(parseLiveDetailed(get('live-warmup').body)?.reading.smoke_ppm).toBeNull();
  });

  it('parses status written with local seconds', () => {
    expect(parseStatus(get('status-local-seconds').body)).toEqual({
      last_seen: 1_760_000_000,
      rssi: -61,
    });
  });

  it('accepts a server-timestamp last_seen (stored by RTDB as milliseconds)', () => {
    expect(get('status-server-timestamp').body.last_seen).toEqual({ '.sv': 'timestamp' });
    const stored = { ...get('status-server-timestamp').body, last_seen: 1_760_000_000_123 };
    expect(parseStatus(stored)).toEqual({ last_seen: 1_760_000_000, rssi: -61 });
  });

  it('status without rssi parses with rssi null (no signal indicator)', () => {
    const stored = { last_seen: 1_760_000_000_123 };
    expect(parseStatus(stored)?.rssi).toBeNull();
    expect('rssi' in get('status-no-rssi').body).toBe(false);
  });

  it('history ring-buffer slots parse and sort by ts even though keys wrap', () => {
    const slot = get('history-live-healthy');
    expect(slot.path).toMatch(/\/history\/\d{4}$/);
    const key = slot.path.split('/').pop() as string;
    const later = { ...slot.body, ts: 1_760_000_010 };
    // A wrapped buffer: the newest sample has the *lower* key.
    const rows = parseHistory({ '0005': later, [key]: slot.body, '0000': { ...slot.body, ts: 1_760_086_400 } });
    expect(rows.map(r => r.ts)).toEqual([1_760_000_000, 1_760_000_010, 1_760_086_400]);
  });

  it('every live payload uses only the documented fields', () => {
    const allowed = new Set([
      'line_fault', 'fault_type', 'rain', 'smoke', 'smoke_ppm', 'voltage', 'current', 'ts',
    ]);
    for (const p of payloads.filter(x => x.path.endsWith('/live'))) {
      expect(Object.keys(p.body).filter(k => !allowed.has(k))).toEqual([]);
      expect(typeof p.body.line_fault).toBe('boolean');
      expect(typeof p.body.ts).toBe('number');
    }
  });
});
