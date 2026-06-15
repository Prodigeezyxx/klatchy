import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth.js";
import { sql } from "../db/client.js";
import { getTotal } from "../karma.js";

export async function userRoutes(fastify: FastifyInstance) {
  fastify.get("/me", { preHandler: requireAuth }, async (req) => {
    const user = (req as any).user;
    const rows = await sql`SELECT * FROM users WHERE id = ${user.sub}`;
    if (rows.length === 0) throw { statusCode: 404, message: "user not found" };
    const u = rows[0]!;
    const karma = await getTotal(u.id);
    const tags = await sql`SELECT tag FROM user_tags WHERE user_id = ${u.id}`;
    return {
      userId: u.id,
      handle: u.handle,
      displayName: u.display_name ?? undefined,
      stack: tags.map((t: any) => t.tag),
      status: "available",
      karma,
      streak: 0,
      tier: u.tier,
    };
  });

  fastify.get("/users/:handle", async (req, reply) => {
    const { handle } = req.params as { handle: string };
    const rows = await sql`SELECT * FROM users WHERE handle = ${handle.replace(/^@/, "").toLowerCase()}`;
    if (rows.length === 0) {
      reply.status(404).send({ error: "user not found" });
      return;
    }
    const u = rows[0]!;
    const karma = await getTotal(u.id);
    const tags = await sql`SELECT tag FROM user_tags WHERE user_id = ${u.id}`;
    return {
      userId: u.id,
      handle: u.handle,
      displayName: u.display_name ?? undefined,
      stack: tags.map((t: any) => t.tag),
      status: "available",
      karma,
      streak: 0,
      tier: u.tier,
    };
  });
}
