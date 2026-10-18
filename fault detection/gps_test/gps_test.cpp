// Standalone GPS module test (NEO-6M / NEO-7M / NEO-8M or any NMEA GPS at 9600 baud).
// Not part of the main firmware. Build and flash with:
//
//   pio run -e gps_test -t upload
//   pio device monitor -e gps_test
//
// Wiring (UART2):
//   GPS TX  -> ESP32 GPIO16 (RX2)
//   GPS RX  -> ESP32 GPIO17 (TX2)
//   GPS VCC -> 3.3V (or 5V if your breakout has a regulator)
//   GPS GND -> GND
//
// Take the module outdoors or to a window with a clear sky. A cold start can take
// several minutes; after that the fix comes back in seconds.

#include <Arduino.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <TinyGPSPlus.h>

// LCD (same I2C bus and address as the main firmware): SDA = GPIO21, SCL = GPIO22
LiquidCrystal_I2C lcd(0x27, 16, 2);

const int GPS_RX_PIN = 16;  // ESP32 pin that receives from the GPS TX
const int GPS_TX_PIN = 17;  // ESP32 pin that sends to the GPS RX
const uint32_t GPS_BAUD = 9600;

const uint32_t PRINT_INTERVAL_MS = 2000;
const uint32_t NO_DATA_WARN_MS = 5000;
const uint32_t LCD_PAGE_INTERVAL_MS = 2000;

HardwareSerial gpsSerial(2);
TinyGPSPlus gps;

void printStatus() {
  Serial.println("\n--- GPS STATUS ---");

  Serial.printf("Characters received: %lu | sentences OK: %lu | checksum failures: %lu\n",
                (unsigned long)gps.charsProcessed(),
                (unsigned long)gps.passedChecksum(),
                (unsigned long)gps.failedChecksum());

  Serial.printf("Satellites: %s | HDOP: %s\n",
                gps.satellites.isValid() ? String(gps.satellites.value()).c_str() : "--",
                gps.hdop.isValid() ? String(gps.hdop.hdop(), 1).c_str() : "--");

  if (gps.location.isValid()) {
    Serial.printf("Fix: YES (age %lu ms)\n", (unsigned long)gps.location.age());
    Serial.printf("Latitude : %.6f\n", gps.location.lat());
    Serial.printf("Longitude: %.6f\n", gps.location.lng());
    Serial.printf("Map      : https://maps.google.com/?q=%.6f,%.6f\n",
                  gps.location.lat(), gps.location.lng());
  } else {
    Serial.println("Fix: NO (searching for satellites...)");
  }

  if (gps.altitude.isValid()) {
    Serial.printf("Altitude : %.1f m\n", gps.altitude.meters());
  }
  if (gps.speed.isValid()) {
    Serial.printf("Speed    : %.1f km/h\n", gps.speed.kmph());
  }
  if (gps.date.isValid() && gps.time.isValid()) {
    Serial.printf("UTC time : %04d-%02d-%02d %02d:%02d:%02d\n",
                  gps.date.year(), gps.date.month(), gps.date.day(),
                  gps.time.hour(), gps.time.minute(), gps.time.second());
  }
}

// Two LCD screens that alternate: position, then satellites/speed.
// Without a fix the first screen shows the search status instead.
void updateLcd() {
  static uint32_t lastPage = 0;
  static uint8_t page = 0;
  if (millis() - lastPage < LCD_PAGE_INTERVAL_MS) return;
  lastPage = millis();

  lcd.clear();
  lcd.setCursor(0, 0);

  if (gps.charsProcessed() < 10) {
    lcd.print("GPS: NO DATA");
    lcd.setCursor(0, 1);
    lcd.print("Check wiring");
    return;
  }

  if (page == 0) {
    if (gps.location.isValid()) {
      lcd.print("Lat:");
      lcd.print(gps.location.lat(), 6);
      lcd.setCursor(0, 1);
      lcd.print("Lon:");
      lcd.print(gps.location.lng(), 6);
    } else {
      lcd.print("Searching GPS...");
      lcd.setCursor(0, 1);
      lcd.print("No fix yet");
    }
  } else {
    lcd.print("Sat:");
    lcd.print(gps.satellites.isValid() ? (int)gps.satellites.value() : 0);
    lcd.print(" HDOP:");
    if (gps.hdop.isValid()) {
      lcd.print(gps.hdop.hdop(), 1);
    } else {
      lcd.print("--");
    }
    lcd.setCursor(0, 1);
    lcd.print("Spd:");
    if (gps.speed.isValid()) {
      lcd.print(gps.speed.kmph(), 1);
      lcd.print("km/h");
    } else {
      lcd.print("--");
    }
  }

  page = (page + 1) % 2;
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\nGPS test starting");
  Serial.printf("GPS UART2: RX=GPIO%d TX=GPIO%d @ %lu baud\n",
                GPS_RX_PIN, GPS_TX_PIN, (unsigned long)GPS_BAUD);

  Wire.begin(21, 22);
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("GPS Test");
  lcd.setCursor(0, 1);
  lcd.print("Starting...");

  gpsSerial.begin(GPS_BAUD, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
}

void loop() {
  // Feed every available byte to the NMEA parser
  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }

  static uint32_t lastPrint = 0;
  if (millis() - lastPrint >= PRINT_INTERVAL_MS) {
    lastPrint = millis();
    printStatus();
  }

  updateLcd();

  // Wiring problem: nothing at all is arriving from the module
  if (millis() > NO_DATA_WARN_MS && gps.charsProcessed() < 10) {
    static uint32_t lastWarn = 0;
    if (millis() - lastWarn >= NO_DATA_WARN_MS) {
      lastWarn = millis();
      Serial.println("WARNING: no GPS data. Check power, and that GPS TX goes to GPIO16 and GPS RX to GPIO17.");
    }
  }
}
