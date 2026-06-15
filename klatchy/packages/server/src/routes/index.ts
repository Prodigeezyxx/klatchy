import type { FastifyInstance } from "fastify";
import { healthRoutes } from "./health.js";
import { authRoutes } from "./auth.js";
import { userRoutes } from "./users.js";
import { sessionRoutes } from "./sessions.js";

export async function routes(fastify: FastifyInstance) {
  await fastify.register(healthRoutes);
  await fastify.register(authRoutes);
  await fastify.register(userRoutes);
  await fastify.register(sessionRoutes);
}
