DROP INDEX "uniq_usage_user_period";--> statement-breakpoint
ALTER TABLE "usage_period" ADD COLUMN "redirect_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "usage_period" ADD CONSTRAINT "usage_period_redirect_id_redirect_id_fk" FOREIGN KEY ("redirect_id") REFERENCES "public"."redirect"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_usage_redirect" ON "usage_period" USING btree ("redirect_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_usage_redirect_period" ON "usage_period" USING btree ("redirect_id","period_start");