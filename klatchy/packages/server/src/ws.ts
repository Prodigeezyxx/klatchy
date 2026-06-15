import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import { decodeClient, encode } from "@klatchy/shared";
import type { ClientMessage, DevPublic, ServerMessage, Status } from "@klatchy/shared";
import { verifyJwt, extractWsToken } from "./auth.js";
import { presence } from "./presence.js";
import { matchmaker } from "./matchmaker.js";
import { award, getTotal, KARMA_REASONS } from "./karma.js";
import { sql } from "./db/client.js";
import { nanoid } from "nanoid";
import Redis from "ioredis";
import { MiniRedis } from "./mini-redis.js";
import { settings } from "./settings.js";

interface Conn {
  userId: string;
  handle: string;
  ws: WebSocket;
  sessions: Set<string>;
}

const connections = new Map<string, Conn>();

async function getUserRow(userId: string) {
  const rows = await sql`SELECT * FROM users WHERE id = ${userId}`;
  return rows[0] ?? null;
}

async function getKarma(userId: string): Promise<number> {
  return getTotal(userId);
}

function devPublicFromRow(row: any, match = 0): DevPublic {
  return {
    userId: row.id,
    handle: row.handle,
    displayName: row.display_name ?? undefined,
    stack: row.tags ?? [],
    status: "available" as Status,
    karma: row.karma ?? 0,
    streak: 0,
    match,
    tier: row.tier ?? "free",
  };
}

async function buildDevPublic(userId: string): Promise<DevPublic> {
  const user = await getUserRow(userId);
  const k = await getKarma(userId);
  const tags = await sql`SELECT tag FROM user_tags WHERE user_id = ${userId}`;
  return {
    userId: userId,
    handle: user!.handle,
    displayName: user!.display_name ?? undefined,
    stack: tags.map((t: any) => t.tag),
    status: await presence.getStatus(userId),
    karma: k,
    streak: 0,
    match: 0,
    tier: user!.tier ?? "free",
  };
}

export const wsPlugin = async function (fastify: FastifyInstance) {
  fastify.get("/ws", { websocket: true }, (socket, req) => {
    const subprotocols = req.headers["sec-websocket-protocol"];
    const protos = typeof subprotocols === "string" ? [subprotocols] : subprotocols ?? [];
    const token = extractWsToken(protos);
    if (!token) {
      socket.close(4401);
      return;
    }

    verifyJwt(token)
      .then(async (claims) => {
        const user = await getUserRow(claims.sub);
        if (!user) {
          socket.close(4401);
          return;
        }

        const conn: Conn = {
          userId: claims.sub,
          handle: claims.handle,
          ws: socket,
          sessions: new Set(),
        };
        connections.set(claims.sub, conn);

        await presence.setStatus(claims.sub, "available");

        // Subscribe to Redis pubsub for this user
        const sub = settings.redisUrl ? new Redis(settings.redisUrl) : new MiniRedis();
        await sub.subscribe("presence", `vibe:${claims.sub}`);

        sub.on("message", async (channel, raw) => {
          let payload: any;
          try {
            payload = JSON.parse(raw);
          } catch {
            return;
          }
          // Re-publish as server message
          const kind = payload?.kind as string | undefined;
          if (!kind) return;

          if (channel.startsWith("vibe:")) {
            if (kind === "incoming") {
              send(socket, { op: "vibe.incoming", request: payload.data });
            } else if (kind === "matched") {
              send(socket, { op: "vibe.matched", ...payload.data });
              conn.sessions.add(payload.data.sessionId);
              await sub.subscribe(`session:${payload.data.sessionId}`);
            } else if (kind === "filled") {
              send(socket, { op: "vibe.filled", ...payload.data });
            }
          } else if (channel.startsWith("session:")) {
            if (kind === "message" && payload.data?.fromUserId !== claims.sub) {
              send(socket, { op: "session.message", ...payload.data });
            } else if (kind === "ended") {
              send(socket, { op: "session.ended", ...payload.data });
              conn.sessions.delete(payload.data.sessionId);
              await sub.unsubscribe(`session:${payload.data.sessionId}`);
            } else if (kind === "karma") {
              send(socket, { op: "karma.update", ...payload.data });
            }
          } else if (channel === "presence") {
            // pool update sent on timer
          }
        });

        // Send hello
        const hello = await buildDevPublic(claims.sub);
        send(socket, {
          op: "hello",
          me: hello,
          serverVersion: settings.serverVersion,
          serverTime: Date.now(),
        });

        // Pool snapshot
        send(socket, {
          op: "pool.update",
          users: matchmaker.getPoolFor(claims.sub),
        });

        // Heartbeat
        const hb = setInterval(() => presence.heartbeat(claims.sub), 10_000);

        // Pool push
        const poolPush = setInterval(() => {
          if (socket.readyState === socket.OPEN) {
            send(socket, {
              op: "pool.update",
              users: matchmaker.getPoolFor(claims.sub),
            });
          }
        }, 5_000);

        // Reader
        socket.on("message", async (raw: Buffer) => {
          try {
            const msg = decodeClient(raw.toString()) as ClientMessage;
            await dispatch(claims.sub, msg, conn);
          } catch (err: any) {
            send(socket, { op: "error", code: "bad_request", message: err.message });
          }
        });

        socket.on("close", async () => {
          clearInterval(hb);
          clearInterval(poolPush);
          connections.delete(claims.sub);
          await presence.disconnect(claims.sub);
          await sub.quit();
        });
      })
      .catch(() => {
        socket.close(4401);
      });
  });
};

