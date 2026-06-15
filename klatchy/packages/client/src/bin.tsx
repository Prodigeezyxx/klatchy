import React from "react";
import { render } from "ink";
import { Command } from "commander";
import { loadConfig } from "./config.js";
import { getJwt, setJwt, clearJwt, deviceFlow, devLogin } from "./identity.js";
import { KlatchyClient } from "./ws.js";
import { ClientContext } from "./hooks/useClient.js";
import { App } from "./components/App.js";

const KLATCHY_VERSION = "0.1.0";

const program = new Command();

program
  .name("klatchy")
  .description("klatchy — bring the vibes back to coding")
  .version(KLATCHY_VERSION)
  .option("--server <url>", "WebSocket server URL")
  .option("--api <url>", "REST API URL")
  .option("--dev-login <handle>", "local-test: skip GitHub, sign in as HANDLE")
  .option("--stack <tags>", "comma-separated stack tags for --dev-login")
  .option("--logout", "clear credentials and exit")
  .option("--reauth", "force re-authentication")
  .action(async (opts) => {
    if (opts.logout) {
      clearJwt();
      console.log("✓ klatchy: signed out");
      return;
    }

    const cfg = loadConfig({
      serverUrl: opts.server,
      apiUrl: opts.api,
    });

    let jwt: string;
    if (opts.devLogin) {
      const stack = (opts.stack ?? "").split(",").map((s: string) => s.trim()).filter(Boolean);
      const result = await devLogin(cfg.apiUrl, opts.devLogin, stack);
      jwt = result.jwt;
    } else {
      jwt = opts.reauth ? "" : (getJwt() ?? "");
      if (!jwt) {
        const result = await deviceFlow(cfg.apiUrl);
        jwt = result.jwt;
        setJwt(jwt);
      }
    }

    const client = new KlatchyClient(cfg.serverUrl, jwt);
    // Start WS in background
    const wsPromise = client.run().catch(() => {});

    const { waitUntilExit } = render(
      <ClientContext.Provider value={client}>
        <App />
      </ClientContext.Provider>,
    );

    // On exit, clean up
    process.on("SIGINT", () => {
      client.stop();
      process.exit(0);
    });

    await waitUntilExit();
    client.stop();
    process.exit(0);
  });

program.parseAsync().catch((err: Error) => {
  console.error("klatchy:", err.message);
  process.exit(1);
});
