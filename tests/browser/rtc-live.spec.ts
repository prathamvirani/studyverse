import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { syntheticMedia } from './synthetic-media.ts';
import { removeTestMembership } from './rtc-backend.ts';
import type { MediaCredential } from '@study/contracts';
import type { Probe } from './livekit-probe.ts';

async function api(page: Page, path: string, input?: unknown) {
  return page.evaluate(
    async ({ path, input }) => {
      const csrf = await fetch('/api/v1/session/csrf').then((r) => r.json());
      const r = await fetch(
        `/api/v1/${path}`,
        input === undefined
          ? {}
          : {
              method: 'POST',
              headers: {
                'content-type': 'application/json',
                'x-csrf-token': csrf.csrfToken,
                'x-study-auth': '1',
              },
              body: JSON.stringify(input),
            },
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    { path, input },
  );
}
async function login(page: Page, provider: string) {
  await syntheticMedia(page);
  await page.addInitScript(() => {
    const peers: RTCPeerConnection[] = [];
    (window as unknown as { rtcPeers: RTCPeerConnection[] }).rtcPeers = peers;
    window.RTCPeerConnection = new Proxy(window.RTCPeerConnection, {
      construct(target, args) {
        const pc = new target(...args);
        peers.push(pc);
        return pc;
      },
    });
  });
  await page.addInitScript(() => {
    navigator.mediaDevices.getDisplayMedia = async () =>
      navigator.mediaDevices.getUserMedia({ video: true });
  });
  await page.goto('/');
  await page.getByRole('button', { name: `Continue with ${provider}` }).click();
  await expect(page).toHaveURL('/account');
}
test('real LiveKit forwards two authenticated publishers, moves camera renderer, shares screen and revokes access', async ({
  browser,
}) => {
  test.setTimeout(120000);
  const a = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 },
  });
  const b = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 },
  });
  const alice = await a.newPage(),
    bob = await b.newPage();
  let lastCredential: MediaCredential | undefined;
  alice.on('response', async (response) => {
    if (response.url().endsWith('/api/v1/rtc/join') && response.ok())
      lastCredential = await response.json();
  });
  let dropSignal: (() => void) | undefined;
  await alice.routeWebSocket(/\/rtc(?:\/|$)/, (ws) => {
    const upstream = ws.connectToServer();
    dropSignal = () => {
      upstream.close({ code: 1012, reason: 'Test signaling restart' });
      ws.close({ code: 1012, reason: 'Test signaling restart' });
    };
  });
  try {
    await login(alice, 'Google');
    await login(bob, 'Discord');
    await api(alice, 'account/profile', { displayName: 'Alex · real SFU' });
    await api(bob, 'account/profile', { displayName: 'Sam · real SFU' });
    const userA = await api(alice, 'account/me'),
      userB = await api(bob, 'account/me');
    const room = await api(alice, 'rooms/create', {
      name: 'Basic RTC · local LiveKit',
      privacy: 'public',
    });
    await alice.goto(`/rooms/${room.id}`);
    await bob.goto(`/rooms/${room.id}`);
    await alice.getByRole('button', { name: 'Enter room', exact: true }).click();
    await bob.getByRole('button', { name: 'Join room', exact: true }).click();
    await expect(alice.locator('video,audio')).toHaveCount(0);
    await alice.screenshot({ path: '.local/validation/phase06-live-off.png' });
    await alice.getByRole('button', { name: 'Camera off', exact: true }).click();
    await expect(alice.getByRole('button', { name: 'Camera on', exact: true })).toBeVisible({
      timeout: 20000,
    });
    const remote = bob.locator(`[data-camera-renderer="${userA.id}"]`);
    await expect(remote).toHaveCount(1, { timeout: 20000 });
    await expect
      .poll(() => remote.evaluate((v: HTMLVideoElement) => v.videoWidth), { timeout: 20000 })
      .toBeGreaterThan(0);
    await expect(bob.locator(`#participant-${userA.id} video`)).toHaveCount(1);
    expect(await remote.evaluate((v: HTMLVideoElement) => v.videoHeight)).toBeLessThanOrEqual(480);
    await remote.evaluate((v) => {
      (window as unknown as { originalCamera: Element }).originalCamera = v;
    });
    await bob.screenshot({ path: '.local/validation/phase06-live-circle.png' });
    await alice.getByRole('button', { name: 'More', exact: true }).click();
    await expect(alice.getByText('Media: connected', { exact: true })).toBeVisible();
    expect(dropSignal).toBeDefined();
    await alice.evaluate(() => {
      const observer = new MutationObserver(() => {
        if (document.body.textContent?.includes('Media: reconnecting')) {
          (window as unknown as { sawReconnect: boolean }).sawReconnect = true;
          observer.disconnect();
        }
      });
      observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    });
    dropSignal!();
    await expect
      .poll(() =>
        alice.evaluate(() => (window as unknown as { sawReconnect: boolean }).sawReconnect),
      )
      .toBe(true);
    await expect(alice.getByText('Media: connected', { exact: true })).toBeVisible({
      timeout: 20000,
    });
    await alice.keyboard.press('Escape');
    await expect(alice.getByRole('button', { name: 'Camera on', exact: true })).toBeVisible();
    const before = await remote.evaluate(
      (v: HTMLVideoElement) => v.getVideoPlaybackQuality().totalVideoFrames,
    );
    await expect
      .poll(() =>
        remote.evaluate((v: HTMLVideoElement) => v.getVideoPlaybackQuality().totalVideoFrames),
      )
      .toBeGreaterThan(before);
    await bob.locator(`#participant-${userA.id}`).click();
    await bob.getByRole('button', { name: 'Expand camera', exact: true }).click();
    await bob.keyboard.press('Escape');
    await expect(bob.locator('.workspace-tile video')).toHaveCount(1);
    await expect(remote).toHaveCount(1);
    expect(
      await remote.evaluate(
        (v) => v === (window as unknown as { originalCamera: Element }).originalCamera,
      ),
    ).toBe(true);
    await bob.screenshot({ path: '.local/validation/phase06-live-expanded.png' });
    await bob.getByRole('button', { name: 'Close tile', exact: true }).click();
    await expect(bob.locator(`#participant-${userA.id} video`)).toHaveCount(1);
    await bob.getByRole('button', { name: 'Camera off', exact: true }).click();
    await expect(alice.locator(`[data-camera-renderer="${userB.id}"]`)).toHaveCount(1, {
      timeout: 15000,
    });
    await alice.getByRole('button', { name: 'Microphone off', exact: true }).click();
    await expect(bob.locator('audio')).toHaveCount(1, { timeout: 15000 });
    await expect
      .poll(() =>
        bob.evaluate(async () => {
          let bytes = 0;
          for (const pc of (window as unknown as { rtcPeers: RTCPeerConnection[] }).rtcPeers) {
            const stats = await pc.getStats();
            stats.forEach((s) => {
              if (s.type === 'inbound-rtp' && s.kind === 'audio') bytes += s.bytesReceived ?? 0;
            });
          }
          return bytes;
        }),
      )
      .toBeGreaterThan(0);
    await expect(bob.locator(`#participant-${userA.id}`).locator('..')).toContainText('Mic on');
    await alice.screenshot({ path: '.local/validation/phase06-live-mic.png' });
    await alice.getByRole('button', { name: 'More', exact: true }).click();
    await alice.getByRole('button', { name: 'Mute microphone', exact: true }).click();
    await expect(bob.locator(`#participant-${userA.id}`).locator('..')).toContainText('Mic off');
    await alice.getByRole('button', { name: 'Unmute microphone', exact: true }).click();
    await expect(bob.locator(`#participant-${userA.id}`).locator('..')).toContainText('Mic on');
    await alice.keyboard.press('Escape');
    await alice.getByRole('button', { name: 'Screen Share off', exact: true }).click();
    await expect(bob.locator('.workspace-tile video[aria-label="Screen share"]')).toHaveCount(1, {
      timeout: 15000,
    });
    await expect
      .poll(() =>
        bob.locator('.workspace-tile video').evaluate((v: HTMLVideoElement) => v.videoWidth),
      )
      .toBeGreaterThan(0);
    for (const [name, width, height] of [
      ['desktop', 1440, 900],
      ['tablet', 768, 1024],
      ['mobile', 390, 844],
    ] as const) {
      await bob.setViewportSize({ width, height });
      if (width < 760) await bob.getByRole('button', { name: 'Hide panels' }).click();
      await bob.screenshot({ path: `.local/validation/phase06-live-screen-${name}.png` });
    }
    await alice.getByRole('button', { name: 'Screen Share on', exact: true }).click();
    await expect(bob.locator('.workspace-tile video')).toHaveCount(0);
    await alice.getByRole('button', { name: 'Microphone on', exact: true }).click();
    await expect(bob.locator('audio')).toHaveCount(0);
    // Full reload requires deliberate room entry and never restores local capture.
    await alice.reload();
    await alice.getByRole('button', { name: 'Enter room', exact: true }).click();
    await expect(alice.getByRole('button', { name: 'Camera off', exact: true })).toBeVisible();
    await alice.getByRole('button', { name: 'Camera off', exact: true }).click();
    await expect(remote).toHaveCount(1, { timeout: 15000 });
    await removeTestMembership(room.id, userB.id);
    await expect(alice.locator(`[data-camera-renderer="${userB.id}"]`)).toHaveCount(0, {
      timeout: 15000,
    });
    await expect(bob.getByRole('button', { name: 'Camera off', exact: true })).toBeVisible({
      timeout: 15000,
    });
    await expect(api(bob, 'rtc/join', { roomId: room.id })).rejects.toThrow('HTTP 403');
    await bob.reload();
    await bob.getByRole('button', { name: 'Join room', exact: true }).click();
    await expect(remote).toHaveCount(1, { timeout: 15000 });
    // Normal account logout revokes the active application session; the server removes SFU identity.
    await api(alice, 'account/logout', {});
    await expect(remote).toHaveCount(0, { timeout: 15000 });
    await expect(alice.getByRole('button', { name: 'Camera off', exact: true })).toBeVisible({
      timeout: 15000,
    });
    await expect(api(alice, 'rtc/join', { roomId: room.id })).rejects.toThrow('HTTP 401');
    // Self-hosted removal does not cryptographically revoke cached credentials.
    // The retired identity sweep must remove a replay even without a cooperating product client.
    const replay = await a.newPage();
    await replay.goto('/__test/probe');
    await replay.waitForFunction(() => !!(window as unknown as { probe: Probe }).probe);
    expect(lastCredential).toBeDefined();
    await replay.evaluate(
      (c) => (window as unknown as { probe: Probe }).probe.connect(c),
      lastCredential!,
    );
    await expect
      .poll(
        () =>
          replay.evaluate(() => (window as unknown as { probe: Probe }).probe.state().connected),
        { timeout: 7000 },
      )
      .toBe(false);
  } finally {
    await a.close();
    await b.close();
  }
});

