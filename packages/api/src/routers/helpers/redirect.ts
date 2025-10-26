import { and, type DbTransaction, eq } from "@rediredge/db";
import { outbox, redirect } from "@rediredge/db/schema/domains";
import { TRPCError } from "@trpc/server";

export async function createRedirectHelper(
	tx: DbTransaction,
	domainData: { id: string; apex: string },
	input: {
		subdomain: string;
		destinationUrl: string;
		code: (typeof redirect.$inferInsert)["code"];
		preservePath: boolean;
		preserveQuery: boolean;
		enabled: boolean;
	},
) {
	const redirectId = crypto.randomUUID();

	const existingRedirect = await tx
		.select()
		.from(redirect)
		.where(
			and(
				eq(redirect.domainId, domainData.id),
				eq(redirect.subdomain, input.subdomain),
			),
		)
		.limit(1);

	if (existingRedirect.length > 0) {
		throw new TRPCError({
			code: "CONFLICT",
			message: `A redirect with subdomain "${input.subdomain}" already exists`,
		});
	}

	await tx.insert(redirect).values({
		id: redirectId,
		domainId: domainData.id,
		subdomain: input.subdomain,
		destinationUrl: input.destinationUrl,
		code: input.code,
		preservePath: input.preservePath,
		preserveQuery: input.preserveQuery,
		enabled: input.enabled,
	});

	await tx.insert(outbox).values({
		id: crypto.randomUUID(),
		topic: "redirect.created",
		payload: {
			id: redirectId,
			apex: domainData.apex,
			subdomain: input.subdomain,
			destinationUrl: input.destinationUrl,
			code: input.code,
			preservePath: input.preservePath,
			preserveQuery: input.preserveQuery,
			enabled: input.enabled,
			version: 1,
		},
		dedupeKey: `redirect:created:${redirectId}`,
	});

	return { id: redirectId };
}

export async function updateRedirectHelper(
	tx: DbTransaction,
	redirectData: {
		redirect: typeof redirect.$inferSelect;
		domain: { apex: string };
	},
	updates: {
		subdomain?: string;
		destinationUrl?: string;
		code?: (typeof redirect.$inferInsert)["code"];
		preservePath?: boolean;
		preserveQuery?: boolean;
		enabled?: boolean;
	},
) {
	const [updated] = await tx
		.update(redirect)
		.set({
			...updates,
			updatedAt: new Date(),
			version: redirectData.redirect.version + 1,
		})
		.where(
			and(
				eq(redirect.id, redirectData.redirect.id),
				eq(redirect.version, redirectData.redirect.version),
			),
		)
		.returning();

	if (!updated) {
		throw new TRPCError({
			code: "CONFLICT",
			message:
				"Redirect was modified by another request. Please refresh and try again.",
		});
	}

	await tx.insert(outbox).values({
		id: crypto.randomUUID(),
		topic: "redirect.updated",
		payload: {
			id: updated.id,
			apex: redirectData.domain.apex,
			subdomain: updated.subdomain,
			destinationUrl: updated.destinationUrl,
			code: updated.code,
			preservePath: updated.preservePath,
			preserveQuery: updated.preserveQuery,
			enabled: updated.enabled,
			version: updated.version,
		},
		dedupeKey: `redirect:updated:${updated.id}:${updated.version}`,
	});

	return { id: updated.id };
}

export async function deleteRedirectHelper(
	tx: DbTransaction,
	redirectData: {
		redirect: typeof redirect.$inferSelect;
		domain: { apex: string };
	},
) {
	await tx.delete(redirect).where(eq(redirect.id, redirectData.redirect.id));

	await tx.insert(outbox).values({
		id: crypto.randomUUID(),
		topic: "redirect.deleted",
		payload: {
			id: redirectData.redirect.id,
			apex: redirectData.domain.apex,
			subdomain: redirectData.redirect.subdomain,
		},
		dedupeKey: `redirect:deleted:${redirectData.redirect.id}`,
	});

	return { id: redirectData.redirect.id };
}
