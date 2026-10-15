import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { Connectivity } from '../domain/connectivity';
import { rssiBars } from '../domain/derive';
import type { ThemeColors } from '../theme/tokens';

const LABEL: Record<Connectivity, string> = {
  loading: 'CONNECTING',
  online: 'ONLINE',
  device_offline: 'DEVICE OFFLINE',
  phone_offline: 'YOU’RE OFFLINE',
};

function SignalBars({ rssi, colors }: { rssi: number; colors: ThemeColors }) {
  const bars = rssiBars(rssi) ?? 0;
  return (
    <View
      style={s.bars}
      accessible
      accessibilityLabel={`Wi-Fi signal ${bars} of 4`}
    >
      {[1, 2, 3, 4].map(n => (
        <View
          key={n}
          style={[
            s.bar,
            { height: 3 + n * 3, backgroundColor: n <= bars ? colors.text : colors.border },
          ]}
        />
      ))}
    </View>
  );
}

export function ConnectionPill({
  connectivity,
  secondsSinceUpdate,
  rssi,
  colors,
}: {
  connectivity: Connectivity;
  secondsSinceUpdate: number | null;
  rssi: number | null;
  colors: ThemeColors;
}) {
  const online = connectivity === 'online';
  const tone = online ? colors.ok : connectivity === 'loading' ? colors.muted : colors.warning;

  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value =
      online && !reduceMotion
        ? withRepeat(
            withSequence(withTiming(0.35, { duration: 900 }), withTiming(1, { duration: 900 })),
            -1,
            false,
          )
        : 1;
  }, [online, reduceMotion, pulse]);
  const dotStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <View style={s.row}>
      <View style={[s.pill, { backgroundColor: tone + '1F' }]}>
        <Animated.View style={[s.dot, { backgroundColor: tone }, dotStyle]} />
        <Text style={[s.label, { color: tone }]}>{LABEL[connectivity]}</Text>
      </View>
      {rssi !== null && online ? <SignalBars rssi={rssi} colors={colors} /> : null}
      <Text style={[s.updated, { color: colors.muted }]}>
        {secondsSinceUpdate === null
          ? 'Waiting for device'
          : `Updated ${secondsSinceUpdate}s ago`}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 99,
  },
  dot: { width: 7, height: 7, borderRadius: 5 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  updated: { fontSize: 12 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  bar: { width: 3, borderRadius: 1 },
});
