#include "cli.h"

#include <Arduino.h>

#include <cmath>
#include <cstdlib>
#include <cstring>
#include <strings.h>

#include "ac_rms.h"
#include "app_state.h"
#include "calibration_store.h"
#include "config.h"
#include "mq135.h"

namespace cli {

namespace {

bool g_verbose = true;
char g_line[96];
size_t g_len = 0;

// Raw AC RMS with the stored noise floor removed: what "cal v" / "cal i" scale.
double cleanRms(double rms_mv, double noise_mv) {
  const double clean = rms_mv * rms_mv - noise_mv * noise_mv;
  return clean > 0.0 ? std::sqrt(clean) : 0.0;
}

void printHelp() {
  Serial.println(
      "\nCommands\n"
      "  status                 current readings, cloud state, calibration\n"
      "  verbose on|off         periodic one-line summary every 5 s\n"
      "  cal show               print calibration values\n"
      "  cal v <volts>          set mains-voltage gain from a multimeter reading (RMS)\n"
      "  cal i <amps>           set current gain from a known load / clamp-meter reading\n"
      "  cal vzero              store the voltage-channel noise floor (ZMPT input disconnected)\n"
      "  cal izero              store the current-channel noise floor (CT clamped on NO conductor)\n"
      "  cal mq                 store MQ-135 R0 (warmed up, in clean air)\n"
      "  cal clear              erase calibration (back to defaults)\n"
      "  reboot");
}

void printCalibration(const pg::Calibration& c) {
  Serial.printf("calibration: v_gain=%.5f V/mV (%s)  v_noise=%.2f mV | i_gain=%.6f A/mV  i_noise=%.2f mV | mq_r0=%.2f kOhm (%s)\n",
                c.v_gain, c.v_calibrated ? "calibrated" : "UNCALIBRATED - voltage faults off", c.v_noise_mv,
                c.i_gain, c.i_noise_mv, c.mq_r0_kohm,
                c.mq_calibrated ? "calibrated" : "UNCALIBRATED - smoke sensing off");
}

void commit(const pg::Calibration& c, const char* what) {
  app::setCalibration(c);
  saveCalibration(c);
  Serial.printf("OK: %s saved. ", what);
  printCalibration(c);
}

void calVoltage(double volts) {
  const app::Snapshot s = app::snapshot();
  pg::Calibration c = app::calibration();
  const double clean = cleanRms(s.v_rms_mv, c.v_noise_mv);
  if (!s.valid || clean < 20.0) {
    Serial.println("ERR: no AC signal on the voltage channel (is the ZMPT101B wired and mains on?)");
  } else if (!(volts > 50.0 && volts < 500.0)) {
    Serial.println("ERR: enter the RMS mains voltage in volts, e.g. cal v 231.5");
  } else {
    c.v_gain = volts / clean;
    c.v_calibrated = true;
    commit(c, "voltage gain (voltage-based faults are now active)");
  }
}

void calCurrent(double amps) {
  const app::Snapshot s = app::snapshot();
  pg::Calibration c = app::calibration();
  const double clean = cleanRms(s.i_rms_mv, c.i_noise_mv);
  if (!s.valid || clean < 5.0) {
    Serial.println("ERR: no current measured - run a known load through the CT first");
  } else if (!(amps > 0.1 && amps < 20.0)) {
    Serial.println("ERR: enter the load current in amps (0.1-20), e.g. cal i 5.2");
  } else {
    c.i_gain = amps / clean;
    commit(c, "current gain");
  }
}

void calZero(bool voltage) {
  const app::Snapshot s = app::snapshot();
  pg::Calibration c = app::calibration();
  const double raw = voltage ? s.v_rms_mv : s.i_rms_mv;
  const double limit = voltage ? 60.0 : 40.0;  // anything larger is a real signal, not noise
  if (!s.valid) {
    Serial.println("ERR: no measurement yet");
  } else if (raw > limit) {
    Serial.printf("ERR: %.1f mV is a real signal, not noise. %s\n", raw,
                  voltage ? "Disconnect mains from the ZMPT101B input first."
                          : "Make sure no conductor passes through the CT.");
  } else {
    (voltage ? c.v_noise_mv : c.i_noise_mv) = raw;
    commit(c, voltage ? "voltage noise floor" : "current noise floor");
  }
}

void calMq() {
  const app::Snapshot s = app::snapshot();
  pg::Calibration c = app::calibration();
  if (!s.mq_warm) {
    Serial.printf("ERR: MQ-135 not ready (needs %d s warm-up and a connected sensor). Leave it powered in clean air "
                  "- a first-time sensor should burn in for 24 h.\n", MQ135_WARMUP_S);
    return;
  }
  c.mq_r0_kohm = pg::mq135R0FromCleanAir(s.mq_rs_kohm);
  c.mq_calibrated = true;
  commit(c, "MQ-135 R0 (smoke sensing is now active)");
}

void handle(char* line) {
  char* cmd = strtok(line, " \t");
  if (!cmd) return;
  char* arg1 = strtok(nullptr, " \t");
  char* arg2 = strtok(nullptr, " \t");

  if (!strcasecmp(cmd, "help") || !strcmp(cmd, "?")) {
    printHelp();
  } else if (!strcasecmp(cmd, "status")) {
    printSummary();
    printCalibration(app::calibration());
    const app::Snapshot s = app::snapshot();
    const app::NetStatus n = app::net();
    Serial.printf("raw: v=%.1f mV rms (bias %s)  i=%.1f mV rms (bias %s%s)  samples/window=%u\n", s.v_rms_mv,
                  s.v_bias_ok ? "ok" : "BAD", s.i_rms_mv, s.i_bias_ok ? "ok" : "BAD",
                  s.i_clipped ? ", CLIPPING" : "", static_cast<unsigned>(s.samples));
    Serial.printf("mq135: Rs=%.2f kOhm %s | cloud: live ok/fail=%u/%u history ok=%u last http=%d | heap=%u B | up %lu s\n",
                  s.mq_rs_kohm, s.mq_warm ? "" : "(warming up / not connected)",
                  static_cast<unsigned>(n.live_ok), static_cast<unsigned>(n.live_fail),
                  static_cast<unsigned>(n.history_ok), n.last_http, static_cast<unsigned>(ESP.getFreeHeap()),
                  static_cast<unsigned long>(millis() / 1000));
    if (*n.uid) Serial.printf("uid: %s\n", n.uid);
  } else if (!strcasecmp(cmd, "verbose")) {
    g_verbose = !(arg1 && !strcasecmp(arg1, "off"));
    Serial.printf("verbose %s\n", g_verbose ? "on" : "off");
  } else if (!strcasecmp(cmd, "reboot")) {
    Serial.println("rebooting...");
    Serial.flush();
    ESP.restart();
  } else if (!strcasecmp(cmd, "cal") && arg1) {
    if (!strcasecmp(arg1, "show")) {
      printCalibration(app::calibration());
    } else if (!strcasecmp(arg1, "v") && arg2) {
      calVoltage(atof(arg2));
    } else if (!strcasecmp(arg1, "i") && arg2) {
      calCurrent(atof(arg2));
    } else if (!strcasecmp(arg1, "vzero")) {
      calZero(true);
    } else if (!strcasecmp(arg1, "izero")) {
      calZero(false);
    } else if (!strcasecmp(arg1, "mq")) {
      calMq();
    } else if (!strcasecmp(arg1, "clear")) {
      clearCalibration();
      app::setCalibration(pg::Calibration());
      Serial.println("OK: calibration erased, defaults active");
    } else {
      Serial.println("ERR: unknown cal command, type help");
    }
  } else {
    Serial.println("ERR: unknown command, type help");
  }
}

}  // namespace

bool verbose() { return g_verbose; }

void printSummary() {
  const app::Snapshot s = app::snapshot();
  const app::NetStatus n = app::net();
  const bool cloud_ok = n.last_ok_ms != 0 && millis() - n.last_ok_ms < 3UL * LIVE_INTERVAL_MS + 2000;

  char smoke[40];
  if (s.smoke_ready) {
    snprintf(smoke, sizeof(smoke), "%d (%.0f ppm)", s.smoke ? 1 : 0, s.smoke_ppm);
  } else {
    snprintf(smoke, sizeof(smoke), "OFF (%s)", s.mq_warm ? "run cal mq" : "warming up");
  }
  Serial.printf("[%lus] V=%.1f I=%.2f P=%.0fW fault=%s smoke=%s rain=%d (%.0f mV) wifi=%s cloud=%s\n",
                static_cast<unsigned long>(millis() / 1000), s.volts, s.amps, s.volts * s.amps,
                pg::faultTypeName(s.fault), smoke, s.rain ? 1 : 0, s.rain_mv,
                n.wifi ? (String(n.rssi) + " dBm").c_str() : "down", cloud_ok ? "ok" : "--");
}

void poll() {
  while (Serial.available() > 0) {
    const int c = Serial.read();
    if (c == '\r' || c == '\n') {
      if (g_len > 0) {
        g_line[g_len] = '\0';
        g_len = 0;
        handle(g_line);
      }
    } else if (g_len < sizeof(g_line) - 1) {
      g_line[g_len++] = static_cast<char>(c);
    }
  }
}

}  // namespace cli
