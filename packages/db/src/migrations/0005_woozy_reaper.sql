DROP INDEX "idx_usage_period_start";--> statement-breakpoint
DROP INDEX "uniq_usage_redirect_period";--> statement-breakpoint
ALTER TABLE "usage_period" DROP COLUMN "period_start";--> statement-breakpoint
ALTER TABLE "usage_period" DROP COLUMN "period_end";--> statement-breakpoint
ALTER TABLE "usage_period" DROP COLUMN "polar_customer_id";--> statement-breakpoint
ALTER TABLE "usage_period" DROP COLUMN "last_error";--> statement-breakpoint
ALTER TABLE "usage_period" DROP COLUMN "retry_count";