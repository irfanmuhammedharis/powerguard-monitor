import React, { useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { ArcGauge } from '../components/ArcGauge';
import { Card } from '../components/Card';
import { ConnectionPill } from '../components/ConnectionPill';
import { LineChart } from '../components/LineChart';
import type { ChartRange } from '../domain/constants';
import {
  activeAlerts,
  alertLabel,
  currentLevel,
  faultTypeLabel,
  LEVEL_LABEL,
  power,
  voltageLevel,
  worstHeadline,
  worstState,
  type Level,
  type WorstState,
} from '../domain/derive';
import { useConnectivity } from '../hooks/useConnectivity';
import { useFeed } from '../hooks/useFeed';
import { useHistory } from '../hooks/useHistory';
import { usePermission } from '../hooks/usePermission';
import { retryFeed } from '../core/deviceFeed';
import { openNotificationSettings } from '../services/notifications';
import { useSettings } from '../store/settingsStore';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../theme/tokens';
import { clock } from '../utils/format';

const ACCENT: Record<WorstState, keyof ThemeColors> = {
  ok: 'ok',
  phone_offline: 'warning',
  device_offline: 'warning',
  line_fault: 'danger',
  smoke: 'danger',
  threshold_danger: 'danger',
  rain: 'info',
  threshold_warning: 'warning',
};

export function DashboardScreen() {
  const { colors: c } = useTheme();
  const insets = useSafeAreaInsets();
  const live = useFeed(s => s.live);
  const liveEmpty = useFeed(s => s.liveEmpty);
  const invalid = useFeed(s => s.invalid);
  const error = useFeed(s => s.error);
  const deviceId = useFeed(s => s.deviceId);
  const rssi = useFeed(s => s.status?.rssi ?? null);
  const { connectivity, secondsSinceUpdate, lastSeenS } = useConnectivity();

  const minVoltage = useSettings(s => s.minVoltage);
  const maxVoltage = useSettings(s => s.maxVoltage);
  const maxCurrent = useSettings(s => s.maxCurrent);
  const thresholds = useMemo(
    () => ({ minVoltage, maxVoltage, maxCurrent }),
    [minVoltage, maxVoltage, maxCurrent],
  );

  const [range, setRange] = useState<ChartRange>('5m');
  const history = useHistory(range);
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    if (history.status !== 'loading') setRefreshing(false);
  }, [history.status]);

  const permission = usePermission();

  const stale =
    connectivity === 'device_offline' || connectivity === 'phone_offline';
  const worst = worstState({ connectivity, reading: live, thresholds });
  const accent = error || (!live && !stale) ? c.muted : c[ACCENT[worst]];
  const primaryKey =
    worst === 'line_fault' || worst === 'smoke' || worst === 'rain'
      ? worst
      : null;
  const others =
    stale || !live
      ? []
      : activeAlerts(live)
          .filter(k => k !== primaryKey)
          .map(k => alertLabel(k, live.fault_type));

  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(1);
  const shouldPulse =
    (worst === 'smoke' || worst === 'line_fault') && !reduceMotion;
  useEffect(() => {
    pulse.value = shouldPulse
      ? withRepeat(
          withSequence(
            withTiming(1.025, { duration: 900 }),
            withTiming(1, { duration: 900 }),
          ),
          -1,
          false,
        )
      : withTiming(1, { duration: 180 });
  }, [pulse, shouldPulse]);
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const levelColor = (l: Level) =>
    l === 'danger' ? c.danger : l === 'warning' ? c.warning : undefined;
  const vLevel: Level = live ? voltageLevel(live.voltage, thresholds) : 'ok';
  const aLevel: Level = live ? currentLevel(live.current, thresholds) : 'ok';

  const hasData = live !== null;
  // Never claim "All systems normal" when there is nothing to base it on.
  const headline = error
    ? 'Not connected'
    : !hasData && !stale
    ? connectivity === 'loading'
      ? 'Connecting…'
      : 'Waiting for device data'
    : worstHeadline(worst, live);
  const showSkeleton = !hasData && connectivity === 'loading' && !error;
  const showWaiting = !hasData && !showSkeleton && !error;

  const tiles = [
    {
      key: 'rain',
      label: 'RAIN',
      icon: '☂',
      color: c.info,
      on: !!live?.rain,
      extra: null as string | null,
    },
    {
      key: 'smoke',
      label: 'SMOKE',
      icon: '◉',
      color: c.warning,
      on: !!live?.smoke,
      extra:
        live?.smoke_ppm != null ? `${Math.round(live.smoke_ppm)} ppm` : null,
    },
    {
      key: 'line_fault',
      label: 'LINE FAULT',
      icon: 'ϟ',
      color: c.danger,
      on: !!live?.line_fault,
      extra: live?.line_fault ? faultTypeLabel(live.fault_type) : null,
    },
  ];

  return (
    <ScrollView
      style={{ backgroundColor: c.background }}
      contentContainerStyle={[s.content, { paddingTop: 20 + insets.top }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            history.refetch();
          }}
          tintColor={c.info}
        />
      }
    >
      <Text style={[s.brand, { color: c.text }]}>
        POWERGUARD <Text style={{ color: c.info }}>MONITOR</Text>
      </Text>
      <Text style={[s.sub, { color: c.muted }]}>
        Live installation overview · {deviceId}
      </Text>

      <Animated.View style={pulseStyle}>
        <Card
          style={[
            s.hero,
            { backgroundColor: c.surface, borderColor: accent + '55' },
          ]}
        >
          <View style={s.heroTop}>
            <View style={[s.heroIcon, { backgroundColor: accent + '20' }]}>
              <Text style={[s.heroGlyph, { color: accent }]}>⚡</Text>
            </View>
            <View style={s.heroText}>
              <Text style={[s.kicker, { color: c.muted }]}>SYSTEM STATUS</Text>
              <Text
                accessibilityRole="header"
                style={[s.headline, { color: c.text }]}
              >
                {headline}
              </Text>
              {others.length > 0 ? (
                <Text style={[s.secondary, { color: c.secondary }]}>
                  + {others.join(' · ')}
                </Text>
              ) : null}
            </View>
          </View>
          <ConnectionPill
            connectivity={connectivity}
            secondsSinceUpdate={secondsSinceUpdate}
            rssi={rssi}
            colors={c}
          />
        </Card>
      </Animated.View>

      {connectivity === 'phone_offline' ? (
        <Banner
          color={c.warning}
          text="You’re offline. Showing last known data."
        />
      ) : connectivity === 'device_offline' ? (
        <Banner
          color={c.warning}
          text={
            lastSeenS
              ? `No data from device since ${clock(lastSeenS)}`
              : 'No data from device yet'
          }
        />
      ) : null}

      {permission.status === 'denied' &&
      permission.asked &&
      !permission.cardDismissed ? (
        <Card
          style={[
            s.notice,
            { backgroundColor: c.surface, borderColor: c.warning + '55' },
          ]}
        >
          <Text style={[s.noticeTitle, { color: c.text }]}>
            Alerts are off. Enable notifications to get fault and smoke alerts.
          </Text>
          <View style={s.noticeActions}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Open notification settings"
              onPress={() => openNotificationSettings().catch(() => undefined)}
              style={s.action}
            >
              <Text style={[s.actionText, { color: c.info }]}>
                OPEN SETTINGS
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Dismiss"
              onPress={permission.dismissCard}
              style={s.action}
            >
              <Text style={[s.actionText, { color: c.muted }]}>DISMISS</Text>
            </TouchableOpacity>
          </View>
        </Card>
      ) : null}

      {error ? (
        <Card
          style={[
            s.notice,
            { backgroundColor: c.surface, borderColor: c.danger + '55' },
          ]}
        >
          <Text style={[s.noticeTitle, { color: c.danger }]}>
            {error === 'db_permission_denied'
              ? 'No access to this device'
              : 'Couldn’t connect to the server'}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Retry"
            onPress={retryFeed}
            style={s.action}
          >
            <Text style={[s.actionText, { color: c.info }]}>↻ RETRY</Text>
          </TouchableOpacity>
        </Card>
      ) : null}

      {showSkeleton ? (
        <Card style={[s.notice, { backgroundColor: c.surface }]}>
          <Text style={{ color: c.secondary }}>Connecting to your device…</Text>
        </Card>
      ) : null}
      {showWaiting ? (
        <Card style={[s.notice, { backgroundColor: c.surface }]}>
          <Text style={[s.noticeTitle, { color: c.text }]}>
            Waiting for device data
          </Text>
          <Text style={[s.noticeBody, { color: c.secondary }]}>
            {liveEmpty
              ? 'The device has not published readings yet.'
              : 'Check the device ID and confirm the field unit is sending readings.'}
          </Text>
        </Card>
      ) : null}

      <View style={s.gauges}>
        <Card
          style={[s.gauge, { backgroundColor: c.surface }, stale && s.muted]}
        >
          <ArcGauge
            value={live?.voltage ?? 0}
            max={maxVoltage}
            min={minVoltage}
            label="Voltage"
            unit="V"
            color={levelColor(vLevel) ?? c.voltage}
            level={hasData ? LEVEL_LABEL[vLevel] : 'No data'}
            textColor={c.text}
            mutedColor={c.secondary}
            invalid={invalid.voltage}
          />
        </Card>
        <Card
          style={[s.gauge, { backgroundColor: c.surface }, stale && s.muted]}
        >
          <ArcGauge
            value={live?.current ?? 0}
            max={maxCurrent}
            label="Current"
            unit="A"
            color={levelColor(aLevel) ?? c.current}
            level={hasData ? LEVEL_LABEL[aLevel] : 'No data'}
            textColor={c.text}
            mutedColor={c.secondary}
            invalid={invalid.current}
          />
        </Card>
      </View>

      <View style={s.powerRow}>
        <View
          style={[
            s.power,
            { backgroundColor: c.elevated, borderColor: c.border },
            stale && s.muted,
          ]}
        >
          <Text style={[s.powerLabel, { color: c.muted }]}>
            CALCULATED POWER
          </Text>
          <Text
            accessibilityLabel={`Power ${
              live ? power(live.voltage, live.current) : 0
            } watts`}
            style={[s.powerValue, { color: c.text }]}
          >
            {live ? power(live.voltage, live.current) : 0}{' '}
            <Text style={[s.powerUnit, { color: c.info }]}>W</Text>
          </Text>
        </View>
      </View>

      <View style={s.tiles}>
        {tiles.map(t => (
          <Card
            key={t.key}
            accessible
            accessibilityLabel={`${t.label} ${t.on ? 'active' : 'clear'}${
              t.extra ? `, ${t.extra}` : ''
            }`}
            style={[
              s.tile,
              {
                backgroundColor: c.surface,
                borderColor: t.on ? t.color + '66' : c.border,
              },
              stale && s.muted,
            ]}
          >
            <Text style={[s.tileIcon, { color: t.color }]}>{t.icon}</Text>
            <Text style={[s.tileLabel, { color: c.muted }]}>{t.label}</Text>
            <Text style={[s.tileState, { color: t.on ? t.color : c.ok }]}>
              {t.on ? 'ACTIVE' : 'CLEAR'}
            </Text>
            {t.extra ? (
              <Text style={[s.tileExtra, { color: c.secondary }]}>
                {t.extra}
              </Text>
            ) : null}
          </Card>
        ))}
      </View>

      <Card style={[s.chartCard, { backgroundColor: c.surface }]}>
        <Text style={[s.sectionTitle, { color: c.text }]}>Live history</Text>
        <Text style={[s.chartSub, { color: c.muted }]}>
          Voltage and current
        </Text>
        <LineChart
          samples={history.samples}
          status={history.status}
          range={range}
          onRangeChange={setRange}
          onRetry={history.refetch}
          colors={c}
          maxVoltage={maxVoltage}
          maxCurrent={maxCurrent}
        />
      </Card>

      <Text style={[s.footer, { color: c.muted }]}>
        Read only · Firebase Realtime Database
      </Text>
    </ScrollView>
  );
}

