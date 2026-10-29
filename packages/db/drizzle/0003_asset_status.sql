ALTER TABLE "assets" ADD COLUMN "status" varchar(20) DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "name" varchar(255);