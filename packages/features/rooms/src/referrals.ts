import { createHash, randomUUID } from 'node:crypto';
import { sql } from '@study/feature-sdk';
import type { Database, ReferralAttribution } from '@study/feature-sdk';
const digest = (s: string) => createHash('sha256').update(s).digest('hex');
/** Attribution only. This port never reads memberships, admits participants, or issues credentials. */
export function referralAttribution(db: Database): ReferralAttribution {
  async function resolve(token: string) {
    const [r] = await db.query(
      sql`SELECT id FROM rooms.referral_links WHERE identifier_hash=${digest(token)}`,
    );
    return r ? String(r.id) : null;
  }
  return {
    resolve,
    async landing(token, key) {
      const id = await resolve(token);
      if (id)
        await db.query(
          sql`INSERT INTO rooms.referral_events(id,link_id,kind,dedupe_key) VALUES(${randomUUID()},${id},'landing',${digest(key)}) ON CONFLICT DO NOTHING`,
        );
    },
    async signup(linkId, subjectId, tx) {
      await tx.query(
        sql`INSERT INTO rooms.referral_events(id,link_id,kind,subject_id,dedupe_key) SELECT ${randomUUID()},id,'free-signup',${subjectId},${digest(subjectId)} FROM rooms.referral_links WHERE id=${linkId} ON CONFLICT DO NOTHING`,
      );
    },
    async conversion(linkId, subjectId, eventKey) {
      if (!eventKey || eventKey.length > 100) throw new Error('Invalid conversion event key');
      await db.query(
        sql`INSERT INTO rooms.referral_events(id,link_id,kind,subject_id,dedupe_key) SELECT ${randomUUID()},id,'future-conversion',${subjectId},${digest(eventKey)} FROM rooms.referral_links WHERE id=${linkId} ON CONFLICT DO NOTHING`,
      );
    },
  };
}
