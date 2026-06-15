import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth.js";
import { sql } from "../db/client.js";

export async function sessionRoutes(fastify: FastifyInstance) {
  fastify.get("/sessions", { preHandler: requireAuth }, async (req) => {
    const user = (req as any).user;
    const limit = Math.min(parseInt((req.query as any)?.limit ?? "20"), 100);
    const rows = await sql`
      SELECT s.* FROM sessions s
      WHERE s.initiator_id = ${user.sub} OR s.recipient_id = ${user.sub}
      ORDER BY s.started_at DESC
      LIMIT ${limit}
    `;
    // Get peer handles
    const peerIds = rows.map((r: any) =>
      r.initiator_id === user.sub ? r.recipient_id : r.initiator_id,
    );
    const peers: Record<string, string> = {};
    if (peerIds.length > 0) {
      const peerRows = await sql`SELECT id, handle FROM users WHERE id IN ${sql(peerIds)}`;
      for (const p of peerRows) peers[p.id] = p.handle;
    }
    return rows.map((r: any) => ({
      id: r.id,
      peerHandle: peers[r.initiator_id === user.sub ? r.recipient_id : r.initiator_id] ?? "?",
      startedAt: new Date(r.started_at).getTime(),
      endedAt: r.ended_at ? new Date(r.ended_at).getTime() : null,
      durationSec: r.duration_sec,
    }));
  });
}
