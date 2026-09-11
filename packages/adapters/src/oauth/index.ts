import { createHash, timingSafeEqual } from 'node:crypto';
import { createRemoteJWKSet, decodeJwt, jwtVerify } from 'jose';
import type { JWTVerifyGetKey } from 'jose';
import { z } from '@study/contracts';
import type { Provider } from '@study/contracts';
import type { IdentityProvider, OAuthChallenge, ProviderIdentity } from '@study/feature-sdk';
import { AppError } from '@study/core/server';

export interface OAuthConfig {
  readonly id: Provider;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
  readonly microsoftTenant?: string;
}
export function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}
const endpoints = {
  google: {
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    keys: 'https://www.googleapis.com/oauth2/v3/certs',
  },
  microsoft: {
    authorize: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    token: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    keys: 'https://login.microsoftonline.com/common/discovery/v2.0/keys',
  },
  discord: {
    authorize: 'https://discord.com/oauth2/authorize',
    token: 'https://discord.com/api/oauth2/token',
    keys: '',
  },
} as const;
/** Decode is used only to select an allowlisted Microsoft issuer; jwtVerify authenticates it. */
export async function verifyOidc(
  token: string,
  config: OAuthConfig,
  nonce: string,
  keys: JWTVerifyGetKey,
): Promise<ProviderIdentity> {
  try {
    let issuer: string | string[] = ['https://accounts.google.com', 'accounts.google.com'];
    if (config.id === 'microsoft') {
      const tenant = z.uuid().parse(decodeJwt(token).tid);
      if (
        config.microsoftTenant &&
        config.microsoftTenant !== 'common' &&
        config.microsoftTenant !== tenant
      )
        throw new Error('Tenant');
      issuer = `https://login.microsoftonline.com/${tenant}/v2.0`;
    }
    const { payload } = await jwtVerify(token, keys, {
      issuer,
      audience: config.clientId,
      algorithms: ['RS256'],
      requiredClaims: ['sub', 'iss', 'aud', 'exp', 'iat', 'nonce'],
      maxTokenAge: '10 minutes',
      clockTolerance: 5,
    });
    if (
      typeof payload.nonce !== 'string' ||
      Buffer.byteLength(payload.nonce) !== Buffer.byteLength(nonce) ||
      !timingSafeEqual(Buffer.from(payload.nonce), Buffer.from(nonce))
    )
      throw new Error('Nonce');
    if (
      (payload.azp !== undefined && payload.azp !== config.clientId) ||
      (Array.isArray(payload.aud) && payload.aud.length > 1 && payload.azp !== config.clientId)
    )
      throw new Error('Authorized party');
    return {
      provider: config.id,
      issuer: config.id === 'google' ? 'https://accounts.google.com' : payload.iss!,
      subject: z.string().min(1).max(255).parse(payload.sub),
      displayName:
        typeof payload.name === 'string'
          ? payload.name.slice(0, 80).trim() || 'Study member'
          : 'Study member',
    };
  } catch {
    throw new AppError('UNAUTHENTICATED');
  }
}
async function boundedJson(response: Response): Promise<unknown> {
  if (!response.ok || !response.body) throw new AppError('UNAVAILABLE');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 65_536) throw new AppError('UNAVAILABLE');
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } finally {
    await reader.cancel();
  }
}
export function createOAuthProvider(
  config: OAuthConfig,
  fetcher: typeof fetch = fetch,
  suppliedKeys?: JWTVerifyGetKey,
): IdentityProvider {
  const endpoint = endpoints[config.id];
  const tenant = config.microsoftTenant ?? 'common';
  if (tenant !== 'common') z.uuid().parse(tenant);
  const tokenUrl = endpoint.token.replace('/common/', `/${tenant}/`);
  const keys =
    config.id === 'discord'
      ? undefined
      : (suppliedKeys ??
        createRemoteJWKSet(new URL(endpoint.keys), {
          timeoutDuration: 2500,
          cooldownDuration: 30_000,
        }));
  return {
    id: config.id,
    authorizationUrl(challenge: OAuthChallenge) {
      const url = new URL(endpoint.authorize.replace('/common/', `/${tenant}/`));
      url.search = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: 'code',
        response_mode: 'query',
        scope: config.id === 'discord' ? 'identify' : 'openid profile',
        state: challenge.state,
        code_challenge: pkceChallenge(challenge.verifier),
        code_challenge_method: 'S256',
        ...(config.id !== 'discord' ? { nonce: challenge.nonce } : {}),
        ...(challenge.reauthenticate
          ? { prompt: config.id === 'discord' ? 'consent' : 'select_account' }
          : {}),
      }).toString();
      return url.toString();
    },
    async exchange(code, challenge, signal) {
      try {
        const combined = AbortSignal.any([signal, AbortSignal.timeout(3500)]);
        const raw = await boundedJson(
          await fetcher(tokenUrl, {
            method: 'POST',
            redirect: 'error',
            signal: combined,
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              grant_type: 'authorization_code',
              client_id: config.clientId,
              client_secret: config.clientSecret,
              redirect_uri: config.redirectUri,
              code,
              code_verifier: challenge.verifier,
            }),
          }),
        );
        if (config.id !== 'discord') {
          const token = z.object({ id_token: z.string().max(20_000) }).parse(raw).id_token;
          return await verifyOidc(token, config, challenge.nonce, keys!);
        }
        const token = z
          .object({
            access_token: z.string().min(1).max(4096),
            token_type: z.string().refine((v) => v.toLowerCase() === 'bearer'),
            scope: z.string().refine((v) => v.split(' ').includes('identify')),
          })
          .parse(raw);
        const user = z
          .object({
            id: z.string().regex(/^\d{1,30}$/),
            username: z.string().min(1).max(80),
            global_name: z.string().max(80).nullable().optional(),
          })
          .parse(
            await boundedJson(
              await fetcher('https://discord.com/api/v10/users/@me', {
                redirect: 'error',
                signal: combined,
                headers: { authorization: `Bearer ${token.access_token}` },
              }),
            ),
          );
        return {
          provider: config.id,
          issuer: 'https://discord.com',
          subject: user.id,
          displayName: user.global_name?.trim() || user.username,
        };
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError('UNAUTHENTICATED');
      }
    },
  };
}
