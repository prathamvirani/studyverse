import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';
import { liveKitAuthority } from '@study/adapters/livekit/server';

function compose(...args: string[]): string {
  return execFileSync('docker', ['compose', '--env-file', '.local/compose.env', ...args], {
    encoding: 'utf8',
    timeout: 15_000,
    windowsHide: true,
  }).trim();
}

it('runs the configured originless healthcheck and observes a healthy API container', () => {
  const id = compose('ps', '--quiet', 'api');
  expect(id).toMatch(/^[a-f0-9]{12,64}$/);
  const health = JSON.parse(
    execFileSync('docker', ['inspect', '--format', '{{json .State.Health}}', id], {
      encoding: 'utf8',
      timeout: 15_000,
      windowsHide: true,
    }),
  ) as { Status: string; Log: { ExitCode: number }[] };
  expect(health.Status).toBe('healthy');
  expect(health.Log.at(-1)?.ExitCode).toBe(0);
  const command = JSON.parse(
    execFileSync('docker', ['inspect', '--format', '{{json .Config.Healthcheck.Test}}', id], {
      encoding: 'utf8',
      timeout: 15_000,
      windowsHide: true,
    }),
  ) as string[];
  expect(command.slice(0, 3)).toEqual(['CMD', 'node', '-e']);
  expect(command[3]).toContain('/api/v1/ready');
  expect(command[3]).not.toMatch(/headers\s*:/);
  // Replay the actual image healthcheck, rather than a different authenticated request.
  expect(compose('exec', '-T', 'api', ...command.slice(1))).toBe('');
});

it('runs the pinned localhost SFU and authenticates signaling through the actual Caddy TLS route', async () => {
  const id = compose('ps', '--quiet', 'livekit');
  const inspect = JSON.parse(
    execFileSync('docker', ['inspect', id], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 15000,
    }),
  )[0];
  expect(inspect.Config.Image).toBe(
    'livekit/livekit-server:v1.13.6@sha256:e37d68f172556d02aa77968b9fc55ef481468c0315fa38e4fa6c56ce72e3a815',
  );
  expect(inspect.State.Health.Status).toBe('healthy');
  for (const bindings of Object.values(inspect.HostConfig.PortBindings) as { HostIp: string }[][])
    for (const binding of bindings) expect(binding.HostIp).toBe('127.0.0.1');
  const local = Object.fromEntries(
    readFileSync('.local/compose.env', 'utf8')
      .trim()
      .split(/\r?\n/)
      .map((line) => line.split('=')),
  );
  const authority = liveKitAuthority({
    url: 'wss://localhost:8443',
    serviceUrl: 'http://127.0.0.1:7880',
    roomPrefix: 'probe-study-',
    apiKey: local.LIVEKIT_API_KEY!,
    apiSecret: local.LIVEKIT_API_SECRET!,
  });
  const roomId = randomUUID(),
    connectionId = randomUUID();
  const c = await authority.issue({
    actor: { subjectId: randomUUID(), sessionId: randomUUID() },
    roomId,
    connectionId,
    sources: [],
    expiresAt: Date.now() + 60000,
  });
  // Only this localhost infrastructure probe relaxes trust for the generated development CA.
  const socket = new WebSocket(
    `${c.url}/rtc?access_token=${encodeURIComponent(c.token)}&protocol=15&sdk=js&version=2.22.3&auto_subscribe=0`,
    { rejectUnauthorized: false },
  );
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Caddy SFU signaling timeout')), 5000);
      socket.once('open', () => {
        clearTimeout(timer);
        resolve();
      });
      socket.once('error', () => {
        clearTimeout(timer);
        reject(new Error('Caddy SFU signaling failed'));
      });
    });
    expect(socket.readyState).toBe(WebSocket.OPEN);
  } finally {
    socket.terminate();
    await authority.remove(roomId, connectionId);
  }
});
