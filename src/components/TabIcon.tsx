import React from 'react';
import Svg, { Path } from 'react-native-svg';

const PATHS = {
  home: 'M3 10 L12 3 L21 10 V21 H14 V14 H10 V21 H3 Z',
  history: 'M3 12 A9 9 0 1 0 6 5 M3 3 V8 H8 M12 7 V12 L16 14',
  settings: 'M12 3 L14 8 L20 9 L16 13 L17 19 L12 16 L7 19 L8 13 L4 9 L10 8 Z',
} as const;

export function TabIcon({ color, kind }: { color: string; kind: keyof typeof PATHS }) {
  return (
    <Svg width={21} height={21} viewBox="0 0 24 24">
      <Path d={PATHS[kind]} stroke={color} fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
