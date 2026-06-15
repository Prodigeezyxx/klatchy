import fastifyCors from "@fastify/cors";
import fastifyWebsocket from "@fastify/websocket";
import Fastify from "fastify";
import { settings } from "./settings.js";
import { presence } from "./presence.js";
import { matchmaker } from "./matchmaker.js";
import { wsPlugin } from "./ws.js";
import { routes } from "./routes/index.js";
import { initDb, sql } from "./db/client.js";
export async function buildApp() {
  const app = Fastify({
    logger: {
      level: settings.logLevel,
      transport: { target: "pino-pretty" },
    },
  });

  await app.register(fastifyCors, { origin: true });
  await app.register(fastifyWebsocket);

  // Bootstrap
  await initDb();
  await presence.connect();
  matchmaker.start(async () => new Map());

  await app.register(routes, { prefix: "/api/v1" });
  await app.register(wsPlugin);

  app.addHook("onClose", async () => {
    await matchmaker.stop();
    await presence.close();
    await sql.end();
  });

  return app;
}
