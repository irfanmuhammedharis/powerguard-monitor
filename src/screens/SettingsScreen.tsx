import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '../components/Card';
import {
  isValidDeviceId,
  LIMITS,
  MIN_VOLTAGE_GAP,
  type AppSettings,
} from '../models/settings';
import {
  ensurePermission,
  openBatteryOptimizationSettings,
} from '../services/notifications';
import { patchSettings, useSettings } from '../store/settingsStore';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeMode } from '../theme/tokens';

type ToggleKey =
  | 'alertFault'
  | 'alertSmoke'
  | 'alertRain'
  | 'backgroundMonitoring';
const THEMES: ThemeMode[] = ['system', 'dark', 'light'];

export function SettingsScreen() {
  const { colors: c } = useTheme();
  const insets = useSafeAreaInsets();
  const deviceId = useSettings(s => s.deviceId);
  const alertFault = useSettings(s => s.alertFault);
  const alertSmoke = useSettings(s => s.alertSmoke);
  const alertRain = useSettings(s => s.alertRain);
  const minVoltage = useSettings(s => s.minVoltage);
  const maxVoltage = useSettings(s => s.maxVoltage);
  const maxCurrent = useSettings(s => s.maxCurrent);
  const background = useSettings(s => s.backgroundMonitoring);
  const theme = useSettings(s => s.theme);

  // The device ID is edited as a draft and applied with Save, so typing never
  // re-subscribes to a half-typed path.
  const [draft, setDraft] = useState(deviceId);
  const draftValid = isValidDeviceId(draft);
  const [backgroundMessage, setBackgroundMessage] = useState<string | null>(
    null,
  );

  const save = (patch: Partial<AppSettings>) => {
    patchSettings(patch).catch(() => undefined);
  };

  const toggle = (
    key: ToggleKey,
    value: boolean,
    label: string,
    hint: string,
  ) => (
    <View style={[s.row, { borderBottomColor: c.border }]}>
      <View style={s.rowText}>
        <Text style={[s.rowTitle, { color: c.text }]}>{label}</Text>
        <Text style={[s.hint, { color: c.muted }]}>{hint}</Text>
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={next => {
          if (key !== 'backgroundMonitoring') {
            save({ [key]: next });
            return;
          }
          setBackgroundMessage(null);
          if (!next) {
            save({ backgroundMonitoring: false });
            return;
          }
          ensurePermission()
            .then(result => {
              if (result === 'granted') save({ backgroundMonitoring: true });
              else {
                setBackgroundMessage(
                  'Notifications are blocked, so background monitoring cannot run. Allow notifications for PowerGuard in system settings.',
                );
              }
            })
            .catch(() => undefined);
        }}
        trackColor={{ false: c.border, true: c.info + '88' }}
        thumbColor={value ? c.info : c.muted}
      />
    </View>
  );

  return (
    <ScrollView
      style={{ backgroundColor: c.background }}
      contentContainerStyle={[s.content, { paddingTop: 20 + insets.top }]}
    >
      <Text style={[s.title, { color: c.text }]}>Settings</Text>
      <Text style={[s.sub, { color: c.muted }]}>
        Personalize monitoring and alerts
      </Text>

      <Text style={[s.kicker, { color: c.muted }]}>DEVICE</Text>
      <Card style={[s.card, { backgroundColor: c.surface }]}>
        <Text style={[s.label, { color: c.secondary }]}>Device ID</Text>
        <TextInput
          accessibilityLabel="Device ID"
          value={draft}
          onChangeText={setDraft}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="esp32_01"
          placeholderTextColor={c.muted}
          style={[
            s.input,
            { color: c.text, borderColor: draftValid ? c.border : c.danger },
          ]}
        />
        {!draftValid ? (
          <Text style={[s.error, { color: c.danger }]}>
            Use letters, numbers, - or _ (max 64)
          </Text>
        ) : (
          <Text style={[s.hint, { color: c.muted }]}>
            Path: /devices/{draft}/live
          </Text>
        )}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Save device ID"
          accessibilityState={{ disabled: !draftValid || draft === deviceId }}
          disabled={!draftValid || draft === deviceId}
          onPress={() => save({ deviceId: draft })}
          style={[
            s.button,
            { backgroundColor: c.info + '24', borderColor: c.info },
            (!draftValid || draft === deviceId) && s.disabled,
          ]}
        >
          <Text style={[s.buttonText, { color: c.info }]}>SAVE</Text>
        </TouchableOpacity>
      </Card>

      <Text style={[s.kicker, { color: c.muted }]}>ALERTS</Text>
      <Card style={[s.card, s.tight, { backgroundColor: c.surface }]}>
        {toggle(
          'alertFault',
          alertFault,
          'Line fault',
          'Notify when a line fault starts',
        )}
        {toggle(
          'alertSmoke',
          alertSmoke,
          'Smoke detection',
          'Notify when smoke is detected',
        )}
        {toggle(
          'alertRain',
          alertRain,
          'Rain detection',
          'Notify when rain is detected',
        )}
      </Card>

      <Text style={[s.kicker, { color: c.muted }]}>THRESHOLDS</Text>
      <Card style={[s.card, { backgroundColor: c.surface }]}>
        <Hint
          color={c.muted}
          text="Thresholds colour the gauges. Alerts come from the device's own fault detection."
        />
        <Range
          label="Minimum voltage"
          unit="V"
          value={minVoltage}
          min={LIMITS.minVoltage.min}
          max={Math.min(LIMITS.minVoltage.max, maxVoltage - MIN_VOLTAGE_GAP)}
          step={5}
          onCommit={v => save({ minVoltage: v })}
          colors={c}
        />
        <Range
          label="Maximum voltage"
          unit="V"
          value={maxVoltage}
          min={Math.max(LIMITS.maxVoltage.min, minVoltage + MIN_VOLTAGE_GAP)}
          max={LIMITS.maxVoltage.max}
          step={5}
          onCommit={v => save({ maxVoltage: v })}
          colors={c}
        />
        <Range
          label="Maximum current"
          unit="A"
          value={maxCurrent}
          min={LIMITS.maxCurrent.min}
          max={LIMITS.maxCurrent.max}
          step={LIMITS.maxCurrent.step}
          onCommit={v => save({ maxCurrent: v })}
          colors={c}
        />
      </Card>

      <Text style={[s.kicker, { color: c.muted }]}>APPEARANCE</Text>
      <Card style={[s.card, { backgroundColor: c.surface }]}>
        <Text style={[s.rowTitle, { color: c.text }]}>Theme</Text>
        <View style={s.chips}>
          {THEMES.map(t => (
            <TouchableOpacity
              key={t}
              accessibilityRole="radio"
              accessibilityLabel={`${t} theme`}
              accessibilityState={{ selected: theme === t }}
              onPress={() => save({ theme: t })}
              style={[
                s.chip,
                {
                  backgroundColor: theme === t ? c.info + '24' : c.elevated,
                  borderColor: theme === t ? c.info : c.border,
                },
              ]}
            >
              <Text
                style={[
                  s.chipText,
                  { color: theme === t ? c.info : c.secondary },
                ]}
              >
                {t.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      <Text style={[s.kicker, { color: c.muted }]}>BACKGROUND</Text>
      <Card style={[s.card, s.tight, { backgroundColor: c.surface }]}>
        {toggle(
          'backgroundMonitoring',
          background,
          'Background monitoring',
          'Keep watching while the app is minimized. Shows a persistent notification.',
        )}
        {backgroundMessage ? (
          <Text style={[s.error, s.pad, { color: c.danger }]}>
            {backgroundMessage}
          </Text>
        ) : null}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Battery optimization settings"
          onPress={() =>
            openBatteryOptimizationSettings().catch(() => undefined)
          }
          style={s.row}
        >
          <View style={s.rowText}>
            <Text style={[s.rowTitle, { color: c.text }]}>
              Battery optimization
            </Text>
            <Text style={[s.hint, { color: c.muted }]}>
              Some phones may still stop monitoring unless PowerGuard is set to
              unrestricted.
            </Text>
          </View>
          <Text style={[s.chev, { color: c.muted }]}>›</Text>
        </TouchableOpacity>
      </Card>

      <Text style={[s.kicker, { color: c.muted }]}>ABOUT</Text>
      <Card style={[s.card, { backgroundColor: c.surface }]}>
        <Text style={[s.hint, { color: c.secondary }]}>
          PowerGuard is a monitoring aid, not a certified safety system. Alerts
          are best-effort and depend on the phone, the network and the device
          being online.
        </Text>
      </Card>
    </ScrollView>
  );
}

function Hint({ text, color }: { text: string; color: string }) {
  return <Text style={[s.hint, s.hintGap, { color }]}>{text}</Text>;
}

function Range({
  label,
  unit,
  value,
  min,
  max,
  step,
  onCommit,
  colors: c,
}: {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onCommit: (n: number) => void;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  const [live, setLive] = useState<number | null>(null);
  const shown = live ?? value;
  return (
    <View style={s.range}>
      <View style={s.rangeHead}>
        <Text style={[s.label, { color: c.secondary }]}>{label}</Text>
        <Text style={[s.rangeValue, { color: c.text }]}>
          {shown} {unit}
        </Text>
      </View>
      <Slider
        accessibilityLabel={label}
        accessibilityValue={{ text: `${shown} ${unit}` }}
        minimumValue={min}
        maximumValue={Math.max(min, max)}
        step={step}
        value={value}
        minimumTrackTintColor={c.info}
        maximumTrackTintColor={c.border}
        thumbTintColor={c.info}
        onValueChange={setLive}
        onSlidingComplete={v => {
          setLive(null);
          onCommit(v);
        }}
        style={s.slider}
      />
    </View>
  );
}

const s = StyleSheet.create({
  content: { padding: 20, paddingBottom: 32 },
  title: { fontSize: 27, fontWeight: '900' },
  sub: { fontSize: 12, marginTop: 5, marginBottom: 18 },
  kicker: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 9,
  },
  card: { marginBottom: 20 },
  tight: { paddingVertical: 4 },
  label: { fontSize: 12 },
  input: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 7,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  hint: { fontSize: 11, marginTop: 4 },
  hintGap: { marginBottom: 8 },
  error: { fontSize: 12, marginTop: 6 },
  pad: { paddingBottom: 8 },
  button: {
    marginTop: 12,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontWeight: '800', fontSize: 12, letterSpacing: 1 },
  disabled: { opacity: 0.4 },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: { flex: 1, paddingVertical: 8 },
  rowTitle: { fontWeight: '700' },
  chev: { fontSize: 24, paddingHorizontal: 6 },
  chips: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  chip: {
    borderWidth: 1,
    paddingHorizontal: 14,
    minHeight: 48,
    justifyContent: 'center',
    borderRadius: 99,
  },
  chipText: { fontSize: 11, fontWeight: '700' },
  range: { marginBottom: 12 },
  rangeHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rangeValue: { fontWeight: '800' },
  slider: { width: '100%', height: 40 },
});
