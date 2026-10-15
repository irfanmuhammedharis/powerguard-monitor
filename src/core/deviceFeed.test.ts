import { feedStore, startFeed, stopFeed } from './deviceFeed';

// With no google-services.json, auth() throws synchronously. That must surface as the
// "auth_failed" feed error (-> "Couldn't connect to the server"), not as a crash.
jest.mock('../services/firebase', () => ({
  ensureAnonymousAuth: jest.fn(async () => {
    throw new Error("No Firebase App '[DEFAULT]' has been created");
  }),
  liveRef: jest.fn(),
  statusRef: jest.fn(),
  connectionRef: jest.fn(),
}));

describe('deviceFeed without a Firebase config', () => {
  afterEach(() => stopFeed());

  it('reports auth_failed instead of throwing', async () => {
    expect(() => startFeed('esp32_01')).not.toThrow();
    await new Promise<void>(resolve => setImmediate(resolve));
    expect(feedStore.get().error).toBe('auth_failed');
    expect(feedStore.get().live).toBeNull();
  });
});
