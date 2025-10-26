ALTER TABLE "outbox" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "outbox" ALTER COLUMN "status" SET DEFAULT 'pending'::text;--> statement-breakpoint
DROP TYPE "public"."outbox_status";--> statement-breakpoint
CREATE TYPE "public"."outbox_status" AS ENUM('pending', 'done', 'failed');--> statement-breakpoint
ALTER TABLE "outbox" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."outbox_status";--> statement-breakpoint
ALTER TABLE "outbox" ALTER COLUMN "status" SET DATA TYPE "public"."outbox_status" USING "status"::"public"."outbox_status";