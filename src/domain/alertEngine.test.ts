import {
  alertStateEquals,
  initialAlertState,
  parseAlertState,
  reduceAlerts,
  type AlertState,
} from './alertEngine';
import type { Connectivity } from './connectivity';
import { makeReading } from '../test/factories';

const enabled = { line_fault: true, smoke: true, tilt: true, rain: true };

type Reading = Parameters<typeof makeReading>[0];
function run(
  steps: Reading[],
  opts: { connectivity?: Connectivity; enabled?: typeof enabled; from?: AlertState } = {},
) {
  let state = opts.from ?? initialAlertState;
  const all: ReturnType<typeof reduceAlerts>['effects'][] = [];
  for (const step of steps) {
    const r = reduceAlerts(state, {
      reading: makeReading(step),
      connectivity: opts.connectivity ?? 'online',
      enabled: opts.enabled ?? enabled,
    });
    state = r.state;
    all.push(r.effects);
  }
  return { state, effects: all };
}

describe('reduceAlerts', () => {
  it('notifies exactly once after 2 consecutive true samples, with one haptic', () => {
    const { effects } = run([{ smoke: true }, { smoke: true }, { smoke: true }, { smoke: true }]);
    expect(effects[0]).toEqual([]);
    expect(effects[1]).toEqual([{ type: 'notify', key: 'smoke' }, { type: 'haptic' }]);
    expect(effects[2]).toEqual([]);
    expect(effects[3]).toEqual([]);
  });

  it('confirms and clears a tilt episode like the other alerts', () => {
    const { effects } = run([{ tilt: true }, { tilt: true }, {}]);
    expect(effects[1]).toEqual([{ type: 'notify', key: 'tilt' }, { type: 'haptic' }]);
    expect(effects[2]).toEqual([{ type: 'cleared', key: 'tilt' }]);
  });

  it('suppresses a single-sample glitch', () => {
    const { effects, state } = run([{ smoke: true }, {}, {}]);
    expect(effects.flat()).toEqual([]);
    expect(state.smoke).toEqual({ streak: 0, notified: false });
  });

  it('a glitch between two true samples restarts the confirmation', () => {
    const { effects } = run([{ smoke: true }, {}, { smoke: true }]);
    expect(effects.flat()).toEqual([]);
  });

  it('re-notifies for a new episode after clearing, and emits cleared', () => {
    const { effects } = run([
      { smoke: true }, { smoke: true }, // notify
      {},                                // cleared
      { smoke: true }, { smoke: true }, // notify again
    ]);
    expect(effects[1]).toContainEqual({ type: 'notify', key: 'smoke' });
    expect(effects[2]).toEqual([{ type: 'cleared', key: 'smoke' }]);
    expect(effects[4]).toContainEqual({ type: 'notify', key: 'smoke' });
  });

  it('carries the fault type for line faults', () => {
    const { effects } = run([
      { line_fault: true, fault_type: 'over_current' },
      { line_fault: true, fault_type: 'over_current' },
    ]);
    expect(effects[1]).toContainEqual({ type: 'notify', key: 'line_fault', faultType: 'over_current' });
  });

  it('fires one haptic even when several alerts fire together', () => {
    const both = { smoke: true, rain: true };
    const { effects } = run([both, both]);
    const flat = effects[1];
    expect(flat.filter(e => e.type === 'notify')).toHaveLength(2);
    expect(flat.filter(e => e.type === 'haptic')).toHaveLength(1);
  });

  it('does nothing for a disabled type but keeps counting', () => {
    const off = { ...enabled, smoke: false };
    const { effects, state } = run([{ smoke: true }, { smoke: true }, { smoke: true }], { enabled: off });
    expect(effects.flat()).toEqual([]);
    expect(state.smoke.notified).toBe(false);
  });

  it('notifies on the next sample when a type is enabled while its condition is still true', () => {
    const off = { ...enabled, smoke: false };
    const first = run([{ smoke: true }, { smoke: true }], { enabled: off });
    const second = run([{ smoke: true }], { from: first.state });
    expect(second.effects[0]).toContainEqual({ type: 'notify', key: 'smoke' });
  });

  it.each(['device_offline', 'phone_offline', 'loading'] as const)(
    'ignores data and leaves state unchanged while %s',
    connectivity => {
      const before = run([{ smoke: true }]).state;
      const { state, effects } = run([{ smoke: true }, { smoke: true }], { connectivity, from: before });
      expect(effects.flat()).toEqual([]);
      expect(state).toBe(before);
    },
  );

  it('does not re-notify for an already-notified episode after a restart (persisted state)', () => {
    const notified = run([{ rain: true }, { rain: true }]).state;
    const restored = parseAlertState(JSON.parse(JSON.stringify(notified)));
    const { effects } = run([{ rain: true }, { rain: true }], { from: restored });
    expect(effects.flat()).toEqual([]);
  });

  it('tracks line_fault, smoke and rain independently', () => {
    const { effects } = run([{ rain: true }, { rain: true, smoke: true }, { smoke: true }]);
    expect(effects[1]).toEqual([{ type: 'notify', key: 'rain' }, { type: 'haptic' }]);
    // effects follow key order (line_fault, smoke, rain); the haptic always comes last
    expect(effects[2]).toEqual([{ type: 'notify', key: 'smoke' }, { type: 'cleared', key: 'rain' }, { type: 'haptic' }]);
  });

  it('keeps state stable (no persistence churn) during a long episode', () => {
    const { state: s1 } = run([{ smoke: true }, { smoke: true }]);
    const { state: s2 } = run([{ smoke: true }], { from: s1 });
    expect(alertStateEquals(s1, s2)).toBe(true);
  });
});

describe('parseAlertState', () => {
  it('falls back to defaults for malformed input', () => {
    for (const raw of [null, undefined, 'x', 42, [], { smoke: 'yes' }, { smoke: { streak: NaN, notified: true } }]) {
      expect(parseAlertState(raw)).toEqual(initialAlertState);
    }
  });

  it('keeps valid keys and clamps the streak', () => {
    const s = parseAlertState({ smoke: { streak: 99, notified: true }, rain: { streak: 1, notified: false } });
    expect(s.smoke).toEqual({ streak: 2, notified: true });
    expect(s.rain).toEqual({ streak: 1, notified: false });
    expect(s.line_fault).toEqual({ streak: 0, notified: false });
  });
});
