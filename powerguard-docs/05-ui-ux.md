# UI / UX

## Design direction

A modern **control room** look: calm and premium when everything is healthy, urgent and unmistakable when something is wrong. Dark theme first, with a clean light theme. Health is always readable at a glance from the hero banner, then in detail from the gauges and tiles.

No design-tool file exists. This document is the design spec. If a Figma file is added later, link it here, and it will take precedence for layout details.

## Design tokens

Defined in `src/theme/tokens.ts`. Components use tokens only (an ESLint rule bans hex literals elsewhere).

### Color

| Token | Dark | Light | Use |
|---|---|---|---|
| `background` | `#0B1220` | `#F5F7FB` | Screen background |
| `surface` | `#121A2B` | `#FFFFFF` | Cards, tiles, tab bar |
| `surfaceAlt` | `#182238` | `#EEF2F8` | Pressed states, chart grid fill, skeleton base |
| `border` | `rgba(255,255,255,0.06)` | `rgba(15,23,42,0.08)` | 1 px card borders |
| `textPrimary` | `#E6EDF7` | `#0F172A` | Main text, big numbers |
| `textSecondary` | `#9AA8BF` | `#475569` | Labels, units |
| `textMuted` | `#7D8AA3` | `#5B6678` | Timestamps, stale data |
| `ok` | `#10B981` | `#047857` | Healthy state |
| `warning` | `#F59E0B` | `#B45309` | Near limit |
| `danger` | `#F05252` | `#C81E1E` | Fault, smoke, out of range |
| `info` | `#38BDF8` | `#0369A1` | Rain |
| `accentVoltage` | `#22D3EE` | `#0E7490` | Voltage series and gauge base |
| `accentCurrent` | `#A78BFA` | `#6D28D9` | Current series and gauge base |
| `onAccent` | `#0B1220` | `#FFFFFF` | Text on accent-filled pills |

Glow colors are the semantic color at 35% (dark) or 20% (light) opacity, rendered as a soft shadow or SVG radial gradient behind cards. No blur views.

**Contrast rule:** semantic colors (`ok`, `warning`, `danger`, `info`) may be used for text only on `background` or `surface`, never on `surfaceAlt`. All listed text tokens are verified ≥ 4.5:1 on `background` and `surface` in both themes (the lowest pair is dark `danger` on `surface` at 4.99). The test in [07-testing-strategy.md](07-testing-strategy.md) enforces this.

### Spacing, radius, elevation

| Token | Value |
|---|---|
| `space` | 4, 8, 12, 16, 20, 24, 32, 40 (use multiples of 8 for layout; 4/12 for fine adjustment) |
| `radius.card` | 22 |
| `radius.tile` | 18 |
| `radius.pill` | 999 |
| `screenPadding` | 16 horizontal |
| `elevation.card` | Android `elevation: 2` (dark) / `4` (light), plus 1 px `border` |

### Typography

Bundled fonts: **Inter** (400, 500, 600, 700) and **JetBrains Mono** (500, 700), linked via `react-native.config.js`.

| Token | Font | Size / line height | Use |
|---|---|---|---|
| `display` | JetBrains Mono 700 | 40 / 44 | Gauge center value |
| `title` | Inter 700 | 22 / 28 | Screen titles, banner headline |
| `heading` | Inter 600 | 17 / 22 | Card titles |
| `body` | Inter 400 | 15 / 20 | Body text |
| `label` | Inter 500 | 13 / 16 | Tile labels, chips |
| `caption` | Inter 400 | 12 / 16 | Timestamps, footnotes |
| `numeric` | JetBrains Mono 500 | 15 / 20 | Inline numbers (power, ppm, tooltip) |

Numbers always use JetBrains Mono so digits keep the same width as values change. Respect the OS font scale up to 1.3× (`maxFontSizeMultiplier = 1.3`) so layouts don't break.

## Navigation

```
RootNavigator (native-stack, headerShown: false)
└── MainTabs (bottom-tabs, custom TabBar)
    ├── Dashboard   icon: gauge
    ├── History     icon: history
    └── Settings    icon: settings
```

Custom `TabBar`: `surface` background, top border, icon + label per tab, and an active pill indicator (`accentVoltage` at 16% opacity behind the active icon) that slides with Reanimated. Height 64 dp plus the bottom safe-area inset. Each tab target is ≥ 48 dp. The layout is edge-to-edge, and status and navigation bar colors follow the theme.

## Screens & flows

### Dashboard

Layout, top to bottom, scrolling vertically with 16 dp padding and 16 dp gaps:

