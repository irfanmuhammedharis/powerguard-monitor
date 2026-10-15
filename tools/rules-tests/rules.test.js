// Contract test between the ESP32 firmware, the RTDB security rules and the auth REST
// flow the firmware uses. Runs against the Firebase Emulator Suite:
//
//   npm run test:rules
//
// It exercises the same HTTP requests the firmware makes (cloud.cpp): sign in with
// email/password, refresh the token, then PUT ...json?print=silent&auth=<idToken>.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const NS = 'demo-powerguard-default-rtdb';
const DB = `http://${process.env.FIREBASE_DATABASE_EMULATOR_HOST || '127.0.0.1:9000'}`;
const AUTH = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099'}`;
const DEVICE = 'esp32_01';

const repoRoot = path.resolve(__dirname, '..', '..');
const coreSrc = path.join(repoRoot, 'fault detection', 'lib', 'powerguard_core', 'src');

function firmwarePayloads() {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pg-payloads-')), 'dump');
  execFileSync('g++', [
    '-std=gnu++17', '-I', coreSrc,
    path.join(__dirname, 'firmware_payloads.cpp'),
    path.join(coreSrc, 'payload.cpp'),
    path.join(coreSrc, 'fault_detector.cpp'),
    '-o', out,
  ]);
  return execFileSync(out, { encoding: 'utf8' })
    .trim()
    .split('\n')
    .map(line => JSON.parse(line));
}

// --- the firmware's REST calls, as plain fetch --------------------------------

async function signUp(email, password) {
  const res = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(email ? { email, password, returnSecureToken: true } : { returnSecureToken: true }),
  });
  assert.equal(res.status, 200, 'signUp');
  return res.json();
}

// Same request body and URL shape as Firebase::signIn() in cloud.cpp.
async function signIn(email, password) {
  const res = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  return { status: res.status, json: await res.json() };
}

// Same as Firebase::put(): PUT <path>.json?print=silent&auth=<idToken>.
async function put(token, p, body) {
  const res = await fetch(`${DB}${p}.json?ns=${NS}&print=silent&auth=${token}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  return res.status;
}

async function get(token, p) {
  const auth = token ? `&auth=${token}` : '';
  const res = await fetch(`${DB}${p}.json?ns=${NS}${auth}`);
  return { status: res.status, json: res.status === 200 ? await res.json() : null };
}

async function adminPut(p, body) {
  const res = await fetch(`${DB}${p}.json?ns=${NS}`, {
    method: 'PUT',
    headers: { Authorization: 'Bearer owner' },
    body: JSON.stringify(body),
  });
  assert.equal(res.status, 200, `admin PUT ${p}`);
}

// --- fixtures -----------------------------------------------------------------

const payloads = firmwarePayloads();
const byName = name => {
  const p = payloads.find(x => x.name === name);
  assert.ok(p, `firmware payload ${name}`);
  return p;
};

let deviceToken;
let deviceUid;
let appToken;
let strangerToken;

test.before(async () => {
  const email = 'device-esp32_01@powerguard.local';
  const password = 'correct horse battery staple';
  await signUp(email, password);

  // This is exactly what the unit does on boot.
  const login = await signIn(email, password);
  assert.equal(login.status, 200);
  assert.ok(login.json.idToken && login.json.refreshToken && login.json.localId, 'sign-in response fields cloud.cpp reads');
  assert.ok(Number(login.json.expiresIn) > 0, 'expiresIn is a numeric string');
  deviceToken = login.json.idToken;
  deviceUid = login.json.localId;

  appToken = (await signUp()).idToken;                          // anonymous app user
  strangerToken = (await signUp('other@example.com', 'x'.repeat(12))).idToken;

  await adminPut(`/config/writers/${DEVICE}`, deviceUid);       // console step 5 in 09-deployment-ops.md
});

// --- tests --------------------------------------------------------------------

test('firmware payloads: the serializer emitted every case', () => {
  assert.ok(payloads.length >= 10);
});

test('sign-in rejects a wrong password with the error shape cloud.cpp logs', async () => {
  const bad = await signIn('device-esp32_01@powerguard.local', 'wrong-password');
  assert.equal(bad.status, 400);
  assert.ok(bad.json.error.message);
});

test('token refresh returns the fields cloud.cpp parses', async () => {
  const login = await signIn('device-esp32_01@powerguard.local', 'correct horse battery staple');
  const res = await fetch(`${AUTH}/securetoken.googleapis.com/v1/token?key=fake`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(login.json.refreshToken)}`,
  });
  assert.equal(res.status, 200);
  const j = await res.json();
  assert.ok(j.id_token && j.refresh_token && j.expires_in, 'id_token, refresh_token, expires_in');
});

