//TODO: to have any enabled check that the user has a subscription enabled

import { promises as dns } from "node:dns";
import { and, type DbTransaction, db, eq } from "@rediredge/db";
import { domain, outbox, redirect } from "@rediredge/db/schema/domains";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, publicProcedure, router } from "../index";
import {
	batchRedirectOperationSchema,
	createDomainSchema,
	createRedirectSchema,
	deleteRedirectSchema,
	getDomainSchema,
	updateRedirectSchema,
	verifyDomainSchema,
} from "../schemas/domain";

async function createRedirectHelper(
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

async function updateRedirectHelper(
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

async function deleteRedirectHelper(
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

export const appRouter = router({
	healthCheck: publicProcedure.query(() => {
		return "OK";
	}),
	createDomain: protectedProcedure
		.input(createDomainSchema)
		.mutation(async ({ ctx, input }) => {
			const existingDomain = await db
				.select()
				.from(domain)
				.where(
					and(
						eq(domain.apex, input.domain),
						eq(domain.userId, ctx.session.user.id),
					),
				)
				.limit(1);

			if (existingDomain.length > 0) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "A domain with this name already exists",
				});
			}

			const domainId = crypto.randomUUID();

			await db.insert(domain).values({
				id: domainId,
				apex: input.domain,
				userId: ctx.session.user.id,
			});

			return { domainId, apex: input.domain };
		}),
	getDomainWithRedirects: protectedProcedure
		.input(getDomainSchema)
		.query(async ({ ctx, input }) => {
			const [domainData] = await db
				.select()
				.from(domain)
				.where(eq(domain.apex, input.apex))
				.limit(1);

			if (!domainData) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Domain not found",
				});
			}

			if (domainData.userId !== ctx.session.user.id) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not have access to this domain",
				});
			}

			const redirects = await db
				.select()
				.from(redirect)
				.where(eq(redirect.domainId, domainData.id));

			return {
				...domainData,
				redirects,
			};
		}),
	verifyDomain: protectedProcedure
		.input(verifyDomainSchema)
		.mutation(async ({ ctx, input }) => {
			const [domainData] = await db
				.select()
				.from(domain)
				.where(eq(domain.apex, input.apex))
				.limit(1);

			if (!domainData) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Domain not found",
				});
			}

			if (domainData.userId !== ctx.session.user.id) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not have access to this domain",
				});
			}

			if (domainData.verified) {
				return { verified: true };
			}

			try {
				const txtRecords = await dns.resolveTxt(`_rediredge.${input.apex}`);
				const expectedValue = `rediredge-verify=${domainData.id}`;
				const isVerified = txtRecords
					.flat()
					.some((record) => record === expectedValue);

				if (!isVerified) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message:
							"TXT record not found or invalid. Please add the TXT record and wait a few minutes for DNS propagation.",
					});
				}

				await db
					.update(domain)
					.set({
						verified: true,
						verifiedAt: new Date(),
					})
					.where(eq(domain.id, domainData.id));

				return { verified: true };
			} catch (error) {
				if (error instanceof TRPCError) {
					throw error;
				}

				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						"TXT record not found. Please add the TXT record and wait a few minutes for DNS propagation.",
				});
			}
		}),
	createRedirect: protectedProcedure
		.input(createRedirectSchema)
		.mutation(async ({ ctx, input }) => {
			const [domainData] = await db
				.select()
				.from(domain)
				.where(eq(domain.id, input.domainId))
				.limit(1);

			if (!domainData) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Domain not found",
				});
			}

			if (domainData.userId !== ctx.session.user.id) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not have access to this domain",
				});
			}

			return await db.transaction(async (tx) => {
				return await createRedirectHelper(tx, domainData, input);
			});
		}),
	updateRedirect: protectedProcedure
		.input(updateRedirectSchema)
		.mutation(async ({ ctx, input }) => {
			const [redirectData] = await db
				.select({
					redirect,
					domain,
				})
				.from(redirect)
				.innerJoin(domain, eq(redirect.domainId, domain.id))
				.where(eq(redirect.id, input.id))
				.limit(1);

			if (!redirectData) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Redirect not found",
				});
			}

			if (redirectData.domain.userId !== ctx.session.user.id) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not have access to this redirect",
				});
			}

			const { id, ...updates } = input;

			return await db.transaction(async (tx) => {
				return await updateRedirectHelper(tx, redirectData, updates);
			});
		}),

	deleteRedirect: protectedProcedure
		.input(deleteRedirectSchema)
		.mutation(async ({ ctx, input }) => {
			const [redirectData] = await db
				.select({
					redirect,
					domain,
				})
				.from(redirect)
				.innerJoin(domain, eq(redirect.domainId, domain.id))
				.where(eq(redirect.id, input.id))
				.limit(1);

			if (!redirectData) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Redirect not found",
				});
			}

			if (redirectData.domain.userId !== ctx.session.user.id) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not have access to this redirect",
				});
			}

			return await db.transaction(async (tx) => {
				return await deleteRedirectHelper(tx, redirectData);
			});
		}),
	batchRedirectOperation: protectedProcedure
		.input(batchRedirectOperationSchema)
		.mutation(async ({ ctx, input }) => {
			const [domainData] = await db
				.select()
				.from(domain)
				.where(eq(domain.id, input.domainId))
				.limit(1);

			if (!domainData) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Domain not found",
				});
			}

			if (domainData.userId !== ctx.session.user.id) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not have access to this domain",
				});
			}

			const results = await db.transaction(async (tx) => {
				const createResults = [];
				const updateResults = [];
				const deleteResults = [];

				if (input.operations.create) {
					for (const createInput of input.operations.create) {
						const result = await createRedirectHelper(
							tx,
							domainData,
							createInput,
						);
						createResults.push(result);
					}
				}

				if (input.operations.update) {
					for (const updateInput of input.operations.update) {
						const [redirectData] = await tx
							.select({
								redirect,
								domain,
							})
							.from(redirect)
							.innerJoin(domain, eq(redirect.domainId, domain.id))
							.where(eq(redirect.id, updateInput.id))
							.limit(1);

						if (!redirectData) {
							throw new TRPCError({
								code: "NOT_FOUND",
								message: `Redirect with id ${updateInput.id} not found`,
							});
						}

						if (redirectData.domain.userId !== ctx.session.user.id) {
							throw new TRPCError({
								code: "FORBIDDEN",
								message: `You do not have access to redirect ${updateInput.id}`,
							});
						}

						const { id, ...updates } = updateInput;
						const result = await updateRedirectHelper(
							tx,
							redirectData,
							updates,
						);
						updateResults.push(result);
					}
				}

				if (input.operations.delete) {
					for (const deleteInput of input.operations.delete) {
						const [redirectData] = await tx
							.select({
								redirect,
								domain,
							})
							.from(redirect)
							.innerJoin(domain, eq(redirect.domainId, domain.id))
							.where(eq(redirect.id, deleteInput.id))
							.limit(1);

						if (!redirectData) {
							throw new TRPCError({
								code: "NOT_FOUND",
								message: `Redirect with id ${deleteInput.id} not found`,
							});
						}

						if (redirectData.domain.userId !== ctx.session.user.id) {
							throw new TRPCError({
								code: "FORBIDDEN",
								message: `You do not have access to redirect ${deleteInput.id}`,
							});
						}

						const result = await deleteRedirectHelper(tx, redirectData);
						deleteResults.push(result);
					}
				}

				return {
					created: createResults,
					updated: updateResults,
					deleted: deleteResults,
				};
			});

			return results;
		}),
});
export type AppRouter = typeof appRouter;
