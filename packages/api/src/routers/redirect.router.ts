import { db, eq } from "@rediredge/db";
import { domain, redirect } from "@rediredge/db/schema/domains";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../index";
import {
	batchRedirectOperationSchema,
	createRedirectSchema,
	deleteRedirectSchema,
	updateRedirectSchema,
} from "../schemas/domain";
import {
	createRedirectHelper,
	deleteRedirectHelper,
	updateRedirectHelper,
} from "./helpers/redirect";

export const redirectRouter = router({
	create: protectedProcedure
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
	update: protectedProcedure
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

			const { id: _id, ...updates } = input;

			return await db.transaction(async (tx) => {
				return await updateRedirectHelper(tx, redirectData, updates);
			});
		}),
	delete: protectedProcedure
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
	batch: protectedProcedure
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

						const { id: _id, ...updates } = updateInput;
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
