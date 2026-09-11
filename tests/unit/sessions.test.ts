import { describe, expect, it } from 'vitest';
import { Sessions, verifyRequestBoundary } from '@study/core/server';
import { sql } from '@study/adapters/postgres';
import { MemorySessions } from '../fixtures/memory.ts';

const subject = '266ec203-39d0-4b04-aa5b-148b31521f4d';
describe('server-owned sessions', () => {
  it('stores only a digest of the cookie credential and enforces cookie attributes', async () => {
    const store = new MemorySessions(),
      sessions = new Sessions(store),
      issued = await sessions.issue(subject);
    expect(issued.token).toHaveLength(43);
    expect(JSON.stringify([...store.rows.values()])).not.toContain(issued.token);
    expect(sessions.cookie(issued)).toMatch(/^__Host-study-session=/);
    for (const attribute of ['Secure', 'HttpOnly', 'SameSite=Lax', 'Path=/'])
      expect(sessions.cookie(issued)).toContain(attribute);
    expect(sessions.cookie(issued)).not.toContain('Domain=');
    expect(sessions.clearCookie()).toContain('Max-Age=0');
  });
  it('denies absent, forged, expired and revoked sessions', async () => {
    let now = 1_000;
    const sessions = new Sessions(new MemorySessions(), undefined, () => now, 1000, 500);
    for (const token of [undefined, 'fake', 'a'.repeat(43)])
      await expect(sessions.authenticate(token)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    const issued = await sessions.issue(subject);
    await sessions.revoke(issued.session.id);
    await expect(sessions.authenticate(issued.token)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
    const expiring = await sessions.issue(subject);
    now += 501;
    await expect(sessions.authenticate(expiring.token)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
  });
  it('rotates atomically, rejects old credentials and CSRF, and revokes all subject sessions', async () => {
    const sessions = new Sessions(new MemorySessions()),
      issued = await sessions.issue(subject);
    const outcomes = await Promise.allSettled([
      sessions.rotate(issued.token),
      sessions.rotate(issued.token),
    ]);
    expect(outcomes.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const success = outcomes.find((result) => result.status === 'fulfilled');
    if (success?.status !== 'fulfilled') throw new Error('Rotation failed');
    await expect(sessions.authenticate(issued.token)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
    expect(() => sessions.verifyCsrf(success.value.session, issued.session.csrfToken)).toThrow();
    const another = await sessions.issue(subject);
    await sessions.revokeSubject(subject);
    await expect(sessions.authenticate(another.token)).rejects.toThrow();
    await expect(sessions.authenticate(success.value.token)).rejects.toThrow();
  });
  it('binds CSRF to session and rejects malformed values', async () => {
    const sessions = new Sessions(new MemorySessions()),
      a = await sessions.issue(subject),
      b = await sessions.issue(subject);
    sessions.verifyCsrf(a.session, a.session.csrfToken);
    for (const invalid of [undefined, '', 'x', b.session.csrfToken, a.token])
      expect(() => sessions.verifyCsrf(a.session, invalid)).toThrow();
  });
});
it('checks exact origin and host, requiring Origin for mutations', () => {
  const headers = {
    host: 'localhost:8443',
    origin: 'https://localhost:8443',
    fetchSite: 'same-origin',
  };
  verifyRequestBoundary(headers, headers.origin, true);
  for (const change of [
    { origin: undefined },
    { origin: 'https://localhost:8443.evil.test' },
    { host: 'evil.test' },
    { fetchSite: 'cross-site' },
  ])
    expect(() => verifyRequestBoundary({ ...headers, ...change }, headers.origin, true)).toThrow();
});
it('parameterizes SQL injection strings as data', () => {
  const hostile = "'; DROP TABLE core.sessions; --",
    query = sql`SELECT ${hostile}::text AS value`;
  expect(query.text).toBe('SELECT $1::text AS value');
  expect(query.values).toEqual([hostile]);
});
