import { readFileSync } from 'node:fs';
import { createPool } from '@study/adapters/postgres';
/** Host-side test fixture only; never an HTTP endpoint or a production account bypass. */
export async function removeTestMembership(roomId: string, userId: string) {
  const values = Object.fromEntries(
    readFileSync('.local/compose.env', 'utf8')
      .trim()
      .split(/\r?\n/)
      .map((line) => line.split('=')),
  );
  const url =
    process.env.TEST_DATABASE_URL ??
    `postgresql://study_runtime:${values.RUNTIME_PASSWORD}@localhost:5433/study_test`;
  if (!new URL(url).pathname.endsWith('_test')) throw new Error('Dedicated test database required');
  const pool = createPool(url);
  try {
    const result = await pool.query(
      'DELETE FROM rooms.memberships WHERE room_id=$1 AND user_id=$2 AND role=$3',
      [roomId, userId, 'member'],
    );
    if (result.rowCount !== 1) throw new Error('Expected one test membership');
  } finally {
    await pool.end();
  }
}
