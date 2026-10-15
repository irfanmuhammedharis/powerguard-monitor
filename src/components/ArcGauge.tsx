import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, {
  Path,
  Defs,
  LinearGradient,
  Stop,
  Circle,
} from 'react-native-svg';
export function ArcGauge({
  value,
  max,
  label,
  unit,
  color,
  min = 0,
  textColor,
  mutedColor,
  level,
  invalid = false,
}: {
  value: number;
  max: number;
  label: string;
  unit: string;
  color: string;
  min?: number;
  textColor: string;
  mutedColor: string;
  level: string;
  invalid?: boolean;
}) {
  const size = 150,
    r = 60,
    cx = 75,
    cy = 75;
  const a0 = -225,
    a1 = 45,
    clamped = Math.max(0, Math.min(1, value / max)),
    angle = a0 + (a1 - a0) * clamped;
  const pt = (a: number) => [
    cx + r * Math.cos((a * Math.PI) / 180),
    cy + r * Math.sin((a * Math.PI) / 180),
  ];
  const [x0, y0] = pt(a0),
    [x1, y1] = pt(a1),
    [xv, yv] = pt(angle);
  const path = `M ${x0} ${y0} A ${r} ${r} 0 1 1 ${x1} ${y1}`;
  const prog = `M ${x0} ${y0} A ${r} ${r} 0 ${
    clamped > 0.5 ? 1 : 0
  } 1 ${xv} ${yv}`;
  return (
    <View
      style={s.wrap}
      accessible
      accessibilityLabel={`${label} ${value.toFixed(1)} ${unit}, ${level}${
        invalid ? ', invalid reading' : ''
      }`}
    >
      <Svg width={size} height={size} viewBox="0 0 150 150">
        <Defs>
          <LinearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={color} />
            <Stop offset="1" stopColor="#38BDF8" />
          </LinearGradient>
        </Defs>
        <Path
          d={path}
          fill="none"
          stroke="rgba(130,150,180,.2)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <Path
          d={prog}
          fill="none"
          stroke="url(#g)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <Circle
          cx={pt(a0 + (a1 - a0) * Math.max(0, Math.min(1, min / max)))[0]}
          cy={pt(a0 + (a1 - a0) * Math.max(0, Math.min(1, min / max)))[1]}
          r="3"
          fill="#FBBF24"
        />
        <Circle cx={xv} cy={yv} r="5" fill={color} />
      </Svg>
      <View style={s.center}>
        <Text style={[s.value, { color: textColor }]}>{value.toFixed(1)}</Text>
        <Text style={[s.unit, { color: mutedColor }]}>{unit}</Text>
      </View>
      <Text style={[s.title, { color: mutedColor }]}>{label}</Text>
      <Text style={[s.level, { color }]}>{level}</Text>
      {invalid ? (
        <Text style={[s.invalid, { color: mutedColor }]}>
          ⚠ invalid reading
        </Text>
      ) : null}
    </View>
  );
}
const s = StyleSheet.create({
  wrap: {
    width: 150,
    height: 205,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  center: { position: 'absolute', top: 51, alignItems: 'center' },
  value: {
    fontSize: 24,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  unit: { fontSize: 11, marginTop: 2 },
  title: {
    position: 'absolute',
    bottom: 37,
    fontSize: 12,
    fontWeight: '600',
  },
  level: {
    position: 'absolute',
    bottom: 20,
    fontSize: 10,
    fontWeight: '700',
  },
  invalid: { position: 'absolute', bottom: 4, fontSize: 9 },
});
