export const palette = {
  dark: {
    background: '#0B1220',
    surface: '#121A2B',
    elevated: '#182238',
    border: '#29354A',
    text: '#F2F6FC',
    secondary: '#AAB7CA',
    muted: '#8290A5',
    ok: '#34D399',
    warning: '#FBBF24',
    danger: '#FB7185',
    info: '#38BDF8',
    voltage: '#A78BFA',
    current: '#22D3EE',
  },
  light: {
    background: '#F3F6FB',
    surface: '#FFFFFF',
    elevated: '#EAF0F8',
    border: '#D7E0EC',
    text: '#101B2D',
    secondary: '#46566D',
    muted: '#63748B',
    ok: '#047857',
    warning: '#A16207',
    danger: '#BE123C',
    info: '#0369A1',
    voltage: '#6D28D9',
    current: '#0E7490',
  },
} as const;
export type ThemeMode = 'system' | 'dark' | 'light';
export type ThemeColors = { [K in keyof typeof palette.dark]: string };
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
} as const;
export const radius = { sm: 12, md: 18, lg: 24, pill: 99 } as const;
