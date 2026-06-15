# klatchy — Engineering Handoff (P1 Prototype, TypeScript)

> **Audience:** an AI coding agent (Claude Code, Cursor, OpenCode) or a
> generalist engineer continuing this build from a cold start.
>
> **Goal:** ship the P1 prototype defined in `PRD.md` §9.2 as a
> TypeScript monorepo — `klatchy` (Ink CLI) + `klatchy-server`
> (Fastify + WebSocket) + Postgres + Redis, with GitHub OAuth device
> flow, real vibe send/accept/end, in-memory matchmaking, and karma.
> WebRTC is mocked in P1 (session content tunneled over signaling WS);
> real WebRTC + E2EE via `simple-peer` + `libsodium-wrappers` land in
> P2.
>
> **How to use this doc:** read §1, then build in the file order given
> in §4. Every file has an explicit purpose, a list of public exports,
> and notes on what it depends on. If you deviate, update this doc.
>
> ---
>
> **History note (read once, then skip):** This repo contains a v0
> Python spike at `client/`, `server/`, `shared/` (Python+Textual TUI +
> FastAPI). That code is functional and serves as the reference
> implementation for the protocol and matchmaking algorithm. The v1
> target — described by *this* document — is a TypeScript monorepo at
> `packages/`. **Do not edit the Python tree.** Port behavior file by
> file; once `packages/` reaches feature parity, the Python tree gets
> deleted in one commit.

---

## 1 · Mental Model

Three processes, one protocol, **one language end-to-end**.

```
┌────────────────────┐    WSS    ┌─────────────────────┐    pg/asyncpg ┌──────────┐
│  klatchy (TUI)     │◄─────────►│ klatchy-server      │◄─────────────►│ Postgres │
│  Ink + React + zod │           │ Fastify + WS + zod  │               └──────────┘
└────────────────────┘           │                     │    ioredis    ┌──────────┐
        ▲                        │                     │◄─────────────►│  Redis   │
        │ HTTPS                  └─────────────────────┘               └──────────┘
        │ OAuth device flow
        ▼
┌────────────────────┐
│   GitHub           │
└────────────────────┘
```

- **`@klatchy/shared`** is the single source of truth for every
  WebSocket message and DTO. Both client and server import it as a
  workspace dep. Schemas are zod; types are derived (`z.infer`). If a
  field is added on one side without updating this package, the
  TypeScript compiler breaks the build — that is the point.
- **Server (`@klatchy/server` → `klatchy-server`):** holds presence
  (Redis), persists identity / sessions / karma (Postgres via
  Drizzle), runs the matchmaker (in-process for P1), exposes a single
  `/ws` endpoint for the realtime protocol and a handful of REST
  endpoints for OAuth + history.
- **Client (`@klatchy/client` → `klatchy`):** Ink TUI. Owns connection
  lifecycle, Zustand store, GitHub OAuth device flow on first run,
  JWT in OS keychain (`keytar`), settings in
  `~/.config/klatchy/config.json`.

There is **one long-lived WebSocket per client**. All realtime traffic
flows over it. The server picks routing by `op`. No REST polling.

---

## 2 · Tech Choices & Rationale

| Concern | Choice | Why |
|---|---|---|
| Runtime | Node.js 20+ (also runs on Bun) | LTS, native `fetch`, native `node:test`. Bun is a drop-in for local dev. |
| Package mgr | pnpm + workspaces | Fast, deterministic, first-class workspace support. |
| Monorepo build | `tsup` per package | Zero-config esbuild wrapper, dual ESM/CJS, fast watch. |
| Client TUI | **Ink 5** + React 18 | Same stack as Claude Code and Gemini CLI. Yoga flexbox is excellent for the 3-pane layout. Component model maps cleanly to widgets. |
| Ink helpers | `ink-gradient`, `ink-big-text`, `ink-syntax-highlight`, `ink-text-input`, `ink-spinner`, `ink-link` | Cover banner, code blocks, composer, loading states. |
| Client state | **Zustand** | Minimal, no Context boilerplate; vanilla store callable from non-React code (WS layer) without hooks. |
| WS client | `ws` (node) | Battle-tested, lightweight. No socket.io — we own the protocol. |
| WebRTC (P2) | `simple-peer` + `@roamhq/wrtc` | Standard Node WebRTC stack. P1 stubs this. |
| Keychain | `keytar` | Cross-platform: Keychain / Credential Manager / libsecret. |
| Config dirs | `env-paths` | Spec-correct XDG / macOS / Windows paths. |
| CLI parsing | `commander` | Tiny, ergonomic, supports nested commands. |
| Server fw | **Fastify 4** + `@fastify/websocket` | Faster than Express, idiomatic plugin model, native zod via `fastify-type-provider-zod`. |
| ORM | **Drizzle** + `postgres` driver | Best TS ergonomics, SQL-first, migrations as code. |
| Redis | `ioredis` | Robust, supports pubsub + cluster. |
| Auth | GitHub OAuth **device flow** + `jose` (JWT HS256) | Browser-less, perfect for CLIs. `jose` is the modern, edge-compatible JWT lib. |
| Validation | **zod** | Shared schemas across packages. |
| Logging | `pino` | Structured, fast, plays well with Fastify. |
| Tests | `vitest` | TypeScript-first; same config in every package. |
| Deploy | Docker → Fly.io single region | Per PRD §7.3. |