function Banner({ color, text }: { color: string; text: string }) {
  return (
    <View
      style={[
        s.banner,
        { backgroundColor: color + '18', borderColor: color + '45' },
      ]}
    >
      <Text style={[s.bannerText, { color }]}>● {text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  content: { padding: 20, paddingBottom: 28 },
  brand: { fontSize: 13, fontWeight: '900', letterSpacing: 1.3 },
  sub: { fontSize: 12, marginTop: 5 },
  hero: { marginTop: 18 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroGlyph: { fontSize: 24 },
  heroText: { flex: 1 },
  kicker: { fontSize: 9, fontWeight: '800', letterSpacing: 1.4 },
  headline: { fontSize: 17, fontWeight: '800', marginTop: 4 },
  secondary: { fontSize: 12, marginTop: 4 },
  banner: { padding: 12, borderRadius: 13, borderWidth: 1, marginTop: 12 },
  bannerText: { fontWeight: '700' },
  notice: { marginTop: 14 },
  noticeTitle: { fontSize: 14, fontWeight: '700' },
  noticeBody: { marginTop: 6 },
  noticeActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  action: { minHeight: 48, justifyContent: 'center', paddingRight: 16 },
  actionText: { fontWeight: '800', fontSize: 12 },
  gauges: { flexDirection: 'row', gap: 12, marginTop: 18 },
  gauge: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  muted: { opacity: 0.55 },
  powerRow: { alignItems: 'center', marginTop: 8, marginBottom: 15 },
  power: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 9,
    alignItems: 'center',
    gap: 4,
  },
  powerLabel: { fontSize: 10, fontWeight: '700' },
  powerValue: {
    fontSize: 17,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  powerUnit: { fontSize: 12 },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, padding: 12, minHeight: 112 },
  tileIcon: { fontSize: 19 },
  tileLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.7,
    marginTop: 8,
    marginBottom: 3,
  },
  tileState: { fontSize: 13, fontWeight: '800' },
  tileExtra: { fontSize: 10, marginTop: 4 },
  chartCard: { marginTop: 18 },
  sectionTitle: { fontSize: 15, fontWeight: '800' },
  chartSub: { fontSize: 11, marginTop: 3 },
  footer: { fontSize: 10, textAlign: 'center', marginTop: 18 },
});
