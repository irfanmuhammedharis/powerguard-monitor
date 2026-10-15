import React, { useEffect, useMemo } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, View } from 'react-native';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { TabIcon } from './src/components/TabIcon';
import { bootstrap } from './src/core/bootstrap';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { useSettingsHydrated } from './src/store/settingsStore';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';

const Tabs = createBottomTabNavigator();
const TAB_BAR_HEIGHT = 58;

const homeIcon = ({ color }: { color: string }) => (
  <TabIcon color={color} kind="home" />
);
const historyIcon = ({ color }: { color: string }) => (
  <TabIcon color={color} kind="history" />
);
const settingsIcon = ({ color }: { color: string }) => (
  <TabIcon color={color} kind="settings" />
);

function Shell() {
  const { dark, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const hydrated = useSettingsHydrated();

  const navTheme = useMemo(() => {
    const base = dark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
        primary: colors.info,
      },
    };
  }, [dark, colors]);

  return (
    <>
      <StatusBar
        barStyle={dark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />
      {!hydrated ? (
        <View style={[s.splash, { backgroundColor: colors.background }]}>
          <ActivityIndicator color={colors.info} />
        </View>
      ) : (
        <NavigationContainer theme={navTheme}>
          <Tabs.Navigator
            screenOptions={{
              headerShown: false,
              tabBarStyle: {
                backgroundColor: colors.surface,
                borderTopColor: colors.border,
                ...s.tabBar,
                // Edge-to-edge (Android 15+): keep the tabs clear of the system nav bar.
                height: TAB_BAR_HEIGHT + insets.bottom,
                paddingBottom: insets.bottom + 6,
              },
              tabBarActiveTintColor: colors.info,
              tabBarInactiveTintColor: colors.muted,
              tabBarLabelStyle: s.tabLabel,
            }}
          >
            <Tabs.Screen
              name="Dashboard"
              component={DashboardScreen}
              options={{ tabBarIcon: homeIcon }}
            />
            <Tabs.Screen
              name="History"
              component={HistoryScreen}
              options={{ tabBarIcon: historyIcon }}
            />
            <Tabs.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ tabBarIcon: settingsIcon }}
            />
          </Tabs.Navigator>
        </NavigationContainer>
      )}
    </>
  );
}

export default function App() {
  // index.js already boots the runtime so alerts work without the UI; this is
  // idempotent and only matters if the app is mounted some other way.
  useEffect(() => {
    bootstrap().catch(() => undefined);
  }, []);

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={s.root}>
        <SafeAreaProvider>
          <ThemeProvider>
            <Shell />
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabBar: { paddingTop: 6 },
  tabLabel: { fontSize: 11, fontWeight: '700' },
});
