import React, { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { useSettings } from '../store/settingsStore';
import { palette, type ThemeColors } from './tokens';

interface Theme {
  dark: boolean;
  colors: ThemeColors;
}
const ThemeContext = createContext<Theme>({ dark: true, colors: palette.dark });

/** Resolves System / Dark / Light and exposes the token set. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const preference = useSettings(s => s.theme);
  const system = useColorScheme();
  const dark = preference === 'system' ? system !== 'light' : preference === 'dark';
  const value = useMemo(
    () => ({ dark, colors: dark ? palette.dark : palette.light }),
    [dark],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = (): Theme => useContext(ThemeContext);
