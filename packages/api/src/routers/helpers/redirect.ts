import { and, type DbTransaction, eq, sql } from "@rediredge/db";
import { outbox, redirect } from "@rediredge/db/schema/domains";
import { TRPCError } from "@trpc/server";
import type z from "zod";
import type {
	createRedirectSchema,
	deleteRedirectSchema,
	updateRedirectSchema,
} from "../../schemas/domain";

export async function createRedirectHelper(
	tx: DbTransaction,
	domainData: { id: string; apex: string },
	input: z.infer<typeof createRedirectSchema>,
	hasActiveSubscription: boolean,
) {
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

	// Check subscription if trying to enable the redirect
	if (input.enabled === true && !hasActiveSubscription) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "An active subscription is required to enable redirects",
		});
	}

	await tx.insert(redirect).values({
		id: input.id,
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
			apex: domainData.apex,
			id: input.id,
			subdomain: input.subdomain,
			destinationUrl: input.destinationUrl,
			code: input.code,
			preservePath: input.preservePath,
			preserveQuery: input.preserveQuery,
			enabled: input.enabled,
			version: 1,
		},
		dedupeKey: `redirect:created:${input.id}`,
	});

	return { id: input.id };
}

export async function updateRedirectHelper(
	tx: DbTransaction,
	updateInput: z.infer<typeof updateRedirectSchema>,
	domainApex: string,
	hasActiveSubscription: boolean,
) {
	const { id: _id, ...updates } = updateInput;

	// Check subscription if trying to enable the redirect
	if (updates.enabled === true && !hasActiveSubscription) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "An active subscription is required to enable redirects",
		});
	}

	const [updated] = await tx
		.update(redirect)
		.set({
			...updates,
			version: sql`${redirect.version} + 1`,
		})
		.where(eq(redirect.id, updateInput.id))
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
			apex: domainApex,
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
	deleteInput: z.infer<typeof deleteRedirectSchema>,
) {
	await tx.delete(redirect).where(eq(redirect.id, deleteInput.id));

	await tx.insert(outbox).values({
		id: crypto.randomUUID(),
		topic: "redirect.deleted",
		payload: {
			id: deleteInput.id,
		},
		dedupeKey: `redirect:deleted:${deleteInput.id}`,
	});

	return { id: deleteInput.id };
}
