import { relations } from "drizzle-orm";
import {
	boolean,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

/* ---------------- Enums ---------------- */

export const redirectCode = pgEnum("redirect_code", [
	"301",
	"302",
	"307",
	"308",
]);

/* ---------------- Domains & Redirects ---------------- */

export const domain = pgTable(
	"domain",
	{
		id: text("id").primaryKey(),
		// apex only, lowercase + punycode at write time
		apex: text("apex").notNull().unique(), // e.g. "example.com"
		verifiedAt: timestamp("verified_at", { withTimezone: true }),
		verified: boolean("verified").notNull().default(false),
		enabled: boolean("enabled").notNull().default(true),

		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),

		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [index("idx_domain_user").on(table.userId)],
);

export const redirect = pgTable(
	"redirect",
	{
		id: text("id").primaryKey(),

		domainId: text("domain_id")
			.notNull()
			.references(() => domain.id, { onDelete: "cascade" }),
		subdomain: text("subdomain").notNull(),

		destinationUrl: text("destination_url").notNull(),
		code: redirectCode("code").notNull().default("308"),
		preservePath: boolean("preserve_path").notNull().default(true),
		preserveQuery: boolean("preserve_query").notNull().default(true),
		enabled: boolean("enabled").notNull().default(true),

		version: integer("version").notNull().default(1),

		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		deletedAt: timestamp("deleted_at", { withTimezone: true }),
	},
	(table) => [
		uniqueIndex("uniq_redirect_domain_subdomain").on(
			table.domainId,
			table.subdomain,
		),
		index("idx_redirect_domain").on(table.domainId),
	],
);

/* ---------------- Outbox (for Redis sync) ---------------- */

export const outbox = pgTable(
	"outbox",
	{
		id: text("id").primaryKey(),
		topic: text("topic").notNull(), // "redirect.created" | "redirect.updated" | ...
		payload: jsonb("payload").notNull(),
		dedupeKey: text("dedupe_key"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		processedAt: timestamp("processed_at", { withTimezone: true }),
	},
	(table) => [
		index("idx_outbox_created_at").on(table.createdAt),
		uniqueIndex("uniq_outbox_dedupe").on(table.dedupeKey),
	],
);

/* ---------------- Relations ---------------- */

export const domainRelations = relations(domain, ({ one, many }) => ({
	owner: one(user, { fields: [domain.userId], references: [user.id] }),
	redirects: many(redirect),
}));

export const redirectRelations = relations(redirect, ({ one }) => ({
	domain: one(domain, { fields: [redirect.domainId], references: [domain.id] }),
}));
