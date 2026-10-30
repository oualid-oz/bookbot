# Build from the repo root:  docker build -f apps/worker/Dockerfile -t bookbot-worker .
# Also runs migrations:      docker run --rm -e DATABASE_URL=... bookbot-worker npm run db:migrate
FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/worker/package.json apps/worker/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
COPY packages/storage/package.json packages/storage/
# Retry flaky registry connections; the cache mount reuses downloads across builds
ENV npm_config_fetch_retries=5 npm_config_fetch_retry_mintimeout=20000 npm_config_fetch_retry_maxtimeout=120000
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --workspace=worker --workspace=@bookbot/db --include-workspace-root=false --prefer-offline

COPY packages/core packages/core
COPY packages/db packages/db
COPY packages/shared packages/shared
COPY packages/storage packages/storage
COPY apps/worker apps/worker

# Local storage driver writes here; mount a volume shared with the web app.
# Use STORAGE_DRIVER=r2 (or s3) in production instead.
ENV NODE_ENV=production STORAGE_LOCAL_DIR=/data/storage WORKER_HEALTH_PORT=3001
RUN mkdir -p /data/storage && chown -R node:node /data
USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:3001/health >/dev/null || exit 1
WORKDIR /app/apps/worker
CMD ["npx", "tsx", "src/index.ts"]
