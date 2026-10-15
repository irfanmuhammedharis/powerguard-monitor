#pragma once
// Copy this file to include/secrets.h (git-ignored) and fill it in.
// Setup steps: powerguard-docs/09-deployment-ops.md -> "Firebase project setup".

// Wi-Fi (2.4 GHz only - the ESP32 has no 5 GHz radio).
#define WIFI_SSID "your-wifi-name"
#define WIFI_PASSWORD "your-wifi-password"

// Firebase project settings -> General -> "Web API key".
#define FIREBASE_API_KEY "AIza..."

// Realtime Database host only: no https:// and no trailing slash.
// Shown at the top of Build -> Realtime Database -> Data, for example
//   my-project-default-rtdb.asia-southeast1.firebasedatabase.app
//   my-project-default-rtdb.firebaseio.com            (us-central1)
#define FIREBASE_DATABASE_HOST "my-project-default-rtdb.asia-southeast1.firebasedatabase.app"

// The dedicated Authentication user created for this unit (Email/Password provider).
// Its uid must be stored at /config/writers/<DEVICE_ID> - the firmware prints the
// uid on the serial console after the first successful sign-in.
#define FIREBASE_USER_EMAIL "device-esp32_01@powerguard.local"
#define FIREBASE_USER_PASSWORD "change-me"

// Must match "Device ID" in the app's Settings. Allowed: letters, digits, - and _.
#define DEVICE_ID "esp32_01"
