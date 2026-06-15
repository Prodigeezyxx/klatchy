import type { FastifyInstance } from "fastify";
import { settings } from "../settings.js";

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get("/health", async () => ({
    ok: true,
    version: settings.serverVersion,
  }));
}
