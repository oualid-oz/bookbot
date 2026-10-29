<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Bookbot Architecture Implementation

### Project Structure
- **Monorepo**: Turborepo with apps (web, worker, extension) and packages (db, core, puzzles, shared)
- **Run dev**: `npm run dev` (runs web + worker)
- **Run all**: `npm run dev:all` (includes extension build)

### Key Dependencies
- **Database**: PostgreSQL with Drizzle ORM
- **Cache/Queue**: Redis with BullMQ
- **Auth**: NextAuth v4 with JWT strategy
- **Storage**: R2/S3 (presigned URLs)
- **Editor**: Konva (react-konva)
- **AI**: Placeholder wrapper for Anthropic/OpenAI
- **Worker**: BullMQ + Redis (Dockerized)

### Environment Variables (.env.example)
- DATABASE_URL, REDIS_URL
- R2_* (account, keys, bucket)
- NEXTAUTH_SECRET, NEXTAUTH_URL
- STRIPE_* (secret key, webhook, price IDs)
- ANTHROPIC_API_KEY, OPENAI_API_KEY
- EXTENSION_JWT_SECRET

### Database Schema (18 tables)
- **Auth**: users, accounts, sessions, verificationTokens
- **Orgs**: organizations, memberships, subscriptions, entitlementsUsage
- **Research**: keywordCache, nicheSnapshots, bsrCurves, savedNiches
- **Projects**: projects, projectDocs, assets, exports, puzzleSets, aiGenerations, listings

### Key Features Implemented
1. **Auth**: NextAuth with org-level scoping (getOrgBySlugWithAuth, hasOrgRole)
2. **Billing**: Stripe plans with entitlement checking (checkEntitlement, incrementUsage)
3. **Research**: Keyword cache, niche scoring, BSR estimator
4. **Extension**: WXT-based Chrome extension with JWT tokens
5. **Studio**: Konva canvas with KDP calculators (trim, bleed, spine)
6. **Export**: BullMQ worker with job queue
7. **Puzzles**: Seed-based word search generator
8. **AI**: Provider wrapper with credit metering

### API Endpoints
- `/api/auth/[...nextauth]` - NextAuth
- `/api/research/keyword` - Keyword lookup with cache
- `/api/research/niche` - Niche analysis
- `/api/ext/estimate` - Extension BSR estimation
- `/api/extension/token` - Generate extension tokens
- `/api/export` - Export job creation
- `/api/assets/upload` - Asset upload with DPI validation

