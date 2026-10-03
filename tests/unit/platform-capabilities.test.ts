import { describe, expect, it } from 'vitest';
import { platformCapabilities } from '../../apps/web/app/lib/platform-capabilities.ts';
describe('passive platform capability discovery', () => {
  it('is SSR-safe and separates system management from native integration', () => {
    const capabilities = platformCapabilities();
    expect(capabilities.filter((item) => item.status === 'Supported')).toEqual([]);
    expect(capabilities.find((item) => item.key === 'video.systemEffects')?.status).toBe(
      'System-managed',
    );
    expect(capabilities.find((item) => item.key === 'system.liveActivities')?.status).toBe(
      'Requires native',
    );
  });
  it('checks actual API presence and secure context without invoking any API', () => {
    const invoked = () => {
      throw new Error('No capability probe may invoke this API');
    };
    const browser = {
      isSecureContext: true,
      PublicKeyCredential: invoked,
      PushManager: invoked,
      navigator: {
        credentials: { get: invoked },
        share: invoked,
        setAppBadge: invoked,
        serviceWorker: {},
        mediaSession: {},
        wakeLock: { request: invoked },
      },
      document: { pictureInPictureEnabled: false },
      documentPictureInPicture: { requestWindow: invoked },
    } as unknown as Parameters<typeof platformCapabilities>[0];
    expect(platformCapabilities(browser).find((item) => item.key === 'auth.passkeys')?.status).toBe(
      'Supported',
    );
    expect(
      platformCapabilities(browser).find((item) => item.key === 'video.pictureInPicture')?.status,
    ).toBe('Unavailable');
    expect(
      platformCapabilities({ ...browser!, isSecureContext: false }).find(
        (item) => item.key === 'auth.passkeys',
      )?.status,
    ).toBe('Unavailable');
  });
});
