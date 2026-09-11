import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from '@study/contracts';
import type { Actor, Observer, SessionRecord, SessionStore } from '@study/feature-sdk';
import { AppError } from './errors.ts';
import { noopObserver } from './observability.ts';

export const SESSION_COOKIE = '__Host-study-session';
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
export const tokenDigest = (token: string): string =>
  createHash('sha256').update(token).digest('hex');
export interface IssuedSession {
  readonly token: string;
  readonly session: SessionRecord;
}
export class Sessions {
  constructor(
    private readonly store: SessionStore,
    private readonly observer: Observer = noopObserver,
    private readonly now: () => number = Date.now,
    private readonly absoluteMs = 30 * 24 * 60 * 60 * 1000,
    private readonly idleMs = 7 * 24 * 60 * 60 * 1000,
  ) {}
  private newSession(subjectId: string, original?: SessionRecord): IssuedSession {
    z.uuid().parse(subjectId);
    const token = randomBytes(32).toString('base64url'),
      now = this.now();
    const expiresAt = original?.expiresAt ?? now + this.absoluteMs;
    return {
      token,
      session: {
        id: original?.id ?? randomUUID(),
        subjectId,
        tokenHash: tokenDigest(token),
        csrfToken: randomBytes(32).toString('base64url'),
        createdAt: original?.createdAt ?? now,
        expiresAt,
        idleExpiresAt: Math.min(now + this.idleMs, expiresAt),
        revokedAt: null,
      },
    };
  }
  /** Trusted server entry point only; never bind directly to an HTTP/WS operation. */
  async issue(subjectId: string): Promise<IssuedSession> {
    const issued = this.newSession(subjectId);
    await this.store.create(issued.session);
    this.observer.record('session.issued');
    return issued;
  }
  private live(session: SessionRecord | null): session is SessionRecord {
    return (
      session !== null &&
      session.revokedAt === null &&
      session.expiresAt > this.now() &&
      session.idleExpiresAt > this.now()
    );
  }
  async authenticate(token: string | undefined): Promise<SessionRecord> {
    if (!token || !tokenPattern.test(token)) throw new AppError('UNAUTHENTICATED');
    const session = await this.store.findByHash(tokenDigest(token));
    if (!this.live(session)) throw new AppError('UNAUTHENTICATED');
    return session;
  }
  actor(session: SessionRecord): Actor {
    return { subjectId: session.subjectId, sessionId: session.id };
  }
  async csrfFor(actor: Actor): Promise<string> {
    const session = await this.store.findById(actor.sessionId);
    if (!this.live(session) || session.subjectId !== actor.subjectId)
      throw new AppError('UNAUTHENTICATED');
    return session.csrfToken;
  }
  verifyCsrf(session: SessionRecord, candidate: unknown): void {
    if (
      typeof candidate !== 'string' ||
      !tokenPattern.test(candidate) ||
      !timingSafeEqual(Buffer.from(session.csrfToken), Buffer.from(candidate))
    )
      throw new AppError('CSRF_REJECTED');
  }
  async rotate(token: string): Promise<IssuedSession> {
    const current = await this.authenticate(token),
      replacement = this.newSession(current.subjectId, current);
    if (!(await this.store.rotate(current.tokenHash, replacement.session, this.now())))
      throw new AppError('UNAUTHENTICATED');
    this.observer.record('session.rotated');
    return replacement;
  }
  async revoke(id: string): Promise<void> {
    await this.store.revoke(id, this.now());
    this.observer.record('session.revoked');
  }
  async revokeSubject(subjectId: string): Promise<void> {
    await this.store.revokeSubject(subjectId, this.now());
    this.observer.record('session.subject.revoked');
  }
  cookie(issued: IssuedSession): string {
    const maxAge = Math.max(
      0,
      Math.floor(
        (Math.min(issued.session.expiresAt, issued.session.idleExpiresAt) - this.now()) / 1000,
      ),
    );
    return `${SESSION_COOKIE}=${issued.token}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
  }
  clearCookie(): string {
    return `${SESSION_COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`;
  }
}
