-- Existing values were written as UTC (postgres.js sends UTC), so convert
-- them as UTC rather than in the database's session time zone.
ALTER TABLE "ai_generations" ALTER COLUMN "createdAt" SET DATA TYPE timestamp with time zone USING "createdAt" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "ai_generations" ALTER COLUMN "updatedAt" SET DATA TYPE timestamp with time zone USING "updatedAt" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "ai_generations" ALTER COLUMN "completedAt" SET DATA TYPE timestamp with time zone USING "completedAt" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "assets" ALTER COLUMN "createdAt" SET DATA TYPE timestamp with time zone USING "createdAt" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "bsr_curves" ALTER COLUMN "createdAt" SET DATA TYPE timestamp with time zone USING "createdAt" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "bsr_curves" ALTER COLUMN "updatedAt" SET DATA TYPE timestamp with time zone USING "updatedAt" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "entitlements_usage" ALTER COLUMN "period_start" SET DATA TYPE timestamp with time zone USING "period_start" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "entitlements_usage" ALTER COLUMN "createdAt" SET DATA TYPE timestamp with time zone USING "createdAt" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "entitlements_usage" ALTER COLUMN "updatedAt" SET DATA TYPE timestamp with time zone USING "updatedAt" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "exports" ALTER COLUMN "createdAt" SET DATA TYPE timestamp with time zone USING "createdAt" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "exports" ALTER COLUMN "updatedAt" SET DATA TYPE timestamp with time zone USING "updatedAt" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "exports" ALTER COLUMN "completedAt" SET DATA TYPE timestamp with time zone USING "completedAt" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "keyword_cache" ALTER COLUMN "fetched_at" SET DATA TYPE timestamp with time zone USING "fetched_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "keyword_cache" ALTER COLUMN "expires_at" SET DATA TYPE timestamp with time zone USING "expires_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "listings" ALTER COLUMN "createdAt" SET DATA TYPE timestamp with time zone USING "createdAt" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "listings" ALTER COLUMN "updatedAt" SET DATA TYPE timestamp with time zone USING "updatedAt" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "memberships" ALTER COLUMN "createdAt" SET DATA TYPE timestamp with time zone USING "createdAt" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "niche_snapshots" ALTER COLUMN "fetched_at" SET DATA TYPE timestamp with time zone USING "fetched_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "organizations" ALTER COLUMN "createdAt" SET DATA TYPE timestamp with time zone USING "createdAt" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "organizations" ALTER COLUMN "updatedAt" SET DATA TYPE timestamp with time zone USING "updatedAt" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "project_docs" ALTER COLUMN "createdAt" SET DATA TYPE timestamp with time zone USING "createdAt" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "project_docs" ALTER COLUMN "updatedAt" SET DATA TYPE timestamp with time zone USING "updatedAt" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "createdAt" SET DATA TYPE timestamp with time zone USING "createdAt" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "updatedAt" SET DATA TYPE timestamp with time zone USING "updatedAt" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "puzzle_sets" ALTER COLUMN "createdAt" SET DATA TYPE timestamp with time zone USING "createdAt" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "saved_niches" ALTER COLUMN "createdAt" SET DATA TYPE timestamp with time zone USING "createdAt" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "saved_niches" ALTER COLUMN "updatedAt" SET DATA TYPE timestamp with time zone USING "updatedAt" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "expires" SET DATA TYPE timestamp with time zone USING "expires" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "subscriptions" ALTER COLUMN "current_period_start" SET DATA TYPE timestamp with time zone USING "current_period_start" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "subscriptions" ALTER COLUMN "current_period_end" SET DATA TYPE timestamp with time zone USING "current_period_end" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "subscriptions" ALTER COLUMN "createdAt" SET DATA TYPE timestamp with time zone USING "createdAt" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "subscriptions" ALTER COLUMN "updatedAt" SET DATA TYPE timestamp with time zone USING "updatedAt" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "emailVerified" SET DATA TYPE timestamp with time zone USING "emailVerified" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "createdAt" SET DATA TYPE timestamp with time zone USING "createdAt" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "updatedAt" SET DATA TYPE timestamp with time zone USING "updatedAt" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "verification_tokens" ALTER COLUMN "expires" SET DATA TYPE timestamp with time zone USING "expires" AT TIME ZONE 'UTC';