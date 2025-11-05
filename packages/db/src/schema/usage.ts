import { relations } from "drizzle-orm";
import {
	boolean,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { redirect } from "./domains";

/* ---------------- Usage Tracking ---------------- */

export const usagePeriod = pgTable(
	"usage_period",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		redirectId: text("redirect_id")
			.notNull()
			.references(() => redirect.id, { onDelete: "cascade" }),

		// Period tracking (hourly buckets)
		periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
		periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),

		// Aggregated count for period
		redirectCount: integer("redirect_count").notNull().default(0),

		// Polar sync tracking
		polarReported: boolean("polar_reported").notNull().default(false),
		polarReportedAt: timestamp("polar_reported_at", { withTimezone: true }),
		polarCustomerId: text("polar_customer_id"), // Store for reference

		// Error tracking
		lastError: text("last_error"),
		retryCount: integer("retry_count").notNull().default(0),

		// Timestamps
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("idx_usage_user").on(table.userId),
		index("idx_usage_redirect").on(table.redirectId),
		index("idx_usage_period_start").on(table.periodStart),
		index("idx_usage_polar_reported").on(table.polarReported),
		uniqueIndex("uniq_usage_redirect_period").on(
			table.redirectId,
			table.periodStart,
		),
	],
);

/* ---------------- Relations ---------------- */

export const usagePeriodRelations = relations(usagePeriod, ({ one }) => ({
	user: one(user, { fields: [usagePeriod.userId], references: [user.id] }),
	redirect: one(redirect, {
		fields: [usagePeriod.redirectId],
		references: [redirect.id],
	}),
}));
