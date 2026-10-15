module.exports = {
  preset: 'react-native',
  testMatch: ['**/?(*.)+(test).[jt]s?(x)'],
  // tools/rules-tests runs under `node --test` against the Firebase emulator
  // (npm run test:rules); the firmware has its own PlatformIO tests.
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/tools/', '/fault detection/'],
  clearMocks: true,
};
