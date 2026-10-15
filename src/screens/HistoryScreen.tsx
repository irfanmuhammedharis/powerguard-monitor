import React, { useMemo, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '../components/Card';
import {
  extractEvents,
  groupEventsByDay,
  type HistoryEvent,
} from '../domain/events';
import { faultTypeLabel, type AlertKey } from '../domain/derive';
import { nowSeconds } from '../domain/time';
import { useHistory } from '../hooks/useHistory';
import { useTheme } from '../theme/ThemeProvider';
import { clockSeconds } from '../utils/format';

type Filter = 'ALL' | 'FAULT' | 'SMOKE' | 'RAIN';
const FILTERS: Filter[] = ['ALL', 'FAULT', 'SMOKE', 'RAIN'];
const FILTER_KEY: Record<Exclude<Filter, 'ALL'>, AlertKey> = {
  FAULT: 'line_fault',
  SMOKE: 'smoke',
  RAIN: 'rain',
};
const NAME: Record<AlertKey, string> = {
  line_fault: 'Line fault',
  smoke: 'Smoke',
  rain: 'Rain',
};

type Row =
  | { type: 'header'; title: string }
  | { type: 'event'; event: HistoryEvent };

export function HistoryScreen() {
  const { colors: c } = useTheme();
  const insets = useSafeAreaInsets();
  const { status, samples, refetch } = useHistory('events');
  const [filter, setFilter] = useState<Filter>('ALL');

  const rows = useMemo<Row[]>(() => {
    const events = extractEvents(samples).filter(
      e => filter === 'ALL' || e.key === FILTER_KEY[filter],
    );
    return groupEventsByDay(events, nowSeconds()).flatMap(g => [
      { type: 'header' as const, title: g.title },
      ...g.data.map(event => ({ type: 'event' as const, event })),
    ]);
  }, [samples, filter]);

  const tone = (key: AlertKey) =>
    key === 'line_fault' ? c.danger : key === 'smoke' ? c.warning : c.info;

  const header = (
    <View>
      <Text style={[s.title, { color: c.text }]}>History</Text>
      <Text style={[s.sub, { color: c.muted }]}>
        Fault, smoke and rain events from the last 24 hours
      </Text>
      <View style={s.filters}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            accessibilityRole="button"
            accessibilityLabel={`Filter: ${f.toLowerCase()}`}
            accessibilityState={{ selected: filter === f }}
            onPress={() => setFilter(f)}
            style={[
              s.filter,
              {
                backgroundColor: filter === f ? c.info + '24' : c.surface,
                borderColor: filter === f ? c.info : c.border,
              },
            ]}
          >
            <Text
              style={[
                s.filterText,
                { color: filter === f ? c.info : c.secondary },
              ]}
            >
              {f}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <FlatList
      style={{ backgroundColor: c.background }}
      contentContainerStyle={[s.content, { paddingTop: 20 + insets.top }]}
      data={rows}
      keyExtractor={(row, i) =>
        row.type === 'header' ? `h:${row.title}:${i}` : row.event.id
      }
      ListHeaderComponent={header}
      refreshControl={
        <RefreshControl
          refreshing={false}
          onRefresh={refetch}
          tintColor={c.info}
        />
      }
      ListEmptyComponent={
        status === 'loading' ? (
          <Card style={{ backgroundColor: c.surface }}>
            <Text style={{ color: c.secondary }}>Loading events…</Text>
          </Card>
        ) : status === 'error' ? (
          <Card style={{ backgroundColor: c.surface }}>
            <Text style={[s.emptyTitle, { color: c.text }]}>
              Couldn’t load history
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Retry"
              onPress={refetch}
              style={s.retry}
            >
              <Text style={[s.retryText, { color: c.info }]}>↻ RETRY</Text>
            </TouchableOpacity>
          </Card>
        ) : (
          <Card style={{ backgroundColor: c.surface }}>
            <Text style={[s.emptyTitle, { color: c.text }]}>
              No events in the last 24 hours
            </Text>
            <Text style={[s.emptyBody, { color: c.secondary }]}>
              Faults, smoke and rain will appear here.
            </Text>
          </Card>
        )
      }
      ListFooterComponent={
        <Text style={[s.footnote, { color: c.muted }]}>
          Events come from 10-second samples; a condition shorter than that may
          not appear here, even though it can still raise an alert.
        </Text>
      }
      renderItem={({ item }) => {
        if (item.type === 'header') {
          return (
            <Text style={[s.day, { color: c.muted }]}>
              {item.title.toUpperCase()}
            </Text>
          );
        }
        const { event } = item;
        const color = tone(event.key);
        const started = event.kind === 'started';
        const detail =
          event.key === 'line_fault' && event.faultType
            ? ` · ${faultTypeLabel(event.faultType)}`
            : '';
        return (
          <Card
            accessible
            accessibilityLabel={`${NAME[event.key]} ${
              event.kind
            } at ${clockSeconds(event.ts)}${detail}`}
            style={[s.event, { backgroundColor: c.surface }]}
          >
            <View style={s.row}>
              <View style={s.rowText}>
                <Text style={[s.eventTitle, { color: c.text }]}>
                  {NAME[event.key]} {event.kind}
                  {detail}
                </Text>
                <Text style={[s.eventTime, { color: c.muted }]}>
                  {clockSeconds(event.ts)}
                </Text>
              </View>
              <Text
                style={[
                  s.pill,
                  {
                    color: started ? color : c.ok,
                    backgroundColor: (started ? color : c.ok) + '20',
                  },
                ]}
              >
                {started ? '▲ STARTED' : '▼ CLEARED'}
              </Text>
            </View>
          </Card>
        );
      }}
    />
  );
}

const s = StyleSheet.create({
  content: { padding: 20, paddingBottom: 28 },
  title: { fontSize: 27, fontWeight: '900' },
  sub: { fontSize: 12, marginTop: 5, marginBottom: 18 },
  filters: { flexDirection: 'row', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  filter: {
    borderWidth: 1,
    paddingHorizontal: 14,
    minHeight: 48,
    justifyContent: 'center',
    borderRadius: 99,
  },
  filterText: { fontSize: 11, fontWeight: '800' },
  day: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    marginTop: 14,
    marginBottom: 8,
  },
  event: { marginBottom: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  rowText: { flex: 1 },
  eventTitle: { fontSize: 14, fontWeight: '700' },
  eventTime: { fontSize: 11, marginTop: 5, fontVariant: ['tabular-nums'] },
  pill: {
    padding: 8,
    borderRadius: 99,
    fontSize: 10,
    fontWeight: '800',
    overflow: 'hidden',
  },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptyBody: { marginTop: 6 },
  retry: { minHeight: 48, justifyContent: 'center' },
  retryText: { fontWeight: '800' },
  footnote: { fontSize: 10, marginTop: 18, textAlign: 'center' },
});
