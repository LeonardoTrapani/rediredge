import { promises as dns } from "node:dns";
import { and, db, eq } from "@rediredge/db";
import { domain, redirect } from "@rediredge/db/schema/domains";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../index";
import {
	createDomainSchema,
	getDomainSchema,
	verifyDomainSchema,
} from "../schemas/domain";

export const domainRouter = router({
	create: protectedProcedure
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
	getWithRedirects: protectedProcedure
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
	verify: protectedProcedure
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
});
