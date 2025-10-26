import { promises as dns } from "node:dns";
import { and, db, eq } from "@rediredge/db";
import { domain, outbox, redirect } from "@rediredge/db/schema/domains";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, publicProcedure, router } from "../index";
import {
	createDomainSchema,
	createRedirectSchema,
	deleteRedirectSchema,
	getDomainSchema,
	updateRedirectSchema,
	verifyDomainSchema,
} from "../schemas/domain";

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

			const redirectId = crypto.randomUUID();

			await db.transaction(async (tx) => {
				const existingRedirect = await tx
					.select()
					.from(redirect)
					.where(
						and(
							eq(redirect.domainId, input.domainId),
							eq(redirect.subdomain, input.subdomain),
						),
					)
					.limit(1);

				if (existingRedirect.length > 0) {
					throw new TRPCError({
						code: "CONFLICT",
						message: "A redirect with this subdomain already exists",
					});
				}

				await tx.insert(redirect).values({
					id: redirectId,
					domainId: input.domainId,
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
			});

			return { id: redirectId };
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

			const updatedRedirect = await db.transaction(async (tx) => {
				const [updated] = await tx
					.update(redirect)
					.set({
						...updates,
						updatedAt: new Date(),
						version: redirectData.redirect.version + 1,
					})
					.where(
						and(
							eq(redirect.id, id),
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

				return updated;
			});

			return { id: updatedRedirect.id };
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

			await db.transaction(async (tx) => {
				await tx.delete(redirect).where(eq(redirect.id, input.id));

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
			});

			return { id: input.id };
		}),
});
export type AppRouter = typeof appRouter;