1. **Header row:** app name "PowerGuard" (title) on the left; `ConnectionPill` on the right.
2. **Offline banner** (only when `device_offline` or `phone_offline`): full-width `surface` card with a muted icon and text per [FR-2](01-requirements.md#fr-2-connectivity-status).
3. **Permission card** (only when notifications are denied and not dismissed): per [FR-14](01-requirements.md#fr-14-notification-permission).
4. **`HeroStatusBanner`**: full width, about 120 dp tall.
5. **Gauge row:** two `ArcGauge`s side by side (Voltage, Current), with a `PowerChip` centered below them, overlapping both gauge cards by 12 dp.
6. **Status tiles:** a row of three `StatusTile`s (Line fault, Smoke, Rain), each about one third of the width. On screens narrower than 360 dp, they wrap to two plus one.
7. **`LiveChart` card:** title "Voltage & current", `SegmentedControl` (5 min · 1 h · 24 h), then the chart (220 dp tall) and a legend.

| State | What renders |
|---|---|
| `loading` | Skeletons in place of banner, gauges, tiles and chart (same sizes, shimmer) |
| `online` + reading | Full dashboard |
| `liveEmpty` | `EmptyState` "Waiting for device data" with the device ID and a hint to check the field unit |
| `device_offline` | Offline banner + last known values in `textMuted`, gauges desaturated, no pulses |
| `phone_offline` | Same as device offline, with the phone-offline banner text |
| `error: auth_failed` | `ErrorState` "Couldn't connect to the server" + Retry |
| `error: db_permission_denied` | `ErrorState` "No access to this device" with the device ID + Retry + "Change device" (goes to Settings) |

Pull-to-refresh calls `refetch()` on the chart and re-runs `bootstrap()` if there is an error. Live data needs no refresh.

### History

1. Title "History".
2. Filter chips: All · Fault · Smoke · Rain (single select, horizontally scrollable).
3. `SectionList` grouped by day, each row an `EventRow`.
4. Footer caption: "Events are based on 10-second samples. Very short events may not appear."

| State | What renders |
|---|---|
| loading | 6 skeleton rows |
| success, events | Grouped list |
| success, no events | `EmptyState` "No events in the last 24 hours" |
| error | `ErrorState` "Couldn't load history" + Retry |
| device offline | Banner at top; list still shows what was loaded |

### Settings

Grouped sections in `surface` cards:

1. **Device:** Device ID text field with inline validation and a Save button (disabled until valid and changed).
2. **Alerts:** three `Switch` rows (Line fault, Smoke, Rain), each with an icon and a one-line description.
3. **Limits:** three `Slider` rows (Minimum voltage, Maximum voltage, Maximum current), each with a live value label in `numeric`. A "Reset to defaults" text button sits below.
4. **Background monitoring:** a `Switch` with the description "Keep watching for alerts while the app is minimized. Shows a permanent notification." Below it, a "Battery optimization" row that opens system settings, with the caption "Some phones stop background apps. Allow PowerGuard to run unrestricted."
5. **Appearance:** `SegmentedControl` System · Dark · Light.
6. **About:** app version (from native), package id, and "Made by HexCodePlus".

### Primary flows

1. **Check status:** open app → splash → skeleton → banner shows "All systems normal" → glance at gauges.
2. **Respond to alert:** notification "Smoke detected" → tap → Dashboard opens with banner red and pulsing → read tiles and gauges.
3. **Investigate:** History tab → filter "Fault" → see when faults started and cleared.
4. **Configure:** Settings → change device ID → Save → Dashboard reloads for the new device.
5. **Enable background:** Settings → toggle Background monitoring → permission prompt (if needed) → persistent notification appears.

## Component inventory

### Core (`src/components/core/`)

| Component | Props | Behavior |
|---|---|---|
| `Card` | `children`, `glow?: Level \| 'info' \| null`, `style?` | `surface` background, card radius, border, optional state glow |
| `AppText` | `variant: TypographyToken`, `color?: ColorToken`, `children`, `numberOfLines?` | The only text component; applies tokens and the font-scale cap |
| `Icon` | `name: IconName`, `size?`, `color?: ColorToken` | Wraps lucide icons; `accessible={false}` by default |
| `Pill` | `label`, `tone: Level \| 'info' \| 'neutral'`, `leading?: ReactNode` | Rounded chip |
| `Skeleton` | `width`, `height`, `radius?` | Shimmer via Reanimated; static when reduce-motion is on |
| `EmptyState` | `icon`, `title`, `message?`, `action?: { label, onPress }` | Centered, illustration-style icon (64 dp, in a soft circle) |
| `ErrorState` | `title`, `message?`, `onRetry`, `secondary?: { label, onPress }` | Like EmptyState with `danger` icon |
| `Switch` | `value`, `onValueChange`, `accessibilityLabel` | Themed native switch, 48 dp row |
| `Slider` | `value`, `min`, `max`, `step`, `onChange`, `label`, `unit` | Gesture-handler slider with value label |
| `SegmentedControl` | `options: {value,label}[]`, `value`, `onChange` | Animated selection pill |

### Domain (`src/components/domain/`)

| Component | Props | Behavior |
|---|---|---|
| `HeroStatusBanner` | `state: WorstState`, `faultType: FaultType \| null`, `others: AlertKey[]` | Icon (56 dp) + headline + optional "+ others" line. Gradient tint at ≤ 16% opacity of the state color over `surface`, plus a glow. Pulses (opacity 0.6↔1, 1.2 s) for `line_fault` and `smoke` |
| `ArcGauge` | `label`, `value`, `unit`, `min`, `max`, `warnAt: [number, number?]`, `level: Level`, `invalid: boolean`, `stale: boolean`, `accent: 'voltage' \| 'current'` | 240° SVG arc, 14 dp stroke, gradient from accent to level color. Threshold tick marks. Value animates (count + sweep, 400 ms ease-out). Center: value in `display`, unit in `label`, level text below. `invalid` → small warning dot + "Invalid reading" caption. `stale` → `textMuted`, desaturated |
| `PowerChip` | `watts: number`, `stale` | Pill with a lightning icon and "419 W" in `numeric` |
| `StatusTile` | `kind: AlertKey`, `active: boolean`, `detail?: string`, `stale` | Icon, title, state label ("Normal"/"Detected"/"Fault"). Active: border and glow in `danger` (fault/smoke) or `info` (rain), with a pulse for fault/smoke and a ripple for rain. `detail` shows fault type or smoke ppm |
| `ConnectionPill` | `connectivity`, `secondsSinceUpdate`, `rssiBars` | Dot (pulsing when online) + text + optional signal bars |
| `LiveChart` | `voltage: ChartPoint[]`, `current: ChartPoint[]`, `range`, `status`, `onRetry` | Two smooth curves (monotone cubic) on dual Y axes (left V, right A), gradient area fill under each at 18% opacity, 4 horizontal grid lines, time axis with 4 labels. Touch-and-drag shows a vertical cursor and tooltip |
| `EventRow` | `event: HistoryEvent` | Colored icon chip, title ("Smoke detected" / "Smoke cleared" / "Line fault: Over current"), relative time ("12 min ago") and absolute time (HH:MM) |
| `PermissionCard` | `onOpenSettings`, `onDismiss` | `warning` tone card |

## States & feedback

- **Loading:** always skeletons matching final layout; never a bare spinner or blank screen.
- **Empty:** `EmptyState` with a specific message and, where useful, an action.
- **Error:** `ErrorState` with plain language and a Retry. Never show raw error text.
- **Stale/offline:** values stay visible in `textMuted` with a clear banner. Animations stop.
- **Success feedback:** saving settings shows a brief inline "Saved" check next to the field (1.5 s). Toasts are not used.
- **Alert feedback:** notification + one haptic pulse + banner/tile change, all on the same rising edge.

## Motion

| Animation | Spec | Reduce-motion behavior |
|---|---|---|
| Gauge sweep + number count | 400 ms, ease-out cubic, on value change | Jump to value |
| Banner/tile pulse | Opacity 0.6↔1.0, 1200 ms loop, while active | Static, full opacity, thicker border |
| Rain ripple | Expanding ring, 1600 ms loop | Static icon |
| Connection dot | Scale 1↔1.4 + fade, 1500 ms loop | Static dot |
| Tab indicator | Spring (damping 18, stiffness 180) | Instant |
| Skeleton shimmer | Gradient sweep 1200 ms | Static `surfaceAlt` block |
| Screen transitions | Native stack defaults | System handles |

All animation runs on the UI thread via Reanimated shared values. JS-driven `Animated` is not used.

## Accessibility & responsiveness

- **Contrast:** ≥ 4.5:1 for all text (token test). Non-text UI (gauge arcs, chart lines) ≥ 3:1 against its background.
- **Touch targets:** ≥ 48 × 48 dp, using `hitSlop` where the visual is smaller.
- **Labels:** gauges announce "Voltage, 230.4 volts, normal"; tiles announce "Smoke, detected" / "Smoke, normal"; the banner announces its headline; chart: "Voltage and current chart, last 5 minutes" with the latest values.
- **Live region:** `HeroStatusBanner` uses `accessibilityLiveRegion="polite"` so screen readers announce state changes.
- **Never color alone:** every state has an icon and a text label.
- **Font scaling:** supported up to 1.3×; layouts tested at 1.0× and 1.3×.
- **Screen sizes:** designed for 360–430 dp widths. Below 360 dp, status tiles wrap. Tablets get a max content width of 640 dp, centered.
- **Orientation:** portrait only (`android:screenOrientation="portrait"`) `[ASSUMPTION]`.

## App icon and splash

- **Launcher icon:** adaptive icon. Foreground is a vector shield containing a lightning bolt in `accentVoltage`; background is a solid `#0B1220`. Provided as `ic_launcher_foreground.xml` (vector drawable) plus a monochrome layer for Android 13 themed icons.
- **Splash:** `#0B1220` background with the same mark centered, implemented as an Android 12+ `SplashScreen` theme with a pre-12 fallback drawable. It is dismissed after the first React frame.
- No stock imagery or raster illustrations anywhere in the app.
