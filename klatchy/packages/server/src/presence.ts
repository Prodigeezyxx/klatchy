import Redis from "ioredis";
import { MiniRedis } from "./mini-redis.js";
import { settings } from "./settings.js";
import type { Status } from "@klatchy/shared";

const STATUS_TTL_SEC = 30;
const HOUSEKEEPING_MS = 15_000;

type RedisClient = Redis | MiniRedis;

class Presence {
  private r?: RedisClient;
  private _hkTimer?: ReturnType<typeof setInterval>;

  async connect() {
    if (settings.redisUrl) {
      this.r = new Redis(settings.redisUrl, { lazyConnect: true });
      await this.r.connect();
    } else {
      this.r = new MiniRedis();
      await this.r.connect();
    }
    this._hkTimer = setInterval(() => this._housekeeping(), HOUSEKEEPING_MS);
  }

  async close() {
    if (this._hkTimer) clearInterval(this._hkTimer);
    if (this.r) await this.r.quit();
  }

  private get client(): RedisClient {
    if (!this.r) throw new Error("Presence not connected");
    return this.r;
  }

  async setStatus(userId: string, status: Status) {
    const pipe = this.client.pipeline();
    pipe.set(`presence:status:${userId}`, status, "EX", STATUS_TTL_SEC);
    if (status === "offline") {
      pipe.srem("presence:online", userId);
    } else {
      pipe.sadd("presence:online", userId);
    }
    await pipe.exec();
    await this.client.publish("presence", JSON.stringify({ userId, status }));
  }

  async heartbeat(userId: string) {
    const exists = await this.client.exists(`presence:status:${userId}`);
    if (exists) await this.client.expire(`presence:status:${userId}`, STATUS_TTL_SEC);
  }

  async getStatus(userId: string): Promise<Status> {
    const val = (await this.client.get(`presence:status:${userId}`)) as Status | null;
    return val ?? "offline";
  }

  async disconnect(userId: string) {
    await this.setStatus(userId, "offline");
  }

  async snapshot(): Promise<Array<{ userId: string; status: Status }>> {
    const members = await this.client.smembers("presence:online");
    if (members.length === 0) return [];
    const keys = members.map((u) => `presence:status:${u}`);
    const statuses = await this.client.mget(...keys);
    const out: Array<{ userId: string; status: Status }> = [];
    const pipe = this.client.pipeline();
    for (let i = 0; i < members.length; i++) {
      const s = statuses[i] as Status | null;
      if (!s) {
        pipe.srem("presence:online", members[i]!);
        continue;
      }
      out.push({ userId: members[i]!, status: s });
    }
    if (pipe.length > 0) await pipe.exec();
    return out;
  }

  async publishToUser(userId: string, payload: unknown) {
    await this.client.publish(`vibe:${userId}`, JSON.stringify(payload));
  }

  async publishToSession(sessionId: string, payload: unknown) {
    await this.client.publish(`session:${sessionId}`, JSON.stringify(payload));
  }

  subscribe(redis: Redis, channels: string[]) {
    return redis.subscribe(...channels);
  }

  unsubscribe(redis: Redis, channels: string[]) {
    return redis.unsubscribe(...channels);
  }

  async roomJoin(room: string, userId: string) {
    await this.client.sadd(`room:${room}:members`, userId);
  }

  async roomLeave(room: string, userId: string) {
    await this.client.srem(`room:${room}:members`, userId);
  }

  async roomMembers(room: string): Promise<string[]> {
    return this.client.smembers(`room:${room}:members`);
  }

  private async _housekeeping() {
    try {
      await this.snapshot();
    } catch {
      // ignore
    }
  }
}

export const presence = new Presence();
