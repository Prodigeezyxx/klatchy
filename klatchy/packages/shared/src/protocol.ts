import { z } from "zod";

// ─── value enums ─────────────────────────────────────────────────────────────

export const Status = z.enum(["available", "busy", "deep", "offline"]);
export type Status = z.infer<typeof Status>;

export const Tier = z.enum(["free", "pro", "team", "enterprise"]);
export type Tier = z.infer<typeof Tier>;

export const SessionRole = z.enum(["initiator", "recipient"]);
export type SessionRole = z.infer<typeof SessionRole>;

export const ChatKind = z.enum(["text", "code", "diff", "ai", "system"]);
export type ChatKind = z.infer<typeof ChatKind>;

// ─── shared DTOs ──────────────────────────────────────────────────────────────

export const DevPublicSchema = z.object({
  userId: z.string(),
  handle: z.string(),
  displayName: z.string().optional(),
  stack: z.array(z.string()).default([]),
  status: Status.default("offline"),
  karma: z.number().int().default(0),
  streak: z.number().int().default(0),
  match: z.number().int().min(0).max(100).default(0),
  tier: Tier.default("free"),
});
export type DevPublic = z.infer<typeof DevPublicSchema>;

export const VibeRequestPublicSchema = z.object({
  vibeId: z.string(),
  sender: DevPublicSchema,
  message: z.string(),
  tags: z.array(z.string()).default([]),
  durationSec: z.number().int().default(900),
  match: z.number().int().min(0).max(100).default(0),
});
export type VibeRequestPublic = z.infer<typeof VibeRequestPublicSchema>;

export const ChatLineSchema = z.object({
  who: z.string(),
  body: z.string(),
  kind: ChatKind.default("text"),
  ts: z.number().default(0),
});
export type ChatLine = z.infer<typeof ChatLineSchema>;

// ─── client → server ─────────────────────────────────────────────────────────

export const PresenceSet = z.object({
  op: z.literal("presence.set"),
  status: Status,
});
export type PresenceSet = z.infer<typeof PresenceSet>;

export const VibeSend = z.object({
  op: z.literal("vibe.send"),
  message: z.string().min(1).max(5000),
  tags: z.array(z.string()).default([]),
  durationSec: z.number().int().positive().default(900),
  targetHandle: z.string().optional(),
  targetRoom: z.string().optional(),
});
export type VibeSend = z.infer<typeof VibeSend>;

export const VibeAccept = z.object({
  op: z.literal("vibe.accept"),
  vibeId: z.string().min(1),
});
export type VibeAccept = z.infer<typeof VibeAccept>;

export const VibeDecline = z.object({
  op: z.literal("vibe.decline"),
  vibeId: z.string().min(1),
});
export type VibeDecline = z.infer<typeof VibeDecline>;

export const SessionMessage = z.object({
  op: z.literal("session.message"),
  sessionId: z.string().min(1),
  kind: ChatKind.default("text"),
  body: z.string().max(100_000),
  meta: z.record(z.unknown()).default({}),
});
export type SessionMessage = z.infer<typeof SessionMessage>;

export const SessionEnd = z.object({
  op: z.literal("session.end"),
  sessionId: z.string().min(1),
});
export type SessionEnd = z.infer<typeof SessionEnd>;

export const SessionRate = z.object({
  op: z.literal("session.rate"),
  sessionId: z.string().min(1),
  stars: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});
export type SessionRate = z.infer<typeof SessionRate>;

export const RoomJoin = z.object({
  op: z.literal("room.join"),
  room: z.string().min(1),
});
export type RoomJoin = z.infer<typeof RoomJoin>;

export const RoomLeave = z.object({
  op: z.literal("room.leave"),
  room: z.string().min(1),
});
export type RoomLeave = z.infer<typeof RoomLeave>;

export const Ping = z.object({
  op: z.literal("ping"),
  t: z.number(),
});
export type Ping = z.infer<typeof Ping>;

export const ClientMessage = z.discriminatedUnion("op", [
  PresenceSet,
  VibeSend,
  VibeAccept,
  VibeDecline,
  SessionMessage,
  SessionEnd,
  SessionRate,
  RoomJoin,
  RoomLeave,
  Ping,
]);
export type ClientMessage = z.infer<typeof ClientMessage>;

// ─── server → client ─────────────────────────────────────────────────────────

export const Hello = z.object({
  op: z.literal("hello"),
  me: DevPublicSchema,
  serverVersion: z.string(),
  serverTime: z.number(),
});
export type Hello = z.infer<typeof Hello>;

export const PoolUpdate = z.object({
  op: z.literal("pool.update"),
  users: z.array(DevPublicSchema),
});
export type PoolUpdate = z.infer<typeof PoolUpdate>;

export const VibeIncoming = z.object({
  op: z.literal("vibe.incoming"),
  request: VibeRequestPublicSchema,
});
export type VibeIncoming = z.infer<typeof VibeIncoming>;

export const VibeMatched = z.object({
  op: z.literal("vibe.matched"),
  sessionId: z.string(),
  peer: DevPublicSchema,
  role: SessionRole,
  durationSec: z.number(),
});
export type VibeMatched = z.infer<typeof VibeMatched>;

export const VibeFilled = z.object({
  op: z.literal("vibe.filled"),
  vibeId: z.string(),
  winnerHandle: z.string().optional(),
});
export type VibeFilled = z.infer<typeof VibeFilled>;

export const VibeExpired = z.object({
  op: z.literal("vibe.expired"),
  vibeId: z.string(),
});
export type VibeExpired = z.infer<typeof VibeExpired>;

export const ServerSessionMessage = z.object({
  op: z.literal("session.message"),
  sessionId: z.string(),
  fromHandle: z.string(),
  kind: ChatKind.default("text"),
  body: z.string(),
  meta: z.record(z.unknown()).default({}),
  ts: z.number(),
});
export type ServerSessionMessage = z.infer<typeof ServerSessionMessage>;

export const SessionEnded = z.object({
  op: z.literal("session.ended"),
  sessionId: z.string(),
  reason: z.string().default("ended"),
});
export type SessionEnded = z.infer<typeof SessionEnded>;

export const KarmaUpdate = z.object({
  op: z.literal("karma.update"),
  delta: z.number().int(),
  newTotal: z.number().int(),
  reason: z.string(),
});
export type KarmaUpdate = z.infer<typeof KarmaUpdate>;

export const ServerError = z.object({
  op: z.literal("error"),
  code: z.string(),
  message: z.string(),
});
export type ServerError = z.infer<typeof ServerError>;

export const Pong = z.object({
  op: z.literal("pong"),
  t: z.number(),
});
export type Pong = z.infer<typeof Pong>;

export const ServerMessage = z.discriminatedUnion("op", [
  Hello,
  PoolUpdate,
  VibeIncoming,
  VibeMatched,
  VibeFilled,
  VibeExpired,
  ServerSessionMessage,
  SessionEnded,
  KarmaUpdate,
  ServerError,
  Pong,
]);
export type ServerMessage = z.infer<typeof ServerMessage>;

// ─── helpers ─────────────────────────────────────────────────────────────────

export function encode(msg: ClientMessage | ServerMessage): string {
  return JSON.stringify(msg);
}

export function decodeClient(raw: string | unknown): ClientMessage {
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  return ClientMessage.parse(parsed);
}

export function decodeServer(raw: string | unknown): ServerMessage {
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  return ServerMessage.parse(parsed);
}
