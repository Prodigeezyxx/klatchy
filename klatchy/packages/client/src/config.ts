import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import envPaths from "env-paths";

const paths = envPaths("klatchy", { suffix: "" });

export interface Config {
  serverUrl: string;
  apiUrl: string;
  handle?: string;
  theme: string;
  defaultDurationSec: number;
  quietHours: string[];
  autoPoolRefreshSec: number;
}

const DEFAULTS: Config = {
  serverUrl: "ws://localhost:8787",
  apiUrl: "http://localhost:8787",
  theme: "cozy-lofi",
  defaultDurationSec: 900,
  quietHours: [],
  autoPoolRefreshSec: 5,
};

export function configDir(): string {
  if (!existsSync(paths.config)) {
    mkdirSync(paths.config, { recursive: true });
  }
  return paths.config;
}

function configPath(): string {
  return join(configDir(), "config.json");
}

export function loadConfig(overrides?: Partial<Config>): Config {
  let file: Partial<Config> = {};
  try {
    file = JSON.parse(readFileSync(configPath(), "utf-8"));
  } catch {
    // use defaults
  }

  const envOverride = (key: string): string | undefined =>
    process.env[`KLATCHY_${key.toUpperCase()}`];

  return {
    serverUrl: overrides?.serverUrl ?? envOverride("server_url") ?? file.serverUrl ?? DEFAULTS.serverUrl,
    apiUrl: overrides?.apiUrl ?? envOverride("api_url") ?? file.apiUrl ?? DEFAULTS.apiUrl,
    handle: overrides?.handle ?? file.handle,
    theme: file.theme ?? DEFAULTS.theme,
    defaultDurationSec: file.defaultDurationSec ?? DEFAULTS.defaultDurationSec,
    quietHours: file.quietHours ?? DEFAULTS.quietHours,
    autoPoolRefreshSec: file.autoPoolRefreshSec ?? DEFAULTS.autoPoolRefreshSec,
  };
}

export function saveConfig(cfg: Config) {
  writeFileSync(configPath(), JSON.stringify(cfg, null, 2), "utf-8");
}
