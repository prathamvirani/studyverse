import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';

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
