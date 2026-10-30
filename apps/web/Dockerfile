# Build from the repo root:  docker build -f apps/web/Dockerfile -t bookbot-web .
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
COPY packages/puzzles/package.json packages/puzzles/
COPY packages/shared/package.json packages/shared/
COPY packages/storage/package.json packages/storage/
# Retry flaky registry connections; the cache mount reuses downloads across builds
ENV npm_config_fetch_retries=5 npm_config_fetch_retry_mintimeout=20000 npm_config_fetch_retry_maxtimeout=120000
RUN --mount=type=cache,target=/root/.npm npm ci --workspace=web --include-workspace-root=false --prefer-offline

FROM deps AS build
ENV NEXT_TELEMETRY_DISABLED=1
COPY base-tsconfig.json tsconfig.json ./
COPY packages packages
COPY apps/web apps/web
RUN npm run build -w web

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
# Standalone server plus the static assets it serves
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
CMD ["node", "apps/web/server.js"]
