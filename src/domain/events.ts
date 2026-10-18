import type { FaultType, HistorySample } from '../models/device';
import { ALERT_KEYS, type AlertKey } from './derive';

export interface HistoryEvent {
  id: string; // `${key}:${sampleId}`
  key: AlertKey;
  kind: 'started' | 'cleared';
  ts: number; // unix seconds of the sample where the change was observed
  faultType: FaultType | null; // only for line_fault started
}

/**
 * One event per false->true ("started") / true->false ("cleared") transition of
 * line_fault, smoke, tilt or rain between consecutive samples, newest first. The first
 * sample never produces an event: whatever was already active began before the
 * window (FR-6).
 */
export function extractEvents(samples: HistorySample[]): HistoryEvent[] {
  const sorted = [...samples].sort((a, b) => a.ts - b.ts);
  const events: HistoryEvent[] = [];
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    for (const key of ALERT_KEYS) {
      if (prev[key] === cur[key]) continue;
      const started = cur[key];
      events.push({
        id: `${key}:${cur.id}`,
        key,
        kind: started ? 'started' : 'cleared',
        ts: cur.ts,
        faultType: started && key === 'line_fault' ? cur.fault_type : null,
      });
    }
  }
  return events.sort(
    (a, b) =>
      b.ts - a.ts || ALERT_KEYS.indexOf(a.key) - ALERT_KEYS.indexOf(b.key),
  );
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const startOfLocalDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function dayTitle(tsS: number, nowS: number): string {
  const day = startOfLocalDay(new Date(tsS * 1000));
  const today = startOfLocalDay(new Date(nowS * 1000));
  const diffDays = Math.round((today - day) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  const d = new Date(tsS * 1000);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** Groups newest-first events under "Today" / "Yesterday" / "Mon, 12 Oct" (local time). */
export function groupEventsByDay(
  events: HistoryEvent[],
  nowS: number,
): { title: string; data: HistoryEvent[] }[] {
  const groups: { title: string; data: HistoryEvent[] }[] = [];
  for (const event of events) {
    const title = dayTitle(event.ts, nowS);
    const last = groups[groups.length - 1];
    if (last && last.title === title) last.data.push(event);
    else groups.push({ title, data: [event] });
  }
  return groups;
}
