import { beforeAll, expect, it, vi } from 'vitest';
import { generateKeyPair, exportJWK, createLocalJWKSet, SignJWT } from 'jose';
import type { CryptoKey } from 'jose';
import { createOAuthProvider, verifyOidc, pkceChallenge } from '@study/adapters/oauth';
import type { OAuthConfig } from '@study/adapters/oauth';

const config: OAuthConfig = {
  id: 'google',
  clientId: 'test-client',
  clientSecret: 'test-only-secret',
  redirectUri: 'https://localhost:8443/auth/callback/google',
};
const challenge = {
  state: 's'.repeat(43),
  verifier: 'v'.repeat(43),
  nonce: 'n'.repeat(43),
  reauthenticate: false,
};
let key: CryptoKey, keys: ReturnType<typeof createLocalJWKSet>;
beforeAll(async () => {
  const pair = await generateKeyPair('RS256');
  key = pair.privateKey;
  keys = createLocalJWKSet({
    keys: [{ ...(await exportJWK(pair.publicKey)), kid: 'test', alg: 'RS256' }],
  });
});
async function token(
  overrides: Record<string, unknown> = {},
  issuer = 'https://accounts.google.com',
) {
  return new SignJWT({ nonce: challenge.nonce, name: 'Alice', ...overrides })
    .setProtectedHeader({ alg: 'RS256', kid: 'test' })
    .setSubject('provider-subject')
    .setIssuer(issuer)
    .setAudience('test-client')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(key);
}
it.each(['google', 'microsoft', 'discord'] as const)(
  'uses fixed %s endpoints, code flow, S256 PKCE and minimal scopes',
  (id) => {
    const provider = createOAuthProvider({ ...config, id });
    const url = new URL(provider.authorizationUrl(challenge));
    expect(url.protocol).toBe('https:');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('state')).toBe(challenge.state);
    expect(url.searchParams.get('code_challenge')).toBe(pkceChallenge(challenge.verifier));
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.toString()).not.toContain(config.clientSecret);
    expect(url.searchParams.get('scope')).not.toContain('offline_access');
    if (id !== 'discord') expect(url.searchParams.get('nonce')).toBe(challenge.nonce);
  },
);
it('validates a signed OIDC response without returning provider credentials', async () => {
  const signed = await token();
  const fetcher = vi.fn<typeof fetch>(
    async () =>
      new Response(
        JSON.stringify({
          id_token: signed,
          access_token: 'must-stay-on-server',
          refresh_token: 'discard-me',
        }),
      ),
  );
  const provider = createOAuthProvider(config, fetcher, keys);
  const identity = await provider.exchange('one-use-code', challenge, new AbortController().signal);
  expect(identity).toEqual({
    provider: 'google',
    issuer: 'https://accounts.google.com',
    subject: 'provider-subject',
    displayName: 'Alice',
  });
  const request = fetcher.mock.calls[0]![1]!;
  expect(request.redirect).toBe('error');
  expect(String(request.body)).toContain('code_verifier=');
  expect(JSON.stringify(identity)).not.toMatch(/access_token|refresh_token|id_token/);
});
it.each(['nonce', 'issuer', 'audience', 'expiry', 'signature', 'azp', 'missing-nonce'] as const)(
  'rejects invalid OIDC %s',
  async (defect) => {
    let signed: string;
    if (defect === 'audience' || defect === 'expiry')
      signed = await new SignJWT({ nonce: challenge.nonce })
        .setProtectedHeader({ alg: 'RS256', kid: 'test' })
        .setSubject('subject')
        .setIssuer('https://accounts.google.com')
        .setAudience(defect === 'audience' ? 'other-client' : config.clientId)
        .setIssuedAt()
        .setExpirationTime(defect === 'expiry' ? 1 : '5m')
        .sign(key);
    else
      signed = await token(
        defect === 'nonce'
          ? { nonce: 'wrong' }
          : defect === 'missing-nonce'
            ? { nonce: undefined }
            : defect === 'azp'
              ? { azp: 'attacker' }
              : {},
        defect === 'issuer' ? 'https://evil.example' : undefined,
      );
    if (defect === 'signature')
      signed = signed.slice(0, signed.lastIndexOf('.') + 1) + 'a'.repeat(342);
    await expect(verifyOidc(signed, config, challenge.nonce, keys)).rejects.toThrow(
      'Authentication required',
    );
  },
);
it('verifies Microsoft tenant issuer and rejects configured tenant mismatch', async () => {
  const tid = '756668b8-10e5-461d-8809-759e080e1baf';
  const signed = await token({ tid }, `https://login.microsoftonline.com/${tid}/v2.0`);
  expect(
    (await verifyOidc(signed, { ...config, id: 'microsoft' }, challenge.nonce, keys)).issuer,
  ).toContain(tid);
  await expect(
    verifyOidc(
      signed,
      { ...config, id: 'microsoft', microsoftTenant: '123e4567-e89b-42d3-a456-426614174000' },
      challenge.nonce,
      keys,
    ),
  ).rejects.toThrow();
});
it('loads Discord identity only from authenticated users/@me and discards tokens', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: 'provider-access',
          token_type: 'Bearer',
          scope: 'identify',
          refresh_token: 'discard',
        }),
      ),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ id: '123456789', username: 'alice', global_name: 'Alice' })),
    );
  const result = await createOAuthProvider({ ...config, id: 'discord' }, fetcher).exchange(
    'code',
    challenge,
    new AbortController().signal,
  );
  expect(result.subject).toBe('123456789');
  expect(Object.keys(result).sort()).toEqual(['displayName', 'issuer', 'provider', 'subject']);
  expect(fetcher.mock.calls[1]![0]).toBe('https://discord.com/api/v10/users/@me');
});
it('bounds provider responses and rejects failed token exchanges', async () => {
  for (const response of [
    new Response('denied', { status: 400 }),
    new Response('x'.repeat(70_000)),
  ]) {
    const fetcher = vi.fn<typeof fetch>(async () => response);
    await expect(
      createOAuthProvider(config, fetcher, keys).exchange(
        'code',
        challenge,
        new AbortController().signal,
      ),
    ).rejects.toThrow();
  }
});
