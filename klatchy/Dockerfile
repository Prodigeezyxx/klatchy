# Multi-stage build for klatchy-server (TypeScript).
FROM node:20-alpine AS deps
RUN corepack enable
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
RUN pnpm install --frozen-lockfile --filter "@klatchy/server..."

FROM node:20-alpine AS build
RUN corepack enable
WORKDIR /app
COPY --from=deps /app /app
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY packages/server packages/server
RUN pnpm --filter "@klatchy/server..." build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/packages/shared/package.json packages/shared/
COPY --from=build /app/packages/server/dist packages/server/dist
COPY --from=build /app/packages/server/package.json packages/server/
COPY --from=build /app/node_modules node_modules
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:8787/api/v1/health || exit 1
CMD ["node", "packages/server/dist/index.js"]
