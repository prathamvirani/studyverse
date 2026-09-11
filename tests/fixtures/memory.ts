import type { RateLimiter, RatePolicy, SessionRecord, SessionStore } from '@study/feature-sdk';

/** Test doubles only. Production never substitutes these for PostgreSQL/Redis. */
export class MemorySessions implements SessionStore {
  readonly rows = new Map<string, SessionRecord>();
  async create(session: SessionRecord): Promise<void> {
    this.rows.set(session.id, structuredClone(session));
  }
  async findByHash(hash: string): Promise<SessionRecord | null> {
    return structuredClone([...this.rows.values()].find((row) => row.tokenHash === hash) ?? null);
  }
  async findById(id: string): Promise<SessionRecord | null> {
    return structuredClone(this.rows.get(id) ?? null);
  }
  async rotate(oldHash: string, replacement: SessionRecord, now: number): Promise<boolean> {
    const old = this.rows.get(replacement.id);
    if (
      !old ||
      old.tokenHash !== oldHash ||
      old.subjectId !== replacement.subjectId ||
      old.revokedAt !== null ||
      old.expiresAt <= now ||
      old.idleExpiresAt <= now
    )
      return false;
    this.rows.set(replacement.id, replacement);
    return true;
  }
  async revoke(id: string, now: number): Promise<void> {
    const old = this.rows.get(id);
    if (old) this.rows.set(id, { ...old, revokedAt: now });
  }
  async revokeSubject(subjectId: string, now: number): Promise<void> {
    for (const row of this.rows.values())
      if (row.subjectId === subjectId) await this.revoke(row.id, now);
  }
}
export class MemoryLimiter implements RateLimiter {
  private readonly counts = new Map<string, { count: number; until: number }>();
  async consume(key: string, policy: RatePolicy): Promise<boolean> {
    const current = this.counts.get(key),
      now = Date.now();
    const row =
      current && current.until > now ? current : { count: 0, until: now + policy.windowMs };
    row.count++;
    this.counts.set(key, row);
    return row.count <= policy.limit;
  }
}