function send(ws: WebSocket, msg: ServerMessage | Record<string, unknown>) {
  if (ws.readyState === ws.OPEN) {
    ws.send(encode(msg as any));
  }
}

async function dispatch(userId: string, msg: ClientMessage, conn: Conn) {
  switch (msg.op) {
    case "ping":
      send(conn.ws, { op: "pong", t: msg.t });
      break;

    case "presence.set":
      await presence.setStatus(userId, msg.status);
      break;

    case "room.join":
      await sql`
        INSERT INTO room_members (room, user_id) VALUES (${msg.room}, ${userId}) ON CONFLICT DO NOTHING
      `.catch(() => {});
      break;

    case "room.leave":
      await sql`DELETE FROM room_members WHERE room = ${msg.room} AND user_id = ${userId}`.catch(() => {});
      break;

    case "vibe.send": {
      const vibeId = nanoid(32);
      const tags = msg.tags ?? [];
      await sql`
        INSERT INTO vibe_requests (id, sender_id, message, tags, duration_sec, target_handle, target_room)
        VALUES (${vibeId}, ${userId}, ${msg.message}, ${sql.array(tags)}, ${msg.durationSec ?? 900}, ${msg.targetHandle ?? null}, ${msg.targetRoom ?? null})
      `;

      const sender = await buildDevPublic(userId);
      const candidates = matchmaker.rank(userId, new Set(tags), {
        targetHandle: msg.targetHandle,
      });

      if (candidates.length === 0) {
        send(conn.ws, { op: "error", code: "no_candidates", message: "no matching dev online" });
        return;
      }

      for (const cand of candidates) {
        await presence.publishToUser(cand.userId, {
          kind: "incoming",
          data: {
            vibeId,
            sender,
            message: msg.message,
            tags,
            durationSec: msg.durationSec ?? 900,
            match: cand.match,
          },
        });
      }

      // Expire after vibeTtlMs
      setTimeout(async () => {
        await sql`
          UPDATE vibe_requests SET status = 'expired', expired_at = now()
          WHERE id = ${vibeId} AND status = 'pending'
        `.catch(() => {});
      }, settings.vibeTtlMs);
      break;
    }

    case "vibe.accept": {
      const rows = await sql`
        UPDATE vibe_requests
        SET status = 'matched', matched_with = ${userId}, matched_at = now()
        WHERE id = ${msg.vibeId} AND status = 'pending'
        RETURNING id, sender_id, duration_sec
      `;
      if (rows.length === 0) {
        send(conn.ws, { op: "error", code: "vibe_taken", message: "vibe no longer available" });
        return;
      }
      const row = rows[0]!;
      const sessionId = nanoid(32);
      await sql`
        INSERT INTO sessions (id, vibe_request_id, initiator_id, recipient_id)
        VALUES (${sessionId}, ${msg.vibeId}, ${row.sender_id}, ${userId})
      `;

      matchmaker.recordPairing(row.sender_id, userId);

      const senderDev = await buildDevPublic(row.sender_id);
      const recipientDev = await buildDevPublic(userId);

      await presence.publishToUser(row.sender_id, {
        kind: "matched",
        data: {
          sessionId,
          peer: recipientDev,
          role: "initiator",
          durationSec: row.duration_sec,
        },
      });
      await presence.publishToUser(userId, {
        kind: "matched",
        data: {
          sessionId,
          peer: senderDev,
          role: "recipient",
          durationSec: row.duration_sec,
        },
      });
      break;
    }

    case "vibe.decline":
      // no-op in P1
      break;

    case "session.message": {
      const sessRows = await sql`
        SELECT 1 FROM sessions WHERE id = ${msg.sessionId} AND ended_at IS NULL
        AND (initiator_id = ${userId} OR recipient_id = ${userId})
      `;
      if (sessRows.length === 0) {
        send(conn.ws, { op: "error", code: "no_session", message: "session not active" });
        return;
      }

      const payload = {
        sessionId: msg.sessionId,
        fromHandle: conn.handle,
        fromUserId: userId,
        kind: msg.kind,
        body: msg.body,
        meta: msg.meta ?? {},
        ts: Date.now(),
      };
      await presence.publishToSession(msg.sessionId, { kind: "message", data: payload });
      break;
    }

    case "session.end": {
      const sessRows = await sql`
        UPDATE sessions SET ended_at = now(), duration_sec = EXTRACT(EPOCH FROM now() - started_at)::INT, end_reason = 'ended'
        WHERE id = ${msg.sessionId} AND ended_at IS NULL
        AND (initiator_id = ${userId} OR recipient_id = ${userId})
        RETURNING initiator_id, recipient_id
      `;
      if (sessRows.length === 0) return;
      const s = sessRows[0]!;

      // Award karma
      for (const uid of [s.initiator_id, s.recipient_id]) {
        await award(uid, 5, KARMA_REASONS.SESSION_COMPLETE, msg.sessionId);
      }

      const endPayload = { sessionId: msg.sessionId, reason: "ended" };
      await presence.publishToSession(msg.sessionId, { kind: "ended", data: endPayload });

      // Push karma updates
      for (const uid of [s.initiator_id, s.recipient_id]) {
        const total = await getTotal(uid);
        await presence.publishToUser(uid, {
          kind: "karma",
          data: { delta: 5, newTotal: total, reason: "session.complete" },
        });
      }
      break;
    }

    case "session.rate": {
      const sessRows = await sql`
        SELECT initiator_id, recipient_id FROM sessions WHERE id = ${msg.sessionId} AND ended_at IS NOT NULL
      `;
      if (sessRows.length === 0) return;
      const s = sessRows[0]!;
      const rateeId = s.initiator_id === userId ? s.recipient_id : s.initiator_id;

      await sql`
        INSERT INTO ratings (session_id, rater_id, ratee_id, stars, comment)
        VALUES (${msg.sessionId}, ${userId}, ${rateeId}, ${msg.stars}, ${msg.comment ?? null})
        ON CONFLICT (session_id, rater_id) DO NOTHING
      `;

      if (msg.stars >= 4) {
        const total = await award(rateeId, 10 * msg.stars, KARMA_REASONS.RATING_RECEIVED, msg.sessionId);
        await presence.publishToUser(rateeId, {
          kind: "karma",
          data: { delta: 10 * msg.stars, newTotal: total, reason: "rating.received" },
        });
      }
      break;
    }
  }
}
