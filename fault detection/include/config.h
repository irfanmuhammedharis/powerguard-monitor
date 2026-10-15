#pragma once
// Hardware map, timing and detection limits for the PowerGuard field unit.
// Per-unit secrets live in secrets.h; per-unit analog calibration is stored in NVS
// (see the "cal" commands) so changing a trim pot never needs a re-flash.

// ----------------------------------------------------------------- Pins -------
// Every analog input is on ADC1 (GPIO32-39). ADC2 cannot be used while Wi-Fi is on.
#define PIN_ZMPT_VOLTAGE 34   // ZMPT101B OUT, through a 10k/20k divider (see README)
#define PIN_CT_CURRENT 35     // SCT-013-015 on a VCC/2 bias network (see README)
#define PIN_MQ135_AO 32       // MQ-135 AO, through a 10k/20k divider (sensor runs on 5 V)
#define PIN_RAIN_AO 33        // rain module AO (analog)
#define PIN_RAIN_POWER 27     // switches the rain plate's supply; see RAIN_* below
#define PIN_STATUS_LED 2      // on-board LED on most ESP32 DevKit boards

// ------------------------------------------------------- Data contract timing -
#define LIVE_INTERVAL_MS 2000      // /live and /status (docs: LIVE_INTERVAL_S = 2)
#define HISTORY_INTERVAL_MS 10000  // /history ring buffer (docs: HISTORY_INTERVAL_S = 10)

// Report line-health as "last_seen" using the Firebase server clock. This keeps the
// app's online/offline logic correct even if this unit's NTP time is wrong
// (ADR-0008). `ts` on live/history samples always comes from NTP.
#define USE_SERVER_TIMESTAMP_LAST_SEEN 1

// --------------------------------------------------------- AC measurement ----
// One window covers 10 mains cycles (200 ms at 50 Hz), so the RMS integrates a
// whole number of cycles. 60 Hz grids: use 167 ms.
#define AC_WINDOW_MS 200
#define AC_MIN_SAMPLES_PER_WINDOW 300  // below this the window is discarded as invalid
#define AC_PAUSE_MS 100                // gap between windows (lets other tasks run)

#define VOLTAGE_DEADBAND_V 15.0   // below this the mains channel reads exactly 0
#define CURRENT_DEADBAND_A 0.10   // below this the CT channel reads exactly 0

// A healthy bias sits near mid-rail. A mean outside this band means the front end is
// unplugged/floating or railed; the fault detector is then suppressed rather than
// reporting a bogus line fault.
#define AC_BIAS_MIN_MV 600
#define AC_BIAS_MAX_MV 2700
// A waveform touching these limits is clipping the ADC; a clipped CT channel means a
// large overload and is treated as at least SHORT_CURRENT_A.
#define ADC_CLIP_HIGH_MV 3050
#define ADC_CLIP_LOW_MV 120

// ------------------------------------------------------------ Line faults ----
// Defaults mirror the app (180-260 V, 10 A). The app's thresholds only colour the UI;
// these decide when the unit reports line_fault = true.
#define OVER_VOLTAGE_V 260.0
#define UNDER_VOLTAGE_V 180.0
#define OPEN_LINE_V 50.0
#define OVER_CURRENT_A 10.0
#define SHORT_CURRENT_A 14.0  // SCT-013-015 saturates just above its 15 A rating

// ------------------------------------------------------------------ MQ-135 ---
#define MQ135_VCC 5.0
#define MQ135_RL_KOHM 10.0          // check the SMD marking on the module: 103 = 10k
#define MQ135_DIVIDER_RATIO 1.5     // 10k over 20k divider -> ADC sees 2/3 of AO
#define MQ135_WARMUP_S 180          // heater stabilisation; smoke is never raised before this
#define MQ135_PERIOD_MS 1000
// "ppm" here is a CO2-equivalent contamination index (see mq135.h). Smoke from
// burning insulation drives it far above normal indoor air (400-1500). Tune these
// two numbers with a real smoke test after calibrating R0.
#define SMOKE_ON_PPM 1500.0
#define SMOKE_OFF_PPM 1000.0
#define SMOKE_ON_MS 4000
#define SMOKE_OFF_MS 15000

// -------------------------------------------------------------------- Rain ---
// Wet plates conduct, which pulls AO towards 0 V; a dry plate reads near the supply.
// The plate is only powered while sampling, which prevents it electrolysing away.
#define RAIN_PERIOD_MS 1000
#define RAIN_SETTLE_MS 30
#define RAIN_ON_MV 2200    // below this = wet
#define RAIN_OFF_MV 2600   // above this = dry again
#define RAIN_ON_MS 3000
#define RAIN_OFF_MS 10000

// ---------------------------------------------------------------- Reliability --
#define WDT_TIMEOUT_S 40            // hardware watchdog for the worker tasks
#define HTTP_TIMEOUT_MS 6000
#define STALE_SENSOR_MS 5000        // stop sending the heartbeat if sensing stalls
#define MIN_FREE_HEAP_BYTES 30000   // below this for ~15 s -> restart (TLS needs ~40 KB)
#define NO_UPLOAD_RESTART_MS (10UL * 60UL * 1000UL)  // reboot after 10 min without a good write
#define NTP_SYNC_TIMEOUT_MS 20000
#define TOKEN_REFRESH_MARGIN_S 300  // renew the ID token this long before it expires

#define SERIAL_BAUD 115200
