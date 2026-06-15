export const TIERS = [
  { name: "newcomer", minKarma: 0, maxKarma: 99 },
  { name: "regular", minKarma: 100, maxKarma: 999 },
  { name: "sensei", minKarma: 1000, maxKarma: 4999 },
  { name: "legend", minKarma: 5000, maxKarma: Infinity },
] as const;

export const ROOMS = [
  "#rust-helpdesk",
  "#late-night-debug",
  "#ship-it-friday",
  "#pair-up",
  "#ai-vibes",
  "#code-review",
] as const;

export const KARMA_REASONS = {
  SESSION_COMPLETE: "session.complete",
  RATING_RECEIVED: "rating.received",
  ROOM_HELPFUL: "room.helpful_reaction",
  STREAK_DAY: "streak.daily",
  NO_SHOW: "session.no_show",
  REPORTED: "moderation.reported",
  QUICK_NEG_END: "session.quick_neg_end",
} as const;

export const PING_INTERVAL_MS = 25_000;
export const VIBE_TTL_MS = 60_000;
export const POOL_REFRESH_MS = 5_000;
export const HEARTBEAT_MS = 10_000;
export const RECONNECT_BACKOFF = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000];

export function tierFor(karma: number): string {
  for (const t of TIERS) {
    if (karma >= t.minKarma && karma <= t.maxKarma) return t.name;
  }
  return "newcomer";
}
