import { z } from "zod";

const raw: Record<string, string | undefined> = {
  jwtSecret: process.env.KLATCHY_JWT_SECRET,
  databaseUrl: process.env.KLATCHY_DATABASE_URL,
  redisUrl: process.env.KLATCHY_REDIS_URL,
  bindHost: process.env.KLATCHY_BIND_HOST,
  bindPort: process.env.KLATCHY_BIND_PORT,
  githubClientId: process.env.KLATCHY_GITHUB_CLIENT_ID,
  githubClientSecret: process.env.KLATCHY_GITHUB_CLIENT_SECRET,
  serverVersion: process.env.KLATCHY_SERVER_VERSION,
  logLevel: process.env.KLATCHY_LOG_LEVEL,
  matchmakerTopN: process.env.KLATCHY_MATCHMAKER_TOP_N,
  vibeTtlMs: process.env.KLATCHY_VIBE_TTL_MS,
  devLogin: process.env.KLATCHY_DEV_LOGIN,
};

const Settings = z.object({
  jwtSecret: z.string().min(16).default("dev-secret-change-me-to-32-bytes-minimum"),
  jwtAlgorithm: z.literal("HS256").default("HS256"),
  jwtTtlHours: z.coerce.number().default(720),
  databaseUrl: z.string().default("postgres://klatchy:klatchy@localhost:5432/klatchy"),
  redisUrl: z.string().default(""),
  bindHost: z.string().default("0.0.0.0"),
  bindPort: z.coerce.number().default(8787),
  githubClientId: z.string().default(""),
  githubClientSecret: z.string().default(""),
  serverVersion: z.string().default("0.1.0"),
  logLevel: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  matchmakerTopN: z.coerce.number().default(5),
  vibeTtlMs: z.coerce.number().default(60_000),
  devLogin: z.coerce.boolean().default(false),
});

export type Settings = z.infer<typeof Settings>;
export const settings: Settings = Settings.parse(raw);
