import { dayTitle, extractEvents, groupEventsByDay } from './events';
import { makeSample } from '../test/factories';

const at = (i: number) => 1_760_000_000 + i * 10;

describe('extractEvents', () => {
  it('emits started and cleared for each transition, newest first', () => {
    const samples = [
      makeSample('a', { ts: at(0) }),
      makeSample('b', { ts: at(1), smoke: true }),
      makeSample('c', { ts: at(2), smoke: true }),
      makeSample('d', { ts: at(3) }),
    ];
    const events = extractEvents(samples);
    expect(events.map(e => [e.key, e.kind, e.ts])).toEqual([
      ['smoke', 'cleared', at(3)],
      ['smoke', 'started', at(1)],
    ]);
  });

  it('does not create a started event for a condition already active in the first sample', () => {
    const events = extractEvents([
      makeSample('a', { ts: at(0), rain: true }),
      makeSample('b', { ts: at(1), rain: true }),
      makeSample('c', { ts: at(2) }),
    ]);
    expect(events.map(e => [e.key, e.kind])).toEqual([['rain', 'cleared']]);
  });

  it('records the fault type on line_fault started only', () => {
    const events = extractEvents([
      makeSample('a', { ts: at(0) }),
      makeSample('b', { ts: at(1), line_fault: true, fault_type: 'short' }),
      makeSample('c', { ts: at(2) }),
    ]);
    expect(events.find(e => e.kind === 'started')?.faultType).toBe('short');
    expect(events.find(e => e.kind === 'cleared')?.faultType).toBeNull();
  });

  it('handles unsorted input, empty input and a single sample', () => {
    expect(extractEvents([])).toEqual([]);
    expect(extractEvents([makeSample('a', { smoke: true })])).toEqual([]);
    const events = extractEvents([
      makeSample('b', { ts: at(1), smoke: true }),
      makeSample('a', { ts: at(0) }),
    ]);
    expect(events).toHaveLength(1);
  });

  it('emits several events for simultaneous changes in a stable order', () => {
    const events = extractEvents([
      makeSample('a', { ts: at(0) }),
      makeSample('b', { ts: at(1), rain: true, line_fault: true, fault_type: 'short' }),
    ]);
    expect(events.map(e => e.key)).toEqual(['line_fault', 'rain']);
  });
});

describe('groupEventsByDay', () => {
  const local = (y: number, m: number, d: number, h: number) =>
    Math.floor(new Date(y, m, d, h).getTime() / 1000);
  const now = local(2026, 9, 15, 14); // 15 Oct 2026, 14:00 local
  const ev = (ts: number, id: string) => ({
    id,
    key: 'smoke' as const,
    kind: 'started' as const,
    ts,
    faultType: null,
  });

  it('titles Today, Yesterday and older dates', () => {
    expect(dayTitle(local(2026, 9, 15, 1), now)).toBe('Today');
    expect(dayTitle(local(2026, 9, 14, 23), now)).toBe('Yesterday');
    expect(dayTitle(local(2026, 9, 12, 9), now)).toBe('Mon, 12 Oct');
  });

  it('groups consecutive events under one header', () => {
    const groups = groupEventsByDay(
      [ev(local(2026, 9, 15, 13), 'a'), ev(local(2026, 9, 15, 2), 'b'), ev(local(2026, 9, 14, 20), 'c')],
      now,
    );
    expect(groups.map(g => [g.title, g.data.length])).toEqual([
      ['Today', 2],
      ['Yesterday', 1],
    ]);
    expect(groupEventsByDay([], now)).toEqual([]);
  });
});
