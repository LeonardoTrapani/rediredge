CREATE TYPE "public"."outbox_status" AS ENUM('pending', 'processing', 'done', 'failed');--> statement-breakpoint
ALTER TABLE "outbox" ADD COLUMN "status" "outbox_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "outbox" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "outbox" ADD COLUMN "last_error" text;