test('two tabs for the same account own distinct live camera publications and independent cleanup', async ({
  browser,
}) => {
  test.setTimeout(60000);
  const a = await browser.newContext({ ignoreHTTPSErrors: true }),
    b = await browser.newContext({ ignoreHTTPSErrors: true });
  const first = await a.newPage(),
    viewer = await b.newPage();
  try {
    await login(first, 'Google');
    await login(viewer, 'Discord');
    const user = await api(first, 'account/me');
    const room = await api(first, 'rooms/create', {
      name: 'Independent device publishers',
      privacy: 'public',
    });
    const second = await a.newPage();
    await syntheticMedia(second);
    for (const page of [first, second, viewer]) {
      await page.goto(`/rooms/${room.id}`);
      await page
        .getByRole('button', { name: page === viewer ? 'Join room' : 'Enter room', exact: true })
        .click();
    }
    await first.getByRole('button', { name: 'Camera off', exact: true }).click();
    await second.getByRole('button', { name: 'Camera off', exact: true }).click();
    await expect
      .poll(
        async () =>
          (await api(viewer, 'rtc/audience', { roomId: room.id })).filter(
            (p: { userId: string }) => p.userId === user.id,
          ).length,
      )
      .toBe(2);
    await expect(viewer.locator(`[data-camera-renderer="${user.id}"]`)).toHaveCount(1);
    await viewer.locator(`#participant-${user.id}`).click();
    await expect(
      viewer.getByRole('button', { name: 'Expand camera · device 2', exact: true }),
    ).toBeVisible();
    await viewer.keyboard.press('Escape');
    await second.close();
    await expect
      .poll(
        async () =>
          (await api(viewer, 'rtc/audience', { roomId: room.id })).filter(
            (p: { userId: string }) => p.userId === user.id,
          ).length,
      )
      .toBe(1);
    await expect(first.getByRole('button', { name: 'Camera on', exact: true })).toBeVisible();
    await expect(viewer.locator(`[data-camera-renderer="${user.id}"]`)).toHaveCount(1);
    await first.getByRole('button', { name: 'Camera on', exact: true }).click();
    await expect(viewer.locator('video')).toHaveCount(0);
  } finally {
    await a.close();
    await b.close();
  }
});

