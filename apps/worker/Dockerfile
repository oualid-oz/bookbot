# Build from the repo root so workspace packages are available:
#   docker build -f apps/worker/Dockerfile .
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/worker/package.json apps/worker/
COPY packages/db/package.json packages/db/
COPY packages/core/package.json packages/core/
COPY packages/shared/package.json packages/shared/
COPY packages/storage/package.json packages/storage/
RUN npm ci --omit=dev --workspace=worker --include-workspace-root=false

COPY packages/db packages/db
COPY packages/core packages/core
COPY packages/shared packages/shared
COPY packages/storage packages/storage
COPY apps/worker apps/worker

# Use STORAGE_DRIVER=r2 (or s3) in production. With the local driver, mount
# a volume shared with the web app here.
ENV STORAGE_LOCAL_DIR=/app/.data/storage

WORKDIR /app/apps/worker
CMD ["npx", "tsx", "src/index.ts"]
