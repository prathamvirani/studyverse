import { decodeJwt, SignJWT } from 'jose';
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { liveKitAuthority } from '@study/adapters/livekit/server';
import { syntheticMedia } from './synthetic-media.ts';
import type { Probe } from './livekit-probe.ts';
import type { MediaCredential } from '@study/contracts';
const local = Object.fromEntries(
  readFileSync('.local/compose.env', 'utf8')
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split('=')),
);
const authority = liveKitAuthority({
  roomPrefix: 'probe-study-',
  url: 'wss://localhost:8449',
  serviceUrl: 'http://127.0.0.1:7880',
  apiKey: local.LIVEKIT_API_KEY!,
  apiSecret: local.LIVEKIT_API_SECRET!,
});
test('real SFU enforces signed identity, room, source grants and expired/tampered admission', async ({
  page,
}) => {
  test.setTimeout(120000);
  await syntheticMedia(page);
  await page.goto('/__test/probe');
  await page.waitForFunction(() => !!(window as unknown as { probe: Probe }).probe);
  const roomId = randomUUID(),
    actor = { subjectId: randomUUID(), sessionId: randomUUID() };
  const credential = await authority.issue({
    actor,
    roomId,
    connectionId: randomUUID(),
    expiresAt: Date.now() + 60000,
    sources: ['camera'],
  });
  const connect = (c: MediaCredential) =>
    page.evaluate((c) => (window as unknown as { probe: Probe }).probe.connect(c), c);
  try {
    const joined = await connect({
      ...credential,
      url: credential.url + '?room=study-other&identity=impersonation',
    });
    expect(joined).toEqual({
      connected: true,
      identity: credential.connectionId,
      room: credential.room,
    });
    expect(
      await page.evaluate(() => (window as unknown as { probe: Probe }).probe.publish('camera')),
    ).toMatchObject({ published: true });
    expect(
      await page.evaluate(() =>
        (window as unknown as { probe: Probe }).probe.publish('microphone'),
      ),
    ).toEqual({ published: false });
    expect(
      await page.evaluate(() => (window as unknown as { probe: Probe }).probe.publish('screen')),
    ).toEqual({ published: false });
    const noPublish = await authority.issue({
      actor,
      roomId,
      connectionId: randomUUID(),
      expiresAt: Date.now() + 60000,
      sources: [],
    });
    expect((await connect(noPublish)).connected).toBe(true);
    expect(
      await page.evaluate(() => (window as unknown as { probe: Probe }).probe.publish('camera')),
    ).toEqual({ published: false });
    expect((await connect({ ...credential, token: credential.token + 'tampered' })).connected).toBe(
      false,
    );
    const expired = await authority.issue({
      actor,
      roomId,
      connectionId: randomUUID(),
      expiresAt: Date.now() + 1000,
      sources: [],
    });
    expired.token = await new SignJWT(decodeJwt(expired.token))
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime(Math.floor(Date.now() / 1000) - 120)
      .sign(new TextEncoder().encode(local.LIVEKIT_API_SECRET!));
    expect((await connect(expired)).connected).toBe(false);
  } finally {
    await page.evaluate(() => (window as unknown as { probe: Probe }).probe.disconnect());
    await authority.remove(roomId, credential.connectionId);
  }
});

test('enabled and disabled authorities remove orphaned self-hosted credentials without browser cooperation', async ({
  page,
}) => {
  test.setTimeout(60000);
  for (const roomPrefix of ['test-study-', 'disabled-test-study-']) {
    const orphanAuthority = liveKitAuthority({
      url: 'wss://localhost:8449',
      serviceUrl: 'http://127.0.0.1:7880',
      roomPrefix,
      apiKey: local.LIVEKIT_API_KEY!,
      apiSecret: local.LIVEKIT_API_SECRET!,
    });
    const c = await orphanAuthority.issue({
      actor: { subjectId: randomUUID(), sessionId: randomUUID() },
      roomId: randomUUID(),
      connectionId: randomUUID(),
      sources: [],
      expiresAt: Date.now() + 60000,
    });
    await page.goto('/__test/probe');
    await page.waitForFunction(() => !!(window as unknown as { probe: Probe }).probe);
    await page.evaluate((c) => (window as unknown as { probe: Probe }).probe.connect(c), c);
    await expect
      .poll(
        () => page.evaluate(() => (window as unknown as { probe: Probe }).probe.state().connected),
        { timeout: 7000 },
      )
      .toBe(false);
  }
});