**Why HS256 not RS256 for JWT?** P1 single server signs and verifies.
Move to RS256 / EdDSA when we split signaling out.

**Why server-tunneled session content in P1?** PRD §9.2 explicitly
allows this for trusted alpha testers. Lets us validate UX before
shipping WebRTC.

**Why Ink over a custom renderer?** Yoga (Facebook's flexbox engine)
already solves the 3-pane layout. React's component model makes the
"pool / session / context" partitioning ergonomic. We get widget
diffing for free.

---

## 3 · Project Layout (final)

```
klatchy/
├── HANDOFF.md                       ← this file
├── PRD.md
├── README.md
├── package.json                     ← workspaces root; scripts: dev, build, test, lint
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .env.example
├── .gitignore
├── .nvmrc                           ← node 20
├── docker-compose.yml               ← Postgres + Redis + server
├── Dockerfile                       ← server image (multi-stage)
├── fly.toml                         ← Fly.io deploy
│
├── packages/
│   ├── shared/                      ← @klatchy/shared
│   │   ├── package.json
│   │   ├── tsup.config.ts
│   │   ├── src/
│   │   │   ├── index.ts             ← barrel
│   │   │   ├── protocol.ts          ← zod schemas + types for every WS op
│   │   │   ├── dto.ts               ← DevPublic, VibeRequestPublic, SessionInfo
│   │   │   └── constants.ts         ← TIERS, ROOMS, KARMA_REASONS
│   │
│   ├── server/                      ← @klatchy/server (bin: klatchy-server)
│   │   ├── package.json
│   │   ├── tsup.config.ts
│   │   ├── drizzle.config.ts
│   │   ├── src/
│   │   │   ├── index.ts             ← bin entry: build app + listen
│   │   │   ├── settings.ts          ← env config (zod-validated)
│   │   │   ├── app.ts               ← Fastify factory + plugin registration
│   │   │   ├── db/
│   │   │   │   ├── client.ts        ← Drizzle + postgres client
│   │   │   │   ├── schema.ts        ← Drizzle table defs (mirrors PRD §7.5)
│   │   │   │   └── migrations/      ← drizzle-kit generated
│   │   │   ├── auth.ts              ← GitHub device flow + jose JWT mint/verify
│   │   │   ├── presence.ts          ← Redis presence + pubsub
│   │   │   ├── matchmaker.ts        ← in-memory ranked selection (PRD §FR-50-54)
│   │   │   ├── karma.ts             ← append-only ledger writes
│   │   │   ├── ws.ts                ← /ws handler + per-conn state machine
│   │   │   ├── rooms.ts             ← room membership
│   │   │   └── routes/
│   │   │       ├── health.ts
│   │   │       ├── auth.ts          ← device/start, device/poll, dev/login
│   │   │       ├── users.ts         ← /me, /users/:handle
│   │   │       └── sessions.ts      ← /sessions
│   │
│   └── client/                      ← @klatchy/client (bin: klatchy)
│       ├── package.json
│       ├── tsup.config.ts
│       ├── src/
│       │   ├── bin.tsx              ← entry: commander parse → render(<App />)
│       │   ├── config.ts            ← read/write ~/.config/klatchy/config.json
│       │   ├── identity.ts          ← keytar wrapper + device-flow CLI
│       │   ├── store.ts             ← Zustand store (pool, session, messages, me)
│       │   ├── ws.ts                ← KlatchyClient class: connect/reader/reconnect
│       │   ├── theme.ts             ← THEME colors (cozy-lofi default)
│       │   ├── slash.ts             ← slash-command parser + dispatch
│       │   ├── git.ts               ← captureDiff(), branchInfo()
│       │   ├── hooks/
│       │   │   ├── useStore.ts      ← typed selector helper
│       │   │   ├── useClient.ts     ← injected via React context
│       │   │   └── useToast.ts
│       │   └── components/
│       │       ├── App.tsx          ← root: layout + key bindings + toast host
│       │       ├── Banner.tsx       ← gradient wordmark + status
│       │       ├── PoolPanel.tsx
│       │       ├── DevCard.tsx
│       │       ├── SessionPanel.tsx
│       │       ├── Message.tsx
│       │       ├── Composer.tsx     ← <TextInput /> + slash hints
│       │       ├── ContextPanel.tsx ← branch / files / karma
│       │       ├── KarmaBar.tsx
│       │       ├── ToastHost.tsx    ← incoming-vibe modal w/ a/x bindings
│       │       └── Footer.tsx
│
└── tooling/
    ├── tsconfig.client.json
    ├── tsconfig.server.json
    └── tsconfig.shared.json
```

---

## 4 · Build Order

Each step lists: **(a)** what to write, **(b)** what it depends on,
**(c)** how to verify before moving on. Steps map 1:1 to the Python v0
spike for easy cross-reference.

### Step 0 — Repo scaffold

- Root `package.json` with `private: true`, `packageManager: "pnpm@9"`,
  `workspaces: ["packages/*"]`, scripts:
  ```json
  {
    "dev": "pnpm -r --parallel run dev",
    "build": "pnpm -r run build",
    "lint": "pnpm -r run lint",
    "test": "pnpm -r run test",
    "typecheck": "pnpm -r run typecheck"
  }
  ```
- `pnpm-workspace.yaml`: `packages: - "packages/*"`.
- `tsconfig.base.json`: `target: ES2022`, `module: ESNext`,
  `moduleResolution: Bundler`, `strict: true`, `noUncheckedIndexedAccess: true`.
- Each package extends the base with package-specific tsconfig
  (`lib: ["ES2022"]` for server, plus `"DOM"` only if needed for client).
- `.nvmrc` → `20`.
- `.env.example` carries every `KLATCHY_*` env var (see Step 1).

**Verify:** `pnpm install && pnpm typecheck` returns 0 with all
packages empty.

### Step 1 — `@klatchy/shared` (protocol)

The keystone. Build this first, both other packages depend on it.

`packages/shared/src/protocol.ts`:

- Define `Status`, `Tier`, `SessionRole` as `z.enum([...])`.
- Define `DevPublic`, `VibeRequestPublic`, `SessionInfo`,
  `ChatLine` as `z.object({...})`.
- Define **client → server** messages as a discriminated union on `op`:
  `presence.set`, `vibe.send`, `vibe.accept`, `vibe.decline`,
  `session.message`, `session.end`, `session.rate`,
  `room.join`, `room.leave`, `ping`.
- Define **server → client** messages: `hello`, `pool.update`,
  `vibe.incoming`, `vibe.matched`, `vibe.filled`, `vibe.expired`,
  `session.message`, `session.ended`, `karma.update`, `error`, `pong`.
- Export `ClientMessage`, `ServerMessage` types via `z.infer`.
- Export helpers `decodeClient(raw)`, `decodeServer(raw)`, `encode(msg)`.
  They take `string | Buffer | unknown`, parse via the union schema,
  throw `ZodError` on mismatch.

**Verify:** `pnpm --filter @klatchy/shared build && pnpm --filter
@klatchy/shared test` — round-trip test for each op:
`expect(decodeClient(encode(msg))).toEqual(msg)`.

### Step 2 — Server settings + DB

`packages/server/src/settings.ts`:

```ts
import { z } from "zod";
const Settings = z.object({
  jwtSecret: z.string().min(32).default("dev-secret-change-me-32-bytes-minimum-ok?"),
  jwtAlgorithm: z.literal("HS256").default("HS256"),
  jwtTtlHours: z.coerce.number().default(720),
  databaseUrl: z.string().default("postgres://klatchy:klatchy@localhost:5432/klatchy"),
  redisUrl: z.string().default("redis://localhost:6379/0"),
  bindHost: z.string().default("0.0.0.0"),
  bindPort: z.coerce.number().default(8787),
  githubClientId: z.string().default(""),
  githubClientSecret: z.string().default(""),
  serverVersion: z.string().default("0.1.0"),
  logLevel: z.enum(["fatal","error","warn","info","debug","trace"]).default("info"),
  matchmakerTopN: z.coerce.number().default(5),
  vibeTtlSec: z.coerce.number().default(60),
  devLogin: z.coerce.boolean().default(false),
});
export type Settings = z.infer<typeof Settings>;
export const settings: Settings = Settings.parse({
  jwtSecret: process.env.KLATCHY_JWT_SECRET,
  databaseUrl: process.env.KLATCHY_DATABASE_URL,
  redisUrl: process.env.KLATCHY_REDIS_URL,
  bindHost: process.env.KLATCHY_BIND_HOST,
  bindPort: process.env.KLATCHY_BIND_PORT,
  githubClientId: process.env.KLATCHY_GITHUB_CLIENT_ID,
  githubClientSecret: process.env.KLATCHY_GITHUB_CLIENT_SECRET,
  logLevel: process.env.KLATCHY_LOG_LEVEL,
  devLogin: process.env.KLATCHY_DEV_LOGIN,
  // … remaining fields fall through to defaults
});
```

`packages/server/src/db/schema.ts` — Drizzle tables, mirroring PRD §7.5:

- `users`, `userTags`, `vibeRequests`, `sessions`, `ratings`, `karmaEvents`.
- All IDs `text` (uuid4 hex) via `nanoid(32)` for portability.
- Indexes per PRD §7.5 conventions.

`packages/server/src/db/client.ts`:

- Export `db = drizzle(postgres(settings.databaseUrl), { schema })`.
- Export `initDb()` that runs migrations from `./migrations`.

Use `drizzle-kit generate` to produce migrations from `schema.ts`.
For the P1 prototype, a single initial migration is sufficient.

**Verify:** `klatchy-server` boots, migrations apply, `\dt` in psql
shows all six tables.

### Step 3 — Auth (`auth.ts`)

Implements PRD §FR-02 (GitHub OAuth device flow), plus the
dev-login bypass we already have on the Python side.

Public exports:

- `startDeviceFlow(clientId): Promise<DeviceCode>` — calls GitHub
  `/login/device/code`.
- `pollDeviceFlow(clientId, deviceCode): Promise<string>` — returns
  access token; throws `DeviceFlowError(code, message)` with
  recoverable codes `authorization_pending` / `slow_down`.
- `fetchGithubUser(accessToken): Promise<GithubUser>`.
- `upsertUserFromGithub(db, gh): Promise<User>`.
- `mintJwt(user): string` — via `jose.SignJWT`.
- `verifyJwt(token): Promise<TokenClaims>` — via `jose.jwtVerify`.
- `requireAuth` — Fastify preHandler that reads
  `Authorization: Bearer ...` and attaches `request.user`.
- `extractWsToken(subprotocols): string | null` — parse
  `Sec-WebSocket-Protocol: bearer.<jwt>` (PRD §7.6).

JWT payload: `{ sub: userId, handle, iat, exp }`. Never log GitHub
access tokens. Discard them after `/user` fetch.

### Step 4 — Presence (`presence.ts`)

ioredis-backed, identical key scheme to the Python v0:

- `presence:status:{userId}` STRING, TTL 30s
- `presence:online` SET
- `vibe:{userId}` PUBSUB
- `session:{sessionId}` PUBSUB
- `room:{name}:members` SET

Export a `Presence` class with `connect()`, `setStatus()`,
`heartbeat()`, `getStatus()`, `disconnect()`, `snapshot()`,
`publishToUser()`, `publishToSession()`, `subscribeFor(userId)`,
`subscribeSession(ps, sid)`, `unsubscribeSession(ps, sid)`,
`roomJoin()`, `roomLeave()`, `roomMembers()`. Background
housekeeping task reaps dead online-set entries.

### Step 5 — Matchmaker (`matchmaker.ts`)

Port the scoring function from `server/klatchy_server/matchmaker.py`
verbatim. PRD §FR-50 weights:

```
0.35 * stackOverlap (Jaccard)
+ 0.20 * karmaNorm (log10(karma+1)/4, capped at 1.0)
+ 0.15 * recencyPenalty (0 if paired in last hour else 1)
+ 0.10 * tzProximity
+ 0.10 * priorPositive ? 1 : 0
+ 0.10 * vibeTagAlign (Jaccard of explicit tags)
```

Refresh in-memory pool snapshot every 5s. Expose:

- `getPoolFor(viewerId): DevPublic[]`
- `rank(senderId, tags, opts): DevPublic[]`
- `recordPairing(a, b)`, `recordPositive(a, b)`
- `start()`, `stop()`

### Step 6 — WS endpoint (`ws.ts`)

The heart. One WebSocket per client. Per-connection state machine:

```
connected → authenticated → in_pool → [in_session(s)] → closed
```

Lifecycle (inside the Fastify `wsHandler`):

1. Pull JWT from `request.headers["sec-websocket-protocol"]`
   (Fastify exposes the raw header). Reject 4401 if missing/invalid.
2. Echo the matching subprotocol on accept (browsers ignore but
   the `ws` client requires it).
3. Load user; register with presence (`available`).
4. Send `hello` + first `pool.update` immediately.
5. Spawn per-connection tasks:
   - **reader:** `socket.on('message', raw => dispatch(...))`
   - **writer:** bounded queue (`p-queue` size 256) drained to
     `socket.send`. Critical messages (`vibe.matched`,
     `session.message`, `session.ended`) bypass the cap.
   - **fanout:** `ioredis` duplicate connection subscribed to
     `presence`, `vibe:{userId}`; subscribe/unsubscribe to
     `session:{sid}` channels as sessions open/close.
   - **heartbeat:** `setInterval` 10s → `presence.heartbeat(userId)`.
   - **poolPush:** `setInterval` 5s → `pool.update` snapshot.
6. On close: cancel all intervals, unsubscribe Redis, set
   presence offline.

Dispatch table — one async function per op, same semantics as the
Python `_dispatch`. Use **Postgres CAS** for `vibe.accept`:

```ts
const claimed = await db.execute(sql`
  UPDATE vibe_requests
  SET status='matched', matched_with=${userId}, matched_at=now()
  WHERE id=${vibeId} AND status='pending'
  RETURNING id, sender_id, duration_sec
`);
if (!claimed.rows.length) { return error("vibe_taken"); }
```

### Step 7 — Karma (`karma.ts`)

Tiny module. `award(db, userId, delta, reason, refId?)` inserts an
event and returns the new total. `getTotal(db, userId)` does the sum.
Reason constants: `session.complete`, `rating.received`, etc. per
PRD §FR-70.

### Step 8 — Routes (`routes/*.ts`)

Each file exports a Fastify plugin. Mount at `/api/v1` from `app.ts`:

- `health.ts` — `GET /health`.
- `auth.ts` — `POST /auth/github/device/start`,
  `POST /auth/github/device/poll`, `POST /auth/dev/login`
  (the last guarded by `settings.devLogin`).
- `users.ts` — `GET /me`, `GET /users/:handle`.
- `sessions.ts` — `GET /sessions?limit=20`.

All inputs/outputs declared via zod schemas + the
`fastify-type-provider-zod` so OpenAPI is auto-generated at
`/api/v1/openapi.json`.

### Step 9 — Server entrypoint (`app.ts` + `index.ts`)

```ts
// app.ts
export async function buildApp() {
  const app = Fastify({ logger: { level: settings.logLevel } });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  await app.register(fastifyCors, { origin: true });
  await app.register(fastifyWebsocket);
  await initDb();
  await presence.connect(settings.redisUrl);
  await matchmaker.start();
  await app.register(routes, { prefix: "/api/v1" });
  await app.register(wsPlugin);    // mounts /ws
  app.addHook("onClose", async () => {
    await matchmaker.stop();
    await presence.close();
  });
  return app;
}
```

```ts
// index.ts
const app = await buildApp();
await app.listen({ host: settings.bindHost, port: settings.bindPort });
```

**Verify server end of build:** `pnpm --filter @klatchy/server dev`
boots cleanly against `docker compose up postgres redis`, and
`curl http://localhost:8787/api/v1/health` returns `{ok:true}`.

### Step 10 — Client config + identity

`packages/client/src/config.ts`:

- Use `env-paths('klatchy', { suffix: '' })` to resolve config dir.
- `Config` zod schema with `serverUrl`, `apiUrl`, `handle`, `theme`,
  `defaultDurationSec`, `quietHours[]`, `autoPoolRefreshSec`.
- `load()` reads `config.json`, applies `KLATCHY_SERVER_URL` /
  `KLATCHY_API_URL` env overrides, returns parsed config.
- `save(cfg)` writes pretty JSON.

`packages/client/src/identity.ts`:

- `getJwt()` / `setJwt(jwt)` / `clearJwt()` via `keytar`
  (service `"klatchy"`, account `"default"`).
- `deviceFlow(apiUrl): Promise<{jwt, user}>`:
  - POST `/api/v1/auth/github/device/start`, print
    `user_code` + `verification_uri` via `ink` static render OR via
    `chalk` to stdout (this runs before `<App />` mounts), call
    `open(verification_uri)` (`open` npm package).
  - Poll `/api/v1/auth/github/device/poll` every `interval` s.
- `devLogin(apiUrl, handle, stack)` for the local bypass.

### Step 11 — Zustand store (`store.ts`)

```ts
type State = {
  me: DevPublic | null;
  pool: DevPublic[];
  incomingVibe: VibeRequestPublic | null;
  activeSession: SessionInfo | null;
  messages: ChatLine[];
  lastError: string | null;
  // actions
  apply: (msg: ServerMessage) => void;
  appendLocal: (body: string, kind?: ChatKind) => void;
};
export const useStore = create<State>((set, get) => ({ /* ... */ }));
```

`apply(msg)` is the dispatch. Mirrors `AppState.apply` from the Python
v0 — same kinds, same side effects, just immutable updates via
`set(state => ({...}))`. Because Zustand is callable outside React
(`useStore.getState()` / `useStore.subscribe`), the WS layer doesn't
need hooks.

### Step 12 — KlatchyClient (`ws.ts`)

```ts
class KlatchyClient {
  constructor(serverUrl: string, jwt: string) { /* ... */ }
  async run(): Promise<void>      // connect + reader + reconnect backoff
  async stop(): Promise<void>
  // sends
  setPresence(status: Status): Promise<void>
  sendVibe(...): Promise<void>
  acceptVibe(vibeId: string): Promise<void>
  declineVibe(vibeId: string): Promise<void>
  sendSessionMessage(sid, body, kind?): Promise<void>
  endSession(sid: string): Promise<void>
  rateSession(sid: string, stars: number, comment?: string): Promise<void>
  joinRoom(room: string): Promise<void>
  leaveRoom(room: string): Promise<void>
}
```

Implementation notes:

- `new WebSocket(serverUrl + "/ws", [`bearer.${jwt}`])` — the second
  arg is `protocols` per `ws` API.
- Reader: `ws.on('message', raw => useStore.getState().apply(decodeServer(raw)))`.
- Reconnect with exponential backoff `[1,2,4,8,16,30]` s.
- Heartbeat: `setInterval` 25 s → `send(ping)`.

### Step 13 — Slash commands (`slash.ts`)

Pure function: `parse(raw: string) → SlashCommand | null`. Then a
`dispatch(client, store, cmd)` that handles each variant
(`/pair`, `/ask`, `/diff`, `/share`, `/ai`, `/rate`, `/end`, `/timer`).
Same semantics as Python `app.py:_handle_slash`. Keep dispatch
isolated from React so it's unit-testable with `vitest`.

### Step 14 — Components

Top-level layout from `App.tsx`:

```tsx
<Box flexDirection="column" height="100%">
  <Banner />
  <Box flexGrow={1}>
    <PoolPanel    width={34} />
    <SessionPanel flexGrow={1} />
    <ContextPanel width={38} />
  </Box>
  <Footer />
  <ToastHost />
</Box>
```

Per-component contract:

- `<Banner />` — gradient wordmark via `ink-gradient`, status line with
  current handle from `useStore(s => s.me?.handle)`.
- `<PoolPanel />` — selector subscribes to `pool`, renders one
  `<DevCard />` per dev. Selection state lives locally (useState).
- `<DevCard />` — pure render of a `DevPublic`. Status dot color from
  theme.
- `<SessionPanel />` — message list + `<Composer />`. Auto-scroll on
  new messages.
- `<Message />` — switches on `kind`: text vs code vs diff vs ai vs
  system. Code blocks use `ink-syntax-highlight`.
- `<Composer />` — `ink-text-input`. On submit, parse for slash and
  call `dispatch`.
- `<ContextPanel />` — branch info (call `git.ts`), file tree (read cwd),
  karma block, `<KarmaBar />`.
- `<KarmaBar />` — uses Ink's `<Box>` width math or `ink-progress-bar`.
- `<ToastHost />` — listens for `incomingVibe`. Renders a centered
  modal-ish overlay; `useInput` binds `a` (accept) and `x` (dismiss).
- `<Footer />` — key hints.

Key bindings live in `App.tsx`'s top-level `useInput`. Slash key (`/`)
focuses composer; `p`/`s`/`c` cycle panel focus via a context provider.

### Step 15 — bin entry (`bin.tsx`)

```tsx
const program = new Command();
program
  .name("klatchy")
  .description("klatchy — bring the vibes back to coding")
  .version(pkg.version)
  .option("--server <url>")
  .option("--api <url>")
  .option("--dev-login <handle>")
  .option("--stack <tags>")
  .option("--logout")
  .option("--reauth")
  .action(async (opts) => {
    if (opts.logout) { await clearJwt(); return; }
    const cfg = await Config.load(opts);
    let jwt: string;
    if (opts.devLogin) {
      ({ jwt } = await devLogin(cfg.apiUrl, opts.devLogin, parseStack(opts.stack)));
    } else {
      jwt = (opts.reauth ? null : await getJwt())
         ?? (await deviceFlow(cfg.apiUrl)).jwt;
      await setJwt(jwt);
    }
    const client = new KlatchyClient(cfg.serverUrl, jwt);
    void client.run();
    render(
      <ClientProvider client={client}>
        <App />
      </ClientProvider>
    );
  });
program.parseAsync();
```

### Step 16 — Deploy

`Dockerfile` (multi-stage):

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
RUN pnpm install --frozen-lockfile --filter "@klatchy/server..."

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app /app
COPY packages/shared packages/shared
COPY packages/server packages/server
COPY tsconfig.base.json tooling ./
RUN corepack enable && pnpm --filter "@klatchy/server..." build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/packages/shared/package.json packages/shared/
COPY --from=build /app/packages/server/dist packages/server/dist
COPY --from=build /app/packages/server/package.json packages/server/
COPY --from=build /app/node_modules node_modules
EXPOSE 8787
HEALTHCHECK CMD wget -qO- http://localhost:8787/api/v1/health || exit 1
CMD ["node", "packages/server/dist/index.js"]
```

`docker-compose.yml` — same Postgres + Redis + server topology as v0,
but `command: node packages/server/dist/index.js`.

`fly.toml` — unchanged from v0 (image-based deploy).

### Step 17 — Smoke tests

- `vitest` units for protocol round-trip, matchmaker scoring,
  slash parser.
- Two-window local test: identical to `docs/LOCAL_TEST.md`. Replace
  `klatchy --dev-login maya` with the same flag now backed by Node.

---

## 5 · Conventions & Gotchas

- **Time:** all server times are `timestamptz` UTC. Wire format is
  ms-since-epoch (`Date.now()`); client converts to local for display.
  *Note this differs from the Python v0 which used float seconds —
  pick one canonical and align the protocol package.*
- **IDs:** `nanoid(32)` (URL-safe, fits in `text`).
- **Errors:** server never closes a WS on bad input — always reply
  `{ op: "error", code, message }` and keep socket open.
- **Backpressure:** writer queue per connection bounded at 256. On
  overflow drop oldest **`pool.update`** only; never drop
  `vibe.matched`, `session.message`, `session.ended`.
- **Reconnect identity:** server treats reconnect as resume — presence
  restored from JWT, no re-auth.
- **React + WS hygiene:** WS lives outside React. Components only read
  from Zustand selectors and call `client.method()`. Never put the
  client into React state — it's a stable singleton per process.
- **Ink stdin gotcha:** if you `console.log` while Ink is rendering it
  corrupts the frame. Use `ink`'s `<Static>` for one-shot logs or
  Ink's `useStdout().write` outside the React tree.
- **`useInput` gotcha:** only the *topmost* `<App />` should bind
  global keys; toasts get focus via `isActive`. Two `useInput`
  listeners both reading the same key fire in registration order.
- **Secrets:** `KLATCHY_JWT_SECRET` MUST be ≥32 bytes in prod.
  `fly secrets set KLATCHY_JWT_SECRET=$(openssl rand -hex 32)`.
- **GitHub device flow:** the OAuth App must have **Device Flow
  enabled** in Settings → Developer settings. The client secret is
  optional for device flow.
- **Idempotent matching:** `vibe.accept` uses Postgres CAS (see
  Step 6). Race resolution is in the DB, not in JS.
- **Ports:** Drizzle migrations run on `initDb()`; do **not** run them
  from the Dockerfile build stage.
- **Bun compatibility:** Fastify + Drizzle + ioredis + ws all work on
  Bun. `keytar` does not — that's client-only and Bun on the *client*
  is opt-in (Node 20 is the supported runtime).

---

## 6 · Out of Scope for P1 (explicitly)

- Real WebRTC / E2EE (P2; `simple-peer` + `libsodium-wrappers`).
- TURN relay (P2).
- AI bridges — stub `/ai` for the demo.
- Billing / Stripe (P3).
- Themes beyond `cozy-lofi` (P3).
- Editor plugins (`tmux`, nvim, VS Code).

### P2+ — Collaborative Code Editing ("Collab Mode")

Beyond social pair-coding, klatchy should become a platform for
live collaborative development where devs can work on each other's
code directly. Planned capabilities:

- **Shared cursor & selection sync** — real-time awareness of where
  each collaborator is editing (like VS Code Live Share).
- **Workspace snapshot sharing** — one-click "share my workspace" that
  allows a partner to view/edit files in real time.
- **Patch apply** — accepting a code suggestion from a session applies
  it as a local diff, not just a chat message.
- **Git-integrated merge flows** — after a collab session, auto-generate
  a branch / PR with the combined work.
- **Read-eval-print loops (REPL)** — shared terminal or run-target
  within the TUI so partners can run code together.
- **Permission scopes** — read-only vs. read-write vs. full terminal
  per session participant.

Implementation approach: extend the WS protocol with `file.edit`,
`cursor.move`, `workspace.snapshot` ops. Use CRDTs (e.g. Yjs) for
conflict-free concurrent editing. Persist session checkpoints for
later replay.

---

## 7 · Status

| Step | Package · file(s) | Status |
|---|---|---|
| 0 | monorepo scaffold, `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json` | ⏳ |
| 1 | `@klatchy/shared` · `protocol.ts`, `dto.ts`, `constants.ts` | ⏳ |
| 2 | `@klatchy/server` · `settings.ts`, `db/{client,schema,migrations}` | ⏳ |
| 3 | `@klatchy/server` · `auth.ts` | ⏳ |
| 4 | `@klatchy/server` · `presence.ts` | ⏳ |
| 5 | `@klatchy/server` · `matchmaker.ts` | ⏳ |
| 6 | `@klatchy/server` · `ws.ts` | ⏳ |
| 7 | `@klatchy/server` · `karma.ts` | ⏳ |
| 8 | `@klatchy/server` · `routes/*.ts` | ⏳ |
| 9 | `@klatchy/server` · `app.ts`, `index.ts` | ⏳ |
| 10 | `@klatchy/client` · `config.ts`, `identity.ts`, `theme.ts` | ⏳ |
| 11 | `@klatchy/client` · `store.ts` | ⏳ |
| 12 | `@klatchy/client` · `ws.ts` (KlatchyClient) | ⏳ |
| 13 | `@klatchy/client` · `slash.ts`, `git.ts` | ⏳ |
| 14 | `@klatchy/client` · `components/*.tsx`, `hooks/*` | ⏳ |
| 15 | `@klatchy/client` · `bin.tsx` | ⏳ |
| 16 | `Dockerfile`, `docker-compose.yml`, `fly.toml` (update for node build) | ⏳ |
| 17 | smoke tests (`vitest` + local two-window) | ⏳ |

### Reference implementation (v0, Python — frozen)

| What | Where | Status |
|---|---|---|
| shared protocol | `shared/klatchy_shared/protocol.py` | ✅ working — port semantics 1:1 |
| server | `server/klatchy_server/*.py` | ✅ working — use as behavioral spec |
| client TUI | `client/klatchy/**/*.py` | ✅ working — Ink components mirror layout |
| local test bypass | `routes.py:dev_login`, `--dev-login HANDLE` | ✅ working — port to TS in Step 8 |
| docs | `docs/LOCAL_TEST.md` | ✅ — refresh once TS client ships |

**Migration rule:** every TS file in Step 1–17 must produce identical
WS traffic to its Python counterpart. Write a vitest case for each
op that compares JSON bytes against a fixture captured from the v0
server. When all match, delete `client/`, `server/`, `shared/`.

---

*end of HANDOFF*
