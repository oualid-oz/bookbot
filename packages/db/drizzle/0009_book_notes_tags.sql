ALTER TABLE "tracked_books" ADD COLUMN "notes" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "tracked_books" ADD COLUMN "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;