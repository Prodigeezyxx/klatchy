import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { settings } from "../settings.js";
import { mintJwt, requireAuth } from "../auth.js";
import { sql } from "../db/client.js";
import { getTotal } from "../karma.js";
import { nanoid } from "nanoid";
import crypto from "node:crypto";

export async function authRoutes(fastify: FastifyInstance) {
  // ── GitHub device flow ──

  fastify.post("/auth/github/device/start", async () => {
    if (!settings.githubClientId) {
      throw { statusCode: 500, message: "github_client_id not configured" };
    }
    const res = await fetch("https://github.com/login/device/code", {
      method: "POST",
      headers: { "Accept": "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: settings.githubClientId, scope: "read:user" }),
    });
    const data: any = await res.json();
    return {
      user_code: data.user_code,
      verification_uri: data.verification_uri,
      device_code: data.device_code,
      interval: data.interval ?? 5,
      expires_in: data.expires_in ?? 900,
    };
  });

  const PollBody = z.object({
    device_code: z.string(),
  });

  fastify.post("/auth/github/device/poll", async (req) => {
    const { device_code } = PollBody.parse(req.body);
    if (!settings.githubClientId) {
      throw { statusCode: 500, message: "github_client_id not configured" };
    }

    const res = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Accept": "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: settings.githubClientId,
        device_code,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      }),
    });
    const data: any = await res.json();

    if (data.error) {
      if (data.error === "authorization_pending") return { status: "pending", slow_down: false };
      if (data.error === "slow_down") return { status: "pending", slow_down: true };
      return { status: "error", error: data.error_description ?? data.error };
    }

    const accessToken = data.access_token;
    const ghRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json" },
    });
    const gh: any = await ghRes.json();

    // Upsert user
    const existing = await sql`SELECT * FROM users WHERE github_id = ${gh.id}`;
    let userId: string;
    if (existing.length > 0) {
      userId = existing[0]!.id;
      await sql`
        UPDATE users SET handle = ${(gh.login as string).toLowerCase()}, display_name = ${gh.name ?? gh.login}, avatar_url = ${gh.avatar_url ?? null}, bio = ${gh.bio ?? null}, last_seen_at = now()
        WHERE id = ${userId}
      `;
    } else {
      userId = nanoid(32);
      await sql`
        INSERT INTO users (id, github_id, handle, display_name, avatar_url, bio)
        VALUES (${userId}, ${gh.id}, ${(gh.login as string).toLowerCase()}, ${gh.name ?? gh.login}, ${gh.avatar_url ?? null}, ${gh.bio ?? null})
      `;
    }

    const jwt = await mintJwt({ sub: userId, handle: (gh.login as string).toLowerCase() });
    const karma = await getTotal(userId);
    const tags = await sql`SELECT tag FROM user_tags WHERE user_id = ${userId}`;

    return {
      status: "ok",
      jwt,
      user: {
        userId,
        handle: (gh.login as string).toLowerCase(),
        displayName: gh.name ?? gh.login,
        stack: tags.map((t: any) => t.tag),
        status: "available",
        karma,
        streak: 0,
        tier: "free",
      },
    };
  });

  // ── Dev login bypass ──

  const DevLoginBody = z.object({
    handle: z.string().min(1).max(32),
    stack: z.array(z.string()).default([]),
  });

  fastify.post("/auth/dev/login", async (req) => {
    if (!settings.devLogin) {
      throw { statusCode: 403, message: "dev_login disabled — set KLATCHY_DEV_LOGIN=true" };
    }
    const { handle: rawHandle, stack } = DevLoginBody.parse(req.body);
    const handle = rawHandle.replace(/^@/, "").toLowerCase().trim();

    // Synthesize a negative github_id that won't collide with real ones
    const hash = crypto.createHash("sha256").update(`dev:${handle}`).digest();
    const fakeGithubId = -(parseInt(hash.subarray(0, 7).toString("hex"), 16) | 1);

    const existing = await sql`SELECT * FROM users WHERE handle = ${handle}`;
    let userId: string;
    if (existing.length > 0) {
      userId = existing[0]!.id;
    } else {
      userId = nanoid(32);
      await sql`
        INSERT INTO users (id, github_id, handle, display_name)
        VALUES (${userId}, ${fakeGithubId}, ${handle}, ${handle})
      `;
    }

    // Reset tags
    await sql`DELETE FROM user_tags WHERE user_id = ${userId}`;
    for (const tag of stack) {
      await sql`INSERT INTO user_tags (user_id, tag) VALUES (${userId}, ${tag.trim().toLowerCase()})`;
    }

    const jwt = await mintJwt({ sub: userId, handle });
    const karma = await getTotal(userId);
    const tags = await sql`SELECT tag FROM user_tags WHERE user_id = ${userId}`;

    return {
      jwt,
      user: {
        userId,
        handle,
        displayName: handle,
        stack: tags.map((t: any) => t.tag),
        status: "available",
        karma,
        streak: 0,
        tier: "free",
      },
    };
  });
}
