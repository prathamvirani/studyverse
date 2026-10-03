import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  emptySchema,
  usernameInputSchema,
  usernameAvailabilitySchema,
  usernameProblem,
  normalizeUsername,
  onboardingSchema,
  onboardingStepSchema,
  safeReturnTo,
  oauthFinishResultSchema,
  renameSessionSchema,
  unlinkProviderSchema,
  deleteAccountSchema,
  deletionStatusSchema,
  accountDeletedSchema,
  profileSchema,
  profileUpdateSchema,
  okSchema,
  providersSchema,
  identityListSchema,
  oauthStartSchema,
  oauthStartResultSchema,
  oauthFinishSchema,
  sessionsSchema,
  revokeSessionSchema,
  z,
} from '@study/contracts';
import type { Provider } from '@study/contracts';
import { defineOperation, sql } from '@study/feature-sdk';
import type {
  Actor,
  Database,
  Fail,
  FeatureModule,
  IdentityProvider,
  OperationContext,
  ProviderIdentity,
  SessionDirectory,
  LifecycleContext,
} from '@study/feature-sdk';

export const identityDefinition = {
  id: 'identity',
  version: '1.0.0',
  required: true,
  persistence: { durableSchema: 'identity' },
} as const;
export interface IdentityDependencies {
  readonly referrals?: import('@study/feature-sdk').ReferralAttribution;
  readonly db: Database;
  readonly directory: SessionDirectory;
  readonly providers: readonly IdentityProvider[];
  readonly fail: Fail;
  readonly enabled?: boolean;
}
export function identityAccounts(db: Database) {
  return {
    search: async (query: string) => {
      const text = query.toLowerCase().replace(/^@/, '');
      const rows = await db.query(
        sql`SELECT id,display_name,username FROM identity.users WHERE username IS NOT NULL AND (position(${text} in lower(username))>0 OR position(${text} in lower(display_name))>0) ORDER BY username LIMIT 100`,
      );
      return rows.map((row) => ({
        id: String(row.id),
        name: String(row.display_name),
        username: String(row.username),
      }));
    },
    person: async (id: string) => {
      const [row] = await db.query(
        sql`SELECT id,display_name,username FROM identity.users WHERE id=${id}`,
      );
      return row
        ? {
            id: String(row.id),
            name: String(row.display_name),
            ...(row.username ? { username: String(row.username) } : {}),
          }
        : null;
    },
    byUsername: async (username: string, tx?: Database) => {
      const [row] = await (tx ?? db).query(
        tx
          ? sql`SELECT id,display_name,username FROM identity.users WHERE username=${username.toLowerCase()} FOR SHARE`
          : sql`SELECT id,display_name,username FROM identity.users WHERE username=${username.toLowerCase()}`,
      );
      return row
        ? { id: String(row.id), name: String(row.display_name), username: String(row.username) }
        : null;
    },
    exists: async (id: string): Promise<boolean> =>
      (await db.query(sql`SELECT id FROM identity.users WHERE id = ${id}`)).length === 1,
  };
}
const secret = () => randomBytes(32).toString('base64url');
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export function identityModule(deps: IdentityDependencies): FeatureModule {
  const { db, directory, fail } = deps;
  let lifecycle: LifecycleContext | undefined;
  const authenticated = {
    id: 'identity.authenticated',
    schema: z.strictObject({ userId: z.uuid() }),
  };
  const rate = { limit: 120, windowMs: 60_000 };
  const authRate = { limit: 20, windowMs: 60_000 };
  const actor = (context: OperationContext): Actor => context.actor ?? fail('UNAUTHENTICATED');
  const self = {
    permission: 'identity.self',
    resource: async (_: unknown, context: OperationContext) => ({ id: actor(context).subjectId }),
  };
  const profile = async (id: string) => {
    const [row] = await db.query(
      sql`SELECT id, display_name, created_at, username, onboarding, onboarding_return_to FROM identity.users WHERE id = ${id}`,
    );
    if (!row) return fail('UNAUTHENTICATED');
    return {
      id: String(row.id),
      username: row.username === null ? null : String(row.username),
      onboarding: onboardingSchema.parse(row.onboarding),
      onboardingReturnTo: safeReturnTo(row.onboarding_return_to),
      displayName: String(row.display_name),
      createdAt: (row.created_at as Date).toISOString(),
    };
  };
  const resolveIdentity = async (
    database: Database,
    verified: ProviderIdentity,
    target?: string,
    referralId?: string,
  ): Promise<string> => {
    // Serialize identity creation/linking, including concurrent callbacks for the same provider subject.
    await database.query(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify([verified.provider, verified.issuer, verified.subject])}, 0))`,
    );
    const [existing] = await database.query(
      sql`SELECT user_id FROM identity.identities WHERE provider = ${verified.provider} AND issuer = ${verified.issuer} AND subject = ${verified.subject}`,
    );
    if (existing) {
      if (target && existing.user_id !== target) return fail('CONFLICT');
      return String(existing.user_id);
    }
    const id = target ?? randomUUID();
    if (target) {
      if (
        (
          await database.query(
            sql`SELECT user_id FROM identity.identities WHERE user_id = ${target} AND provider = ${verified.provider}`,
          )
        ).length
      )
        return fail('CONFLICT');
    } else
      await database.query(
        sql`INSERT INTO identity.users (id, display_name) VALUES (${id}, ${verified.displayName})`,
      );
    await database.query(
      sql`INSERT INTO identity.identities (provider, issuer, subject, user_id) VALUES (${verified.provider}, ${verified.issuer}, ${verified.subject}, ${id})`,
    );
    if (!target && referralId) await deps.referrals?.signup(referralId, id, database);
    return id;
  };
  const deleted = { id: 'identity.deleted', schema: accountDeletedSchema };
  const operations = [
    defineOperation({
      id: 'identity.deletion-status',
      kind: 'query',
      input: emptySchema,
      output: deletionStatusSchema,
      access: self,
      rate,
      handle: async (_, c) => ({
        ready:
          (
            await db.query(
              sql`SELECT session_id FROM identity.deletion_proofs WHERE session_id=${actor(c).sessionId} AND user_id=${actor(c).subjectId} AND expires_at>CURRENT_TIMESTAMP`,
            )
          ).length === 1,
      }),
    }),
    defineOperation({
      id: 'identity.username-available',
      kind: 'query',
      input: usernameInputSchema,
      output: usernameAvailabilitySchema,
      access: self,
      rate: { limit: 60, windowMs: 60_000 },
      handle: async (i, c) => ({
        available:
          !usernameProblem(i.username) &&
          !(
            await db.query(
              sql`SELECT id FROM identity.users WHERE username=${normalizeUsername(i.username)} AND id<>${actor(c).subjectId}`,
            )
          ).length,
      }),
    }),
    defineOperation({
      id: 'identity.username',
      kind: 'command',
      input: usernameInputSchema,
      output: profileSchema,
      access: self,
      rate: { limit: 10, windowMs: 60_000 },
      handle: async (i, c) => {
        const username = normalizeUsername(i.username);
        if (usernameProblem(username)) return fail('INVALID_REQUEST');
        await directory.withSession(actor(c), async (tx) => {
          const [user] = await tx.query(
            sql`SELECT username, username_changed_at FROM identity.users WHERE id=${actor(c).subjectId} FOR UPDATE`,
          );
          if (!user) return fail('UNAUTHENTICATED');
          if (user.username === username) return;
          if (
            user.username_changed_at &&
            Date.now() - (user.username_changed_at as Date).getTime() < 7 * 86400_000
          )
            return fail('RATE_LIMITED');
          await tx.query(sql`SELECT pg_advisory_xact_lock(hashtextextended(${username}, 1))`);
          if (
            (await tx.query(sql`SELECT id FROM identity.users WHERE username=${username}`)).length
          )
            return fail('CONFLICT');
          await tx.query(
            sql`UPDATE identity.users SET username=${username}, username_changed_at=CURRENT_TIMESTAMP, onboarding=jsonb_set(onboarding, '{identity}', 'true') WHERE id=${actor(c).subjectId}`,
          );
          await tx.query(
            sql`UPDATE identity.users SET onboarding_return_to='/home' WHERE id=${actor(c).subjectId} AND onboarding->>'identity'='true' AND onboarding->>'appearance'='true' AND onboarding->>'layout'='true'`,
          );
        });
        return profile(actor(c).subjectId);
      },
    }),
    defineOperation({
      id: 'identity.onboarding',
      kind: 'command',
      input: onboardingStepSchema,
      output: profileSchema,
      access: self,
      rate,
      handle: async (i, c) => {
        await directory.withSession(actor(c), async (tx) => {
          const [row] = await tx.query(
            sql`SELECT onboarding FROM identity.users WHERE id=${actor(c).subjectId} FOR UPDATE`,
          );
          if (!row) return fail('UNAUTHENTICATED');
          const progress = onboardingSchema.parse(row.onboarding);
          if (!progress.identity || (i.step === 'layout' && !progress.appearance))
            return fail('CONFLICT');
          // Merge individual milestones; future versions must not reset prior completion.
          await tx.query(
            sql`UPDATE identity.users SET onboarding=onboarding || ${JSON.stringify({ [i.step]: true })}::jsonb WHERE id=${actor(c).subjectId}`,
          );
          await tx.query(
            sql`UPDATE identity.users SET onboarding_return_to='/home' WHERE id=${actor(c).subjectId} AND onboarding->>'identity'='true' AND onboarding->>'appearance'='true' AND onboarding->>'layout'='true'`,
          );
        });
        return profile(actor(c).subjectId);
      },
    }),
    defineOperation({
      id: 'identity.rename-session',
      kind: 'command',
      input: renameSessionSchema,
      output: okSchema,
      access: self,
      rate,
      handle: async (i, c) => {
        await directory.rename(actor(c), i.sessionId, i.name);
        return { ok: true as const };
      },
    }),
    defineOperation({
      id: 'identity.unlink',
      kind: 'command',
      input: unlinkProviderSchema,
      output: okSchema,
      access: self,
      rate: authRate,
      handle: async (i, c) => {
        await directory.withSession(actor(c), async (tx) => {
          await directory.requireRecent(actor(c));
          await tx.query(
            sql`SELECT id FROM identity.users WHERE id=${actor(c).subjectId} FOR UPDATE`,
          );
          const rows = await tx.query(
            sql`SELECT provider FROM identity.identities WHERE user_id=${actor(c).subjectId}`,
          );
          if (
            !rows.some(
              (r) => r.provider !== i.provider && deps.providers.some((p) => p.id === r.provider),
            )
          )
            return fail('CONFLICT');
          await tx.query(
            sql`DELETE FROM identity.identities WHERE user_id=${actor(c).subjectId} AND provider=${i.provider}`,
          );
        });
        return { ok: true as const };
      },
    }),
    defineOperation({
      id: 'identity.delete-account',
      kind: 'authentication',
      input: deleteAccountSchema,
      output: okSchema,
      access: self,
      rate: { limit: 5, windowMs: 60_000 },
      handle: async (_, c) => {
        await directory.eraseAccount(actor(c), async (tx) => {
          const proof = await tx.query(
            sql`DELETE FROM identity.deletion_proofs WHERE session_id=${actor(c).sessionId} AND user_id=${actor(c).subjectId} AND expires_at>CURRENT_TIMESTAMP RETURNING session_id`,
          );
          if (!proof.length) return fail('FORBIDDEN');
          await tx.query(sql`DELETE FROM identity.users WHERE id=${actor(c).subjectId}`);
        });
        c.browser!.clearSession();
        c.browser!.setFlowToken(null);
        lifecycle?.observer.record('identity.deleted');
        await lifecycle?.events.emit(deleted, { userId: actor(c).subjectId });
        return { ok: true as const };
      },
    }),
    defineOperation({
      id: 'identity.providers',
      kind: 'query',
      input: emptySchema,
      output: providersSchema,
      access: { public: true },
      rate,
      handle: async () => (deps.enabled === false ? [] : deps.providers.map((p) => p.id)),
    }),
    defineOperation({
      id: 'identity.me',
      kind: 'query',
      input: emptySchema,
      output: profileSchema,
      access: self,
      rate,
      handle: async (_, c) => profile(actor(c).subjectId),
    }),
    defineOperation({
      id: 'identity.profile',
      kind: 'command',
      input: profileUpdateSchema,
      output: profileSchema,
      access: self,
      rate,
      handle: async (input, c) => {
        await directory.withSession(actor(c), async (tx) => {
          await tx.query(
            sql`UPDATE identity.users SET display_name = ${input.displayName} WHERE id = ${actor(c).subjectId}`,
          );
        });
        return profile(actor(c).subjectId);
      },
    }),
    defineOperation({
      id: 'identity.identities',
      kind: 'query',
      input: emptySchema,
      output: identityListSchema,
      access: self,
      rate,
      handle: async (_, c) =>
        (
          await db.query(
            sql`SELECT provider, linked_at FROM identity.identities WHERE user_id = ${actor(c).subjectId} ORDER BY linked_at`,
          )
        ).map((r) => ({
          provider: r.provider as Provider,
          linkedAt: (r.linked_at as Date).toISOString(),
        })),
    }),
    defineOperation({
      id: 'identity.start',
      kind: 'authentication',
      input: oauthStartSchema,
      output: oauthStartResultSchema,
      access: { public: true },
      rate: authRate,
      handle: async (input, c) => {
        const browser = c.browser ?? fail('FORBIDDEN');
        const provider = deps.providers.find((p) => p.id === input.provider) ?? fail('NOT_FOUND');
        if (input.mode === 'login' && c.actor) return fail('CONFLICT');
        if (input.mode !== 'login') await profile(actor(c).subjectId);
        if (input.mode === 'link') await directory.requireRecent(actor(c));
        const returnTo =
          input.mode === 'login'
            ? safeReturnTo(input.returnTo)
            : input.returnTo === '/account#delete' && input.mode === 'reauthenticate'
              ? '/account#delete'
              : '/account';
        const state = secret(),
          verifier = secret(),
          nonce = secret(),
          browserToken = secret();
        const referralId =
          input.mode === 'login' && input.referralToken
            ? ((await deps.referrals?.resolve(input.referralToken)) ?? null)
            : null;
        await db.transaction(async (tx) => {
          await tx.query(
            sql`DELETE FROM identity.oauth_flows WHERE expires_at <= CURRENT_TIMESTAMP OR browser_hash = ${digest(browser.flowToken ?? '')}`,
          );
          await tx.query(
            sql`INSERT INTO identity.oauth_flows (state_hash, browser_hash, provider, verifier, nonce, mode, actor_id, session_id, return_to, referral_id, expires_at) VALUES (${digest(state)}, ${digest(browserToken)}, ${input.provider}, ${verifier}, ${nonce}, ${input.mode}, ${c.actor?.subjectId ?? null}, ${c.actor?.sessionId ?? null}, ${returnTo}, ${referralId}, CURRENT_TIMESTAMP + INTERVAL '10 minutes')`,
          );
        });
        browser.setFlowToken(browserToken);
        return {
          authorizationUrl: provider.authorizationUrl({
            state,
            verifier,
            nonce,
            reauthenticate: input.mode !== 'login',
          }),
        };
      },
    }),
    defineOperation({
      id: 'identity.finish',
      kind: 'authentication',
      input: oauthFinishSchema,
      output: oauthFinishResultSchema,
      access: { public: true },
      rate: authRate,
      handle: async (input, c) => {
        const browser = c.browser ?? fail('FORBIDDEN');
        if (!browser.flowToken || !/^[A-Za-z0-9_-]{43}$/.test(browser.flowToken))
          return fail('UNAUTHENTICATED');
        const [flow] = await db.query(
          sql`DELETE FROM identity.oauth_flows WHERE state_hash = ${digest(input.state)} AND browser_hash = ${digest(browser.flowToken)} AND provider = ${input.provider} AND expires_at > CURRENT_TIMESTAMP RETURNING *`,
        );
        if (!flow) return fail('UNAUTHENTICATED');
        if (
          flow.mode === 'login'
            ? c.actor !== null
            : !c.actor ||
              flow.actor_id !== c.actor.subjectId ||
              flow.session_id !== c.actor.sessionId
        )
          return fail('UNAUTHENTICATED');
        const provider = deps.providers.find((p) => p.id === input.provider) ?? fail('NOT_FOUND');
        const verified = await provider.exchange(
          input.code,
          {
            state: input.state,
            verifier: String(flow.verifier),
            nonce: String(flow.nonce),
            reauthenticate: flow.mode !== 'login',
          },
          c.signal,
        );
        c.signal.throwIfAborted();
        if (verified.provider !== input.provider) return fail('UNAUTHENTICATED');
        if (flow.mode === 'reauthenticate') {
          const [identity] = await db.query(
            sql`SELECT user_id FROM identity.identities WHERE provider = ${verified.provider} AND issuer = ${verified.issuer} AND subject = ${verified.subject}`,
          );
          if (identity?.user_id !== actor(c).subjectId) return fail('FORBIDDEN');
          await directory.markRecent(actor(c));
          if (flow.return_to === '/account#delete')
            await directory.withSession(actor(c), async (tx) => {
              await tx.query(
                sql`INSERT INTO identity.deletion_proofs(session_id,user_id,expires_at) VALUES(${actor(c).sessionId},${actor(c).subjectId},CURRENT_TIMESTAMP+INTERVAL '5 minutes') ON CONFLICT(session_id) DO UPDATE SET expires_at=EXCLUDED.expires_at`,
              );
            });
          lifecycle?.observer.record('identity.reauthenticated', { provider: input.provider });
        } else if (flow.mode === 'link') {
          await directory.requireRecent(actor(c));
          await directory.withSession(actor(c), (tx) =>
            resolveIdentity(tx, verified, actor(c).subjectId),
          );
          lifecycle?.observer.record('identity.linked', { provider: input.provider });
        } else {
          const userId = await db.transaction((tx) =>
            resolveIdentity(
              tx,
              verified,
              undefined,
              flow.referral_id ? String(flow.referral_id) : undefined,
            ),
          );
          c.signal.throwIfAborted();
          await directory.withSubject(userId, async (tx) => {
            // Erasure may have won after provider resolution. Never issue an orphan session.
            if (!(await tx.query(sql`SELECT id FROM identity.users WHERE id=${userId}`)).length)
              return fail('UNAUTHENTICATED');
            await tx.query(
              sql`UPDATE identity.users SET onboarding_return_to=${safeReturnTo(flow.return_to)} WHERE id=${userId} AND NOT (onboarding->>'identity'='true' AND onboarding->>'appearance'='true' AND onboarding->>'layout'='true')`,
            );
            const sessionId = await browser.issueSession(userId);
            await directory.activity({ subjectId: userId, sessionId }, browser.deviceLabel);
            await directory.markRecent({ subjectId: userId, sessionId });
          });
          lifecycle?.observer.record('identity.login', { provider: input.provider });
          await lifecycle?.events.emit(authenticated, { userId });
        }
        browser.setFlowToken(null);
        return { ok: true, returnTo: safeReturnTo(flow.return_to) };
      },
    }),
    defineOperation({
      id: 'identity.sessions',
      kind: 'query',
      input: emptySchema,
      output: sessionsSchema,
      access: self,
      rate,
      handle: async (_, c) => directory.list(actor(c)),
    }),
    defineOperation({
      id: 'identity.revoke',
      kind: 'command',
      input: revokeSessionSchema,
      output: okSchema,
      access: self,
      rate,
      handle: async (input, c) => {
        await directory.revokeOwned(actor(c), input.sessionId);
        lifecycle?.observer.record('identity.session.revoked');
        return { ok: true };
      },
    }),
    defineOperation({
      id: 'identity.revoke-others',
      kind: 'command',
      input: emptySchema,
      output: okSchema,
      access: self,
      rate,
      handle: async (_, c) => {
        await directory.revokeOthers(actor(c));
        lifecycle?.observer.record('identity.other-sessions.revoked');
        return { ok: true };
      },
    }),
    defineOperation({
      id: 'identity.revoke-all',
      kind: 'authentication',
      input: emptySchema,
      output: okSchema,
      access: self,
      rate,
      handle: async (_, c) => {
        await directory.revokeAll(actor(c));
        lifecycle?.observer.record('identity.all-sessions.revoked');
        c.browser!.clearSession();
        return { ok: true };
      },
    }),
    defineOperation({
      id: 'identity.logout',
      kind: 'authentication',
      input: emptySchema,
      output: okSchema,
      access: self,
      rate,
      handle: async (_, c) => {
        await directory.revokeOwned(actor(c), actor(c).sessionId);
        lifecycle?.observer.record('identity.logout');
        c.browser!.clearSession();
        c.browser!.setFlowToken(null);
        return { ok: true };
      },
    }),
    defineOperation({
      id: 'identity.refresh',
      kind: 'authentication',
      input: emptySchema,
      output: okSchema,
      access: self,
      rate,
      handle: async (_, c) => {
        await c.browser!.refreshSession();
        await directory.activity(actor(c));
        return { ok: true };
      },
    }),
  ];
  return {
    ...identityDefinition,
    capabilities: ['identity.v1', 'session.devices.v1'],
    permissions: [
      {
        id: 'identity.self',
        description: 'Access the current account only',
        allows: async (a, r) =>
          a.subjectId === r.id &&
          (await db.query(sql`SELECT id FROM identity.users WHERE id = ${a.subjectId}`)).length ===
            1,
      },
    ],
    flags: [
      { id: 'identity.enabled', rule: { mode: deps.enabled === false ? 'disabled' : 'global' } },
    ],
    operations: operations.map((op) =>
      op.id === 'identity.providers' ? op : { ...op, flag: 'identity.enabled' },
    ),
    http: operations.map((op) => ({
      method: op.kind === 'query' ? 'GET' : 'POST',
      path: `/api/v1/account/${op.id.slice('identity.'.length)}`,
      operation: op.id,
      input: op.kind === 'query' ? 'query' : 'body',
    })),
    events: [authenticated, deleted],
    start: async (c) => {
      lifecycle = c;
    },
  };
}
