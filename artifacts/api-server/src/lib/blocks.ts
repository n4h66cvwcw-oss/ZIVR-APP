import { query, queryOne } from "./db";

/** Shown to the sender. Does not reveal who blocked whom. */
export const CANT_MESSAGE_THIS_USER = "can't message this user";

export async function eitherUserBlocked(userA: string, userB: string): Promise<boolean> {
  const row = await queryOne<{ blocked: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM user_blocks
        WHERE (blocker_id = $1 AND blocked_id = $2)
           OR (blocker_id = $2 AND blocked_id = $1)
     ) AS blocked`,
    [userA, userB],
  );
  return row?.blocked === true;
}

/** Members who have blocked `senderId` and therefore must not receive the message. */
export async function blockerIdsAmong(senderId: string, memberIds: string[]): Promise<Set<string>> {
  if (memberIds.length === 0) return new Set();
  const rows = await query<{ blocker_id: string }>(
    `SELECT blocker_id
       FROM user_blocks
      WHERE blocked_id = $1
        AND blocker_id = ANY($2::uuid[])`,
    [senderId, memberIds],
  );
  return new Set(rows.map((row) => row.blocker_id));
}
