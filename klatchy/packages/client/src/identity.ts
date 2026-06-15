import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { configDir } from "./config.js";

function credPath(): string {
  return join(configDir(), "credentials.json");
}

export function getJwt(): string | null {
  try {
    const data = JSON.parse(readFileSync(credPath(), "utf-8"));
    return data.jwt ?? null;
  } catch {
    return null;
  }
}

export function setJwt(jwt: string) {
  writeFileSync(credPath(), JSON.stringify({ jwt }, null, 2), "utf-8");
}

export function clearJwt() {
  try {
    writeFileSync(credPath(), JSON.stringify({}, null, 2), "utf-8");
  } catch {
    // ignore
  }
}

export async function deviceFlow(apiUrl: string): Promise<{ jwt: string; user: any }> {
  const api = apiUrl.replace(/\/$/, "");
  const res = await fetch(`${api}/api/v1/auth/github/device/start`, { method: "POST" });
  if (!res.ok) throw new Error(`server unreachable: ${res.status}`);
  const start = await res.json();

  console.log(`\n  ${chalk.bold.hex("#ff6fae")("klatchy")} · sign in with github\n`);
  console.log(`  1. open ${chalk.bold.hex("#7fe8d4").underline(start.verification_uri)}`);
  console.log(`  2. enter code ${chalk.bold.hex("#ff6fae")(start.user_code)}\n`);
  console.log(`  ${chalk.dim("waiting for github...")}\n`);

  try {
    const { default: open } = await import("open");
    open(start.verification_uri).catch(() => {});
  } catch {
    // browser open not critical
  }

  const deadline = Date.now() + (start.expires_in ?? 900) * 1000;
  let interval = Math.max(1, start.interval ?? 5);

  while (Date.now() < deadline) {
    await sleep(interval * 1000);
    const r = await fetch(`${api}/api/v1/auth/github/device/poll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_code: start.device_code }),
    });
    const data = await r.json();

    if (data.status === "pending") {
      if (data.slow_down) interval += 5;
      continue;
    }
    if (data.status === "ok") {
      console.log(`\n  ${chalk.bold.hex("#7fe8d4")("✓")} klatchy: authenticated as ${chalk.bold(`@${data.user.handle}`)}\n`);
      return { jwt: data.jwt, user: data.user };
    }
    throw new Error(data.error ?? "auth failed");
  }

  throw new Error("device code expired, try again");
}

export async function devLogin(
  apiUrl: string,
  handle: string,
  stack: string[],
): Promise<{ jwt: string; user: any }> {
  const api = apiUrl.replace(/\/$/, "");
  const res = await fetch(`${api}/api/v1/auth/dev/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ handle, stack }),
  });
  if (res.status === 403) {
    console.error(
      chalk.bold.red("klatchy:") +
        " server has dev-login disabled. Restart with KLATCHY_DEV_LOGIN=true",
    );
    process.exit(1);
  }
  if (!res.ok) {
    const body = await res.text();
    console.error(chalk.bold.red("klatchy:"), body);
    process.exit(1);
  }
  const data = await res.json();
  console.log(
    `\n  ${chalk.bold.hex("#7fe8d4")("✓")} klatchy: dev-login as ${chalk.bold(`@${data.user.handle}`)}\n`,
  );
  return { jwt: data.jwt, user: data.user };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

import chalk from "chalk";
