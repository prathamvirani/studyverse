import type { Database, SessionRecord, SessionStore } from '@study/feature-sdk';
import { sql } from './database.ts';

type Row = Record<string, unknown> & {
  id: string;
  token_hash: string;
  subject_id: string;
  csrf_token: string;
  created_at: Date;
  expires_at: Date;
  idle_expires_at: Date;
  revoked_at: Date | null;
};
function record(row: Row | undefined): SessionRecord | null {
  return row
    ? {
        id: row.id,
        tokenHash: row.token_hash,
        subjectId: row.subject_id,
        csrfToken: row.csrf_token,
        createdAt: row.created_at.getTime(),
        expiresAt: row.expires_at.getTime(),
        idleExpiresAt: row.idle_expires_at.getTime(),
        revokedAt: row.revoked_at?.getTime() ?? null,
      }
    : null;
}
export class PostgresSessionStore implements SessionStore {
  constructor(private readonly db: Database) {}
  async create(session: SessionRecord): Promise<void> {
    await this.db
      .query(sql`INSERT INTO core.sessions (id, token_hash, subject_id, csrf_token, created_at, expires_at, idle_expires_at, revoked_at)
      VALUES (${session.id}, ${session.tokenHash}, ${session.subjectId}, ${session.csrfToken}, ${new Date(session.createdAt)}, ${new Date(session.expiresAt)}, ${new Date(session.idleExpiresAt)}, ${session.revokedAt === null ? null : new Date(session.revokedAt)})`);
  }
  async findByHash(hash: string): Promise<SessionRecord | null> {
    return record(
      (await this.db.query<Row>(sql`SELECT * FROM core.sessions WHERE token_hash = ${hash}`))[0],
    );
  }
  async findById(id: string): Promise<SessionRecord | null> {
    return record((await this.db.query<Row>(sql`SELECT * FROM core.sessions WHERE id = ${id}`))[0]);
  }
  async rotate(oldHash: string, replacement: SessionRecord, now: number): Promise<boolean> {
    const rows = await this.db.query(sql`UPDATE core.sessions
      SET token_hash = ${replacement.tokenHash}, csrf_token = ${replacement.csrfToken}, idle_expires_at = ${new Date(replacement.idleExpiresAt)}
      WHERE id = ${replacement.id} AND token_hash = ${oldHash} AND subject_id = ${replacement.subjectId}
      AND revoked_at IS NULL AND expires_at > ${new Date(now)} AND idle_expires_at > ${new Date(now)} RETURNING id`);
    return rows.length === 1;
  }
  async revoke(id: string, now: number): Promise<void> {
    await this.db.query(
      sql`UPDATE core.sessions SET revoked_at = COALESCE(revoked_at, ${new Date(now)}) WHERE id = ${id}`,
    );
  }
  async revokeSubject(subjectId: string, now: number): Promise<void> {
    await this.db.query(
      sql`UPDATE core.sessions SET revoked_at = COALESCE(revoked_at, ${new Date(now)}) WHERE subject_id = ${subjectId}`,
    );
  }
}