for (const name of [
  'live-healthy', 'live-short', 'live-over-current', 'live-open-line',
  'live-smoke', 'live-rain', 'live-warmup',
  'status-server-timestamp', 'status-local-seconds', 'status-no-rssi',
  'history-live-healthy',
]) {
  test(`device user can write firmware payload "${name}" (HTTP 204)`, async () => {
    const p = byName(name);
    assert.equal(await put(deviceToken, p.path, p.body), 204);
  });
}

test('history ring-buffer slot is stored under its 4-digit key and queryable by ts', async () => {
  const p = byName('history-live-healthy');
  assert.match(p.path, /\/history\/\d{4}$/);
  const res = await fetch(
    `${DB}/devices/${DEVICE}/history.json?ns=${NS}&auth=${appToken}&orderBy=%22ts%22&startAt=1759999000`,
  );
  assert.equal(res.status, 200);
  const rows = await res.json();
  assert.equal(Object.keys(rows).length, 1);
});

test('server-timestamp last_seen is stored as a millisecond number', async () => {
  await put(deviceToken, byName('status-server-timestamp').path, byName('status-server-timestamp').body);
  const { json } = await get(appToken, `/devices/${DEVICE}/status`);
  assert.equal(typeof json.last_seen, 'number');
  assert.ok(json.last_seen > 1e12, 'milliseconds; the app normalizes with toSeconds()');
  assert.ok(Math.abs(json.last_seen - Date.now()) < 60_000);
});

test('the app (anonymous user) can read the data the firmware wrote', async () => {
  const live = await get(appToken, `/devices/${DEVICE}/live`);
  assert.equal(live.status, 200);
  assert.equal(live.json.fault_type, 'none');
});

test('the app cannot write anywhere under /devices', async () => {
  const p = byName('live-healthy');
  assert.equal(await put(appToken, p.path, p.body), 401);
  assert.equal(await put(appToken, `/devices/${DEVICE}/status`, { last_seen: 1 }), 401);
  assert.equal(await put(appToken, `/devices/${DEVICE}/history/0000`, p.body), 401);
});

test('a different authenticated user (not the whitelisted uid) cannot write', async () => {
  const p = byName('live-healthy');
  assert.equal(await put(strangerToken, p.path, p.body), 401);
});

test('the device user cannot write to another device id', async () => {
  const p = byName('live-healthy');
  assert.equal(await put(deviceToken, '/devices/esp32_02/live', p.body), 401);
});

test('unauthenticated clients can neither read nor write', async () => {
  assert.equal((await get(null, `/devices/${DEVICE}/live`)).status, 401);
  assert.equal(await put('', byName('live-healthy').path, byName('live-healthy').body), 401);
});

test('/config is not readable by the app or the device', async () => {
  assert.equal((await get(appToken, '/config/writers')).status, 401);
  assert.equal((await get(deviceToken, `/config/writers/${DEVICE}`)).status, 401);
  assert.equal(await put(deviceToken, `/config/writers/${DEVICE}`, JSON.stringify('x')), 401);
});

// RTDB reports a failed .validate as 401 "Permission denied", the same code as a refused
// write, so each rejection test first proves the same token/path accepts a good payload.
test('rules reject malformed live payloads even from the device user', async () => {
  const good = byName('live-healthy').body;
  const livePath = byName('live-healthy').path;
  assert.equal(await put(deviceToken, livePath, good), 204, 'baseline: valid payload is accepted');
  const cases = {
    'unknown extra field': { ...good, extra: 1 },
    'line_fault as string': { ...good, line_fault: 'true' },
    'voltage as string': { ...good, voltage: '230' },
    'missing ts': (({ ts, ...rest }) => rest)(good),
    'negative smoke_ppm': { ...good, smoke_ppm: -1 },
    'fault_type too long': { ...good, fault_type: 'x'.repeat(33) },
  };
  for (const [label, body] of Object.entries(cases)) {
    assert.equal(await put(deviceToken, livePath, body), 401, label);
  }
});

test('rules reject a history sample without voltage/current/ts', async () => {
  const good = byName('history-live-healthy').body;
  assert.equal(await put(deviceToken, `/devices/${DEVICE}/history/0001`, good), 204, 'baseline');
  assert.equal(await put(deviceToken, `/devices/${DEVICE}/history/0001`, { voltage: 230 }), 401);
});

test('rules reject an invalid device id', async () => {
  const p = byName('live-healthy');
  assert.equal(await put(deviceToken, '/devices/bad%20id/live', p.body), 401);
});
