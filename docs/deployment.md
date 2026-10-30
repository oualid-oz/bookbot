# Deploying Bookbot

Bookbot runs as two services that share Postgres, Redis, and file storage:

- **web**: the Next.js app and API (`apps/web/Dockerfile`)
- **worker**: renders PDF exports from the Redis queue (`apps/worker/Dockerfile`)

`docker-compose.yml` runs the whole stack, including database migrations.

## Quick start (single server)

```bash
export NEXTAUTH_SECRET=$(openssl rand -base64 32)
export NEXTAUTH_URL=https://bookbot.example.com   # the public URL users open
docker compose up -d --build
```

Compose starts Postgres and Redis, runs migrations once (the `migrate` service), and only then starts `web` and `worker`. Put a reverse proxy (nginx, Caddy, a load balancer) with HTTPS in front of port 3000.

> **Reverse proxy required.** Rate limits read the client IP from `X-Real-IP`, or the last `X-Forwarded-For` entry. Without a proxy that sets these, clients can fake them.

Both services check their configuration at startup and refuse to start if something required is missing. The logs say exactly which settings to fix. Warnings (for example, emails going to the console) are logged but don't stop startup.

## Configuration

See `.env.example` for every setting. For production:

| Setting | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL`, `REDIS_URL` | Yes | Set by Compose when using its Postgres and Redis |
| `NEXTAUTH_SECRET` | Yes | At least 32 random characters |
| `NEXTAUTH_URL` | Yes | Public HTTPS URL; used in emails and Stripe redirects |
| `STORAGE_DRIVER` | Recommended: `r2` | `local` needs one volume shared by web and worker (Compose does this) |
| `R2_*` | With `r2` | Account ID, access key, secret, bucket |
| `STRIPE_*` | For billing | All four, or none. See [Billing](#billing) |
| `GOOGLE_CLIENT_ID/SECRET` | Optional | Both or neither. Redirect URI: `<NEXTAUTH_URL>/api/auth/callback/google` |
| `EMAIL_TRANSPORT` | Yes, for real email | Only `console` exists today. Add a provider in `apps/web/src/server/email.ts` |
| `POSTGRES_PASSWORD` | Recommended | Password for the Compose Postgres |

Pass settings through the environment or an env file: `docker compose --env-file .env.production up -d`.

## Migrations

Migrations live in `packages/db/drizzle/` and are applied with the runtime migrator:

```bash
npm run db:migrate                                        # from the repo
docker compose run --rm migrate                           # with Compose
docker run --rm -e DATABASE_URL=... bookbot-worker npm run db:migrate --prefix /app
```

Run them before starting a new version. Compose does this automatically. They are forward-only and safe to rerun.

## Health checks

| Service | Endpoint | Healthy when |
| --- | --- | --- |
| web | `GET /api/health` | Postgres and Redis respond (otherwise 503) |
| worker | `GET :3001/health` (set `WORKER_HEALTH_PORT`) | Queue worker running, Postgres and Redis respond |

Both Docker images define a `HEALTHCHECK` that uses these endpoints.

## File storage (Cloudflare R2)

Set `STORAGE_DRIVER=r2` and the `R2_*` settings. Browsers upload cover images straight to the bucket using presigned URLs, so the bucket needs a CORS rule that allows `PUT` from your app. In the Cloudflare dashboard, open **R2 → your bucket → Settings → CORS policy**:

```json
[
  {
    "AllowedOrigins": ["https://bookbot.example.com"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type", "Content-Length"],
    "MaxAgeSeconds": 3600
  }
]
```

Use your real `NEXTAUTH_URL` origin. Downloads go through the app, which checks access, so `GET` doesn't need to be allowed. Keep the bucket **private** (no public access).

## Billing

In the Stripe dashboard (test mode first):

1. Create **Pro** and **Enterprise** products with monthly prices, and set `STRIPE_PRICE_ID_PRO` / `STRIPE_PRICE_ID_ENTERPRISE`.
2. Set `STRIPE_SECRET_KEY`.
3. Add a webhook endpoint `<NEXTAUTH_URL>/api/webhooks/stripe` with the events `checkout.session.completed` and `customer.subscription.created`, `.updated`, `.deleted`, then set `STRIPE_WEBHOOK_SECRET` to its signing secret.
4. Enable the **customer portal** and allow switching between the two prices.

## Chrome extension

Build it against your production URL and upload `apps/extension/.output/chrome-mv3`:

```bash
WXT_API_URL=https://bookbot.example.com npm run build -w extension
```

## Upgrading

```bash
git pull
docker compose up -d --build      # rebuilds, migrates, then restarts web and worker
```

The worker finishes in-flight exports before it stops.
