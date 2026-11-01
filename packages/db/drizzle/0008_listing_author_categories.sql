ALTER TABLE "listings" ADD COLUMN "author" varchar(255);--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "categories" jsonb DEFAULT '[]'::jsonb NOT NULL;