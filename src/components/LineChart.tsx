import React, { useMemo, useState } from 'react';
import {
  type GestureResponderEvent,
  type LayoutChangeEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { CHART_RANGES, type ChartRange } from '../domain/constants';
import { downsampleLTTB, type ChartPoint } from '../domain/downsample';
import { nowSeconds } from '../domain/time';
import type { HistorySample } from '../models/device';
import type { HistoryStatus } from '../hooks/useHistory';
import type { ThemeColors } from '../theme/tokens';
import { clock, clockSeconds } from '../utils/format';

const W = 320;
const H = 130;
const PAD = 12;

interface Props {
  samples: HistorySample[];
  status: HistoryStatus;
  range: ChartRange;
  onRangeChange: (range: ChartRange) => void;
  onRetry: () => void;
  colors: ThemeColors;
  maxVoltage: number;
  maxCurrent: number;
}

export function LineChart({
  samples,
  status,
  range,
  onRangeChange,
  onRetry,
  colors,
  maxVoltage,
  maxCurrent,
}: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const [width, setWidth] = useState(W);

  const view = useMemo(() => {
    const cfg = CHART_RANGES[range];
    const inRange = samples.filter(x => x.ts >= nowSeconds() - cfg.seconds);
    // Each series gets its own 0..scale axis so a 10 A current is not flattened by a
    // 230 V voltage; the legend states both scales.
    const vScale = Math.max(maxVoltage, ...inRange.map(x => x.voltage), 1);
    const cScale = Math.max(maxCurrent, ...inRange.map(x => x.current), 0.5);
    // Downsample on the combined normalised signal so a spike in either series survives.
    const bySample = new Map<ChartPoint, HistorySample>();
    const points = inRange.map(x => {
      const p = { t: x.ts, v: x.voltage / vScale + x.current / cScale };
      bySample.set(p, x);
      return p;
    });
    const rows = downsampleLTTB(points, cfg.maxPoints).map(p => bySample.get(p) as HistorySample);
    const t0 = rows[0]?.ts ?? 0;
    const span = Math.max(1, (rows[rows.length - 1]?.ts ?? 0) - t0);
    const xOf = (ts: number) => PAD + ((ts - t0) / span) * (W - PAD * 2);
    const yOf = (value: number, scale: number) =>
      H - PAD - (Math.min(value, scale) / scale) * (H - PAD * 2);
    const line = (pick: (x: HistorySample) => number, scale: number) =>
      rows.map((x, i) => `${i === 0 ? 'M' : 'L'} ${xOf(x.ts)} ${yOf(pick(x), scale)}`).join(' ');
    return {
      rows,
      vScale,
      cScale,
      xOf,
      yOf,
      vPath: line(x => x.voltage, vScale),
      cPath: line(x => x.current, cScale),
    };
  }, [samples, range, maxVoltage, maxCurrent]);

  const { rows } = view;
  const pick = selected === null ? null : rows[selected] ?? null;

  const scrub = (e: GestureResponderEvent) => {
    if (rows.length < 2) return;
    const x = (e.nativeEvent.locationX / width) * W;
    let best = 0;
    for (let i = 1; i < rows.length; i += 1) {
      if (Math.abs(view.xOf(rows[i].ts) - x) < Math.abs(view.xOf(rows[best].ts) - x)) best = i;
    }
    setSelected(best);
  };

  return (
    <View>
      <View style={s.ranges} accessibilityRole="tablist">
        {(Object.keys(CHART_RANGES) as ChartRange[]).map(key => (
          <TouchableOpacity
            key={key}
            accessibilityRole="button"
            accessibilityLabel={`Show last ${CHART_RANGES[key].label}`}
            accessibilityState={{ selected: range === key }}
            onPress={() => {
              setSelected(null);
              onRangeChange(key);
            }}
            style={[s.range, { backgroundColor: range === key ? colors.info + '22' : colors.elevated }]}
          >
            <Text style={[s.rangeText, { color: range === key ? colors.info : colors.secondary }]}>
              {CHART_RANGES[key].label.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {status === 'error' ? (
        <View style={s.state}>
          <Text style={[s.stateTitle, { color: colors.text }]}>Couldn’t load history</Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Retry loading history"
            onPress={onRetry}
            style={s.retry}
          >
            <Text style={[s.retryText, { color: colors.info }]}>↻ RETRY</Text>
          </TouchableOpacity>
        </View>
      ) : status === 'loading' && rows.length < 2 ? (
        <View style={s.state}>
          <Text style={{ color: colors.secondary }}>Loading history…</Text>
        </View>
      ) : rows.length < 2 ? (
        <View style={s.state}>
          <Text style={[s.stateTitle, { color: colors.text }]}>Not enough data yet</Text>
        </View>
      ) : (
        <>
          <Text style={[s.tooltip, { color: colors.text }]} accessibilityLiveRegion="polite">
            {pick
              ? `${clockSeconds(pick.ts)} · ${pick.voltage.toFixed(1)} V · ${pick.current.toFixed(2)} A`
              : 'Touch the chart to inspect a point'}
          </Text>
          <View
            onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width || W)}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={scrub}
            onResponderMove={scrub}
            accessible
            accessibilityLabel={`Voltage and current, last ${CHART_RANGES[range].label}, ${rows.length} points`}
          >
            <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
              <Line x1={PAD} y1={H / 2} x2={W - PAD} y2={H / 2} stroke={colors.border} strokeDasharray="4 5" />
              <Path d={view.vPath} fill="none" stroke={colors.voltage} strokeWidth={2.2} />
              <Path d={view.cPath} fill="none" stroke={colors.current} strokeWidth={2.2} />
              {pick ? (
                <>
                  <Line
                    x1={view.xOf(pick.ts)}
                    y1={PAD}
                    x2={view.xOf(pick.ts)}
                    y2={H - PAD}
                    stroke={colors.muted}
                    strokeWidth={1}
                  />
                  <Circle cx={view.xOf(pick.ts)} cy={view.yOf(pick.voltage, view.vScale)} r={4} fill={colors.voltage} />
                  <Circle cx={view.xOf(pick.ts)} cy={view.yOf(pick.current, view.cScale)} r={4} fill={colors.current} />
                </>
              ) : null}
            </Svg>
          </View>
          <View style={s.axis}>
            <Text style={[s.small, { color: colors.muted }]}>{clock(rows[0].ts)}</Text>
            <Text style={[s.small, { color: colors.muted }]}>{clock(rows[rows.length - 1].ts)}</Text>
          </View>
          <View style={s.legend}>
            <Text style={[s.small, { color: colors.voltage }]}>● Voltage 0–{Math.round(view.vScale)} V</Text>
            <Text style={[s.small, { color: colors.current }]}>● Current 0–{Math.round(view.cScale * 10) / 10} A</Text>
          </View>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  ranges: { flexDirection: 'row', gap: 6, marginVertical: 12 },
  range: { paddingHorizontal: 12, paddingVertical: 13, borderRadius: 99, overflow: 'hidden', minHeight: 48 },
  rangeText: { fontSize: 11, fontWeight: '800' },
  state: { minHeight: H, alignItems: 'center', justifyContent: 'center' },
  stateTitle: { fontSize: 14, fontWeight: '700' },
  retry: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 16 },
  retryText: { fontWeight: '800' },
  tooltip: { fontSize: 11, marginBottom: 6, fontVariant: ['tabular-nums'] },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  legend: { flexDirection: 'row', gap: 16, marginTop: 6, flexWrap: 'wrap' },
  small: { fontSize: 11 },
});
