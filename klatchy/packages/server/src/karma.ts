import { sql } from "./db/client.js";

export const KARMA_REASONS = {
  SESSION_COMPLETE: "session.complete",
  RATING_RECEIVED: "rating.received",
  ROOM_HELPFUL: "room.helpful_reaction",
  STREAK_DAY: "streak.daily",
  NO_SHOW: "session.no_show",
  REPORTED: "moderation.reported",
  QUICK_NEG_END: "session.quick_neg_end",
} as const;

export async function award(
  userId: string,
  delta: number,
  reason: string,
  refId?: string,
): Promise<number> {
  await sql`
    INSERT INTO karma_events (user_id, delta, reason, ref_id)
    VALUES (${userId}, ${delta}, ${reason}, ${refId ?? null})
  `;
  return getTotal(userId);
}

export async function getTotal(userId: string): Promise<number> {
  const rows = await sql`
    SELECT COALESCE(SUM(delta), 0)::INT AS total
    FROM karma_events
    WHERE user_id = ${userId}
  `;
  return rows[0]?.total ?? 0;
}
