CREATE TABLE "usage_period" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"redirect_count" integer DEFAULT 0 NOT NULL,
	"polar_reported" boolean DEFAULT false NOT NULL,
	"polar_reported_at" timestamp with time zone,
	"polar_customer_id" text,
	"last_error" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "usage_period" ADD CONSTRAINT "usage_period_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_usage_user" ON "usage_period" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_usage_period_start" ON "usage_period" USING btree ("period_start");--> statement-breakpoint
CREATE INDEX "idx_usage_polar_reported" ON "usage_period" USING btree ("polar_reported");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_usage_user_period" ON "usage_period" USING btree ("user_id","period_start");