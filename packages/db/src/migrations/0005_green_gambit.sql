CREATE TABLE "usage_period" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"redirect_id" text NOT NULL,
	"redirect_count" integer DEFAULT 0 NOT NULL,
	"polar_reported" boolean DEFAULT false NOT NULL,
	"polar_reported_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "usage_period" ADD CONSTRAINT "usage_period_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_period" ADD CONSTRAINT "usage_period_redirect_id_redirect_id_fk" FOREIGN KEY ("redirect_id") REFERENCES "public"."redirect"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_usage_user" ON "usage_period" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_usage_redirect" ON "usage_period" USING btree ("redirect_id");--> statement-breakpoint
CREATE INDEX "idx_usage_polar_reported" ON "usage_period" USING btree ("polar_reported");