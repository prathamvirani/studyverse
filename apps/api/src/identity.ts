import { createOAuthProvider } from '@study/adapters/oauth';
import { PostgresSessionDirectory } from '@study/adapters/postgres';
import { identityModule, identityAccounts } from '@study/identity/server';
import { roomsModule } from '@study/rooms/server';
import { fail, featureEnabled } from './module-support.ts';
import type { Database } from '@study/feature-sdk';
import type { SocialDirectory } from '@study/feature-sdk';

export function identityModules(
  db: Database,
  environment: Record<string, string | undefined>,
  origin: string,
  social?: SocialDirectory,
) {
  const enabled = featureEnabled(environment, 'IDENTITY_ROOMS_ENABLED');
  const providers = (['google', 'microsoft', 'discord'] as const).flatMap((id) => {
    if (id === 'microsoft' && environment.OAUTH_MICROSOFT_ENABLED !== 'true') return [];
    const prefix = `OAUTH_${id.toUpperCase()}`;
    const clientId = environment[`${prefix}_CLIENT_ID`],
      clientSecret = environment[`${prefix}_CLIENT_SECRET`];
    if (!clientId && !clientSecret) return [];
    if (!clientId || !clientSecret) throw new Error(`Both ${prefix} credentials are required`);
    return [
      createOAuthProvider({
        id,
        clientId,
        clientSecret,
        redirectUri: `${origin}/auth/callback/${id}`,
        ...(id === 'microsoft'
          ? { microsoftTenant: environment.OAUTH_MICROSOFT_TENANT ?? 'common' }
          : {}),
      }),
    ];
  });
  return [
    identityModule({ db, directory: new PostgresSessionDirectory(db), providers, fail, enabled }),
    roomsModule({
      db,
      accountExists: identityAccounts(db).exists,
      fail,
      enabled,
      ...(social ? { social } : {}),
      socialEnabled: featureEnabled(environment, 'SOCIAL_ENABLED'),
    }),
  ];
}
