import type { Actor, Database, SessionDirectory } from '@study/feature-sdk';
import { sql } from '@study/feature-sdk';
import { AppError } from '@study/core/server';
import type { SessionView } from '@study/contracts';

export class PostgresSessionDirectory implements SessionDirectory {
  constructor(private readonly db: Database) {}
  async withSession<T>(actor: Actor, work: (db: Database) => Promise<T>): Promise<T> {
    return this.db.transaction(async (db) => {
      const rows = await db.query(
        sql`SELECT id FROM core.sessions WHERE id = ${actor.sessionId} AND subject_id = ${actor.subjectId} AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP AND idle_expires_at > CURRENT_TIMESTAMP FOR UPDATE`,
      );
      if (!rows.length) throw new AppError('UNAUTHENTICATED');
      return work(db);
    });
  }
  async list(actor: Actor): Promise<SessionView[]> {
    const rows = await this.db.query(
      sql`SELECT id, device_label, created_at, last_active_at, LEAST(expires_at, idle_expires_at) AS expires_at FROM core.sessions WHERE subject_id = ${actor.subjectId} AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP AND idle_expires_at > CURRENT_TIMESTAMP ORDER BY (id = ${actor.sessionId}) DESC, created_at DESC LIMIT 100`,
    );
    return rows.map((r) => ({
      id: String(r.id),
      current: r.id === actor.sessionId,
      deviceLabel: String(r.device_label),
      createdAt: (r.created_at as Date).toISOString(),
      lastActiveAt: (r.last_active_at as Date).toISOString(),
      expiresAt: (r.expires_at as Date).toISOString(),
    }));
  }
  async revokeOwned(actor: Actor, id: string): Promise<void> {
    await this.withSession(actor, async (db) => {
      const rows = await db.query(
        sql`UPDATE core.sessions SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP) WHERE id = ${id} AND subject_id = ${actor.subjectId} RETURNING id`,
      );
      if (!rows.length) throw new AppError('FORBIDDEN');
    });
  }
  async revokeOthers(actor: Actor): Promise<void> {
    await this.withSession(actor, async (db) => {
      await db.query(
        sql`UPDATE core.sessions SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP) WHERE subject_id = ${actor.subjectId} AND id <> ${actor.sessionId}`,
      );
    });
  }
  async revokeAll(actor: Actor): Promise<void> {
    await this.withSession(actor, async (db) => {
      await db.query(
        sql`UPDATE core.sessions SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP) WHERE subject_id = ${actor.subjectId}`,
      );
    });
  }
  async activity(actor: Actor, label?: string): Promise<void> {
    await this.withSession(actor, async (db) => {
      await db.query(
        sql`UPDATE core.sessions SET last_active_at = CURRENT_TIMESTAMP, device_label = COALESCE(${label ?? null}, device_label) WHERE id = ${actor.sessionId}`,
      );
    });
  }
  async requireRecent(actor: Actor): Promise<void> {
    const rows = await this.db.query(
      sql`SELECT id FROM core.sessions WHERE id = ${actor.sessionId} AND subject_id = ${actor.subjectId} AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP AND idle_expires_at > CURRENT_TIMESTAMP AND reauthenticated_at > CURRENT_TIMESTAMP - INTERVAL '5 minutes'`,
    );
    if (!rows.length) throw new AppError('FORBIDDEN');
  }
  async markRecent(actor: Actor): Promise<void> {
    await this.withSession(actor, async (db) => {
      await db.query(
        sql`UPDATE core.sessions SET reauthenticated_at = CURRENT_TIMESTAMP WHERE id = ${actor.sessionId}`,
      );
    });
  }
}
