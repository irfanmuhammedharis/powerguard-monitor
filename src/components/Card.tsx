import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { radius } from '../theme/tokens';
export function Card({ children, style, ...props }: ViewProps) {
  return (
    <View style={[styles.wrap, style]} {...props}>
      <LinearGradient
        colors={['rgba(255,255,255,0.035)', 'rgba(255,255,255,0)']}
        style={StyleSheet.absoluteFillObject}
      />
      {children}
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(130,150,180,0.18)',
    borderRadius: radius.lg,
    padding: 18,
    backgroundColor: 'transparent',
  },
});
