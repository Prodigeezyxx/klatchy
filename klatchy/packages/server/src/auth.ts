import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import { settings } from "./settings.js";
import type { FastifyRequest, FastifyReply } from "fastify";

export const TokenClaims = z.object({
  sub: z.string(),
  handle: z.string(),
  iat: z.number(),
  exp: z.number(),
});
export type TokenClaims = z.infer<typeof TokenClaims>;

export async function mintJwt(payload: { sub: string; handle: string }): Promise<string> {
  const secret = new TextEncoder().encode(settings.jwtSecret);
  return await new SignJWT({ sub: payload.sub, handle: payload.handle })
    .setProtectedHeader({ alg: settings.jwtAlgorithm })
    .setIssuedAt()
    .setExpirationTime(`${settings.jwtTtlHours}h`)
    .sign(secret);
}

export async function verifyJwt(token: string): Promise<TokenClaims> {
  const secret = new TextEncoder().encode(settings.jwtSecret);
  const { payload } = await jwtVerify(token, secret);
  return TokenClaims.parse(payload);
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    reply.status(401).send({ error: "missing bearer token" });
    return;
  }
  const token = header.slice(7).trim();
  try {
    const claims = await verifyJwt(token);
    (request as any).user = claims;
  } catch {
    reply.status(401).send({ error: "invalid token" });
  }
}

export function extractWsToken(subprotocols: string[] | undefined): string | null {
  if (!subprotocols) return null;
  for (const proto of subprotocols) {
    if (proto.startsWith("bearer.")) {
      return proto.slice(7);
    }
  }
  return null;
}
