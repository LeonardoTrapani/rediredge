import { db, eq } from "@rediredge/db";
import { domain, redirect } from "@rediredge/db/schema/domains";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, publicProcedure, router } from "../index";
import { createDomainSchema } from "../schemas/domain";

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
				.where(eq(domain.apex, input.domain))
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

			await db.insert(redirect).values(
				input.redirects.map((r) => ({
					id: crypto.randomUUID(),
					domainId,
					subdomain: r.subdomain,
					destinationUrl: r.destinationUrl,
					code: r.code,
					preservePath: r.preservePath,
					preserveQuery: r.preserveQuery,
				})),
			);

			return { domainId };
		}),
});
export type AppRouter = typeof appRouter;
