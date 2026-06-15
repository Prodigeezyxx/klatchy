import type { DevPublic, Status } from "@klatchy/shared";
import { settings } from "./settings.js";
import { presence } from "./presence.js";

// In-memory pool entry
interface PoolEntry {
  user: DevPublic;
  tags: Set<string>;
  timezone?: string;
  lastPairedWith: Map<string, number>; // otherUserId → epoch ms
  priorPositive: Set<string>;
}

class Matchmaker {
  private pool = new Map<string, PoolEntry>();
  private _snapshotTimer?: ReturnType<typeof setInterval>;

  start(load: () => Promise<Map<string, PoolEntry>>) {
    this._snapshotTimer = setInterval(async () => {
      try {
        this.pool = await load();
      } catch {
        // ignore
      }
    }, 5_000);
  }

  stop() {
    if (this._snapshotTimer) clearInterval(this._snapshotTimer);
  }

  getPoolFor(viewerId: string): DevPublic[] {
    const viewer = this.pool.get(viewerId);
    const result: DevPublic[] = [];
    for (const [uid, entry] of this.pool) {
      if (uid === viewerId) continue;
      result.push({
        ...entry.user,
        match: this._score(viewer, entry, new Set()),
      });
    }
    result.sort((a, b) => b.match - a.match);
    return result;
  }

  rank(
    senderId: string,
    senderTags: Set<string>,
    opts?: { targetHandle?: string; topN?: number },
  ): DevPublic[] {
    const sender = this.pool.get(senderId);
    if (!sender) return [];
    const candidates: Array<{ score: number; dev: DevPublic }> = [];
    const n = opts?.topN ?? settings.matchmakerTopN;

    for (const [uid, entry] of this.pool) {
      if (uid === senderId) continue;
      if (entry.user.status !== "available") continue;
      if (opts?.targetHandle) {
        const clean = opts.targetHandle.replace(/^@/, "").toLowerCase();
        if (entry.user.handle.toLowerCase() !== clean) continue;
      }
      candidates.push({
        score: this._score(sender, entry, senderTags),
        dev: { ...entry.user },
      });
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates.slice(0, n).map((c) => ({ ...c.dev, match: c.score }));
  }

  recordPairing(a: string, b: string) {
    const now = Date.now();
    const pairs: [string, string][] = [[a, b], [b, a]];
    for (const [x, y] of pairs) {
      this.pool.get(x)?.lastPairedWith.set(y, now);
    }
  }

  recordPositive(a: string, b: string) {
    const pairs: [string, string][] = [[a, b], [b, a]];
    for (const [x, y] of pairs) {
      this.pool.get(x)?.priorPositive.add(y);
    }
  }

  upsertEntry(userId: string, entry: PoolEntry) {
    this.pool.set(userId, entry);
  }

  removeEntry(userId: string) {
    this.pool.delete(userId);
  }

  private _score(
    sender: PoolEntry | undefined,
    candidate: PoolEntry,
    senderTags: Set<string>,
  ): number {
    const senderStack = new Set([
      ...(sender?.tags ?? []),
      ...senderTags,
    ]);

    const stackUnion = new Set([...senderStack, ...candidate.tags]);
    const stackInter = new Set([...senderStack].filter((t) => candidate.tags.has(t)));
    const stack = stackUnion.size === 0 ? 0 : stackInter.size / stackUnion.size;

    const karmaNorm = Math.min(
      Math.log10(Math.max(candidate.user.karma, 0) + 1) / 4,
      1,
    );

    let tzProximity = 0.5;
    if (sender?.timezone && candidate.timezone) {
      const delta = Math.abs(_tzOffset(sender.timezone) - _tzOffset(candidate.timezone));
      tzProximity = 1 - Math.min(delta / 12, 1);
    }

    const historyBonus =
      sender?.priorPositive.has(candidate.user.userId) ? 1 : 0;

    const lastPair = sender?.lastPairedWith.get(candidate.user.userId);
    const recencyPen = lastPair && Date.now() - lastPair < 3_600_000 ? 0 : 1;

    const vibeUnion = new Set([...senderTags, ...candidate.tags]);
    const vibeInter = new Set([...senderTags].filter((t) => candidate.tags.has(t)));
    const vibeAlign =
      senderTags.size === 0 || vibeUnion.size === 0
        ? 0
        : vibeInter.size / vibeUnion.size;

    const weighted =
      0.35 * stack +
      0.2 * karmaNorm +
      0.15 * recencyPen +
      0.1 * tzProximity +
      0.1 * historyBonus +
      0.1 * vibeAlign;

    return Math.max(0, Math.min(100, Math.round(weighted * 100)));
  }
}

function _tzOffset(tz: string): number {
  try {
    const now = new Date();
    const locale = now.toLocaleString("en-US", { timeZone: tz });
    const utc = now.toLocaleString("en-US", { timeZone: "UTC" });
    const diff = new Date(locale).getTime() - new Date(utc).getTime();
    return diff / 3_600_000;
  } catch {
    return 0;
  }
}

export const matchmaker = new Matchmaker();