test('real SFU removes blocked room media and rejects readmission', async ({ browser }) => {
  test.setTimeout(60000);
  const a = await browser.newContext({ ignoreHTTPSErrors: true }),
    b = await browser.newContext({ ignoreHTTPSErrors: true });
  const alice = await a.newPage(),
    bob = await b.newPage();
  try {
    await login(alice, 'Google');
    await login(bob, 'Discord');
    const userA = await api(alice, 'account/me'),
      userB = await api(bob, 'account/me');
    const room = await api(alice, 'rooms/create', { name: 'RTC block policy', privacy: 'public' });
    await alice.goto(`/rooms/${room.id}`);
    await bob.goto(`/rooms/${room.id}`);
    await alice.getByRole('button', { name: 'Enter room', exact: true }).click();
    await bob.getByRole('button', { name: 'Join room', exact: true }).click();
    await bob.getByRole('button', { name: 'Camera off', exact: true }).click();
    await expect(alice.locator(`[data-camera-renderer="${userB.id}"]`)).toHaveCount(1, {
      timeout: 15000,
    });
    await api(alice, 'friends/block', { targetId: userB.id });
    await expect(alice.locator(`[data-camera-renderer="${userB.id}"]`)).toHaveCount(0, {
      timeout: 10000,
    });
    await expect(bob.getByRole('button', { name: 'Camera off', exact: true })).toBeVisible({
      timeout: 10000,
    });
    await expect(api(bob, 'rtc/join', { roomId: room.id })).rejects.toThrow('HTTP 403');
    await expect(api(bob, 'rtc/audience', { roomId: room.id })).rejects.toThrow('HTTP 403');
    expect(userA.id).not.toBe(userB.id);
  } finally {
    await a.close();
    await b.close();
  }
});
