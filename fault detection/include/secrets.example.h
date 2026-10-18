// Copy this file to secrets.h (git-ignored) and fill it in. Firebase settings only;
// Wi-Fi and Telegram live in telegram_secrets.h.
#pragma once

// Firebase project settings -> General -> "Web API key".
#define FIREBASE_API_KEY "AIza..."

// Realtime Database host only: no https:// and no trailing slash, e.g.
//   my-project-default-rtdb.asia-southeast1.firebasedatabase.app
#define FIREBASE_DATABASE_HOST "my-project-default-rtdb.asia-southeast1.firebasedatabase.app"

// Authentication user (Email/Password provider) for this unit. Its uid must be stored at
// /config/writers/<DEVICE_ID>; the firmware prints it and sends it to Telegram if denied.
#define FIREBASE_USER_EMAIL "device@example.com"
#define FIREBASE_USER_PASSWORD "change-me"

// Must match "Device ID" in the app's Settings. Allowed: letters, digits, - and _.
#define DEVICE_ID "esp32_01"
