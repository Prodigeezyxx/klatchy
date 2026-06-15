import { buildApp } from "./app.js";
import { settings } from "./settings.js";

const app = await buildApp();

try {
  await app.listen({ host: settings.bindHost, port: settings.bindPort });
  app.log.info(`klatchy-server ${settings.serverVersion} listening on ${settings.bindHost}:${settings.bindPort}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
