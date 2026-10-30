CREATE TABLE IF NOT EXISTS "book_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"bsr" integer,
	"category" varchar(100),
	"price" numeric(10, 2),
	"reviews" integer,
	"estimated_daily_sales" integer,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tracked_books" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"orgId" uuid NOT NULL,
	"asin" varchar(10) NOT NULL,
	"marketplace" varchar(10) NOT NULL,
	"title" varchar(500) NOT NULL,
	"category" varchar(100),
	"bsr" integer,
	"price" numeric(10, 2),
	"reviews" integer,
	"estimated_daily_sales" integer,
	"last_checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "book_snapshots" ADD CONSTRAINT "book_snapshots_book_id_tracked_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."tracked_books"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tracked_books" ADD CONSTRAINT "tracked_books_orgId_organizations_id_fk" FOREIGN KEY ("orgId") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "book_snapshots_book_time_idx" ON "book_snapshots" USING btree ("book_id","captured_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tracked_books_org_asin_market_idx" ON "tracked_books" USING btree ("orgId","asin","marketplace");