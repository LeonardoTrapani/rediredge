import { checkActiveSubscription } from "@rediredge/auth";
import { and, db, eq } from "@rediredge/db";
import { domain } from "@rediredge/db/schema/domains";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../index";
import { batchRedirectOperationSchema } from "../schemas/domain";
import {
	createRedirectHelper,
	deleteRedirectHelper,
	updateRedirectHelper,
} from "./helpers/redirect";

export const redirectRouter = router({
	batch: protectedProcedure
		.input(batchRedirectOperationSchema)
		.mutation(async ({ ctx, input }) => {
			const [domainData] = await db
				.select()
				.from(domain)
				.where(
					and(
						eq(domain.id, input.domainId),
						eq(domain.userId, ctx.session.user.id),
					),
				)
				.limit(1);

			if (!domainData) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Domain not found",
				});
			}

			// Check subscription once for all operations that might enable redirects
			const hasEnablingOperations =
				(input.operations.create?.some((op) => op.enabled) ?? false) ||
				(input.operations.update?.some((op) => op.enabled === true) ?? false);

			let hasActiveSubscription = false;
			if (hasEnablingOperations) {
				hasActiveSubscription = await checkActiveSubscription(
					ctx.session.user.id,
				);
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
							hasActiveSubscription,
						);
						createResults.push(result);
					}
				}

				if (input.operations.update) {
					for (const updateInput of input.operations.update) {
						const result = await updateRedirectHelper(
							tx,
							updateInput,
							domainData.apex,
							hasActiveSubscription,
						);
						updateResults.push(result);
					}
				}

				if (input.operations.delete) {
					for (const deleteInput of input.operations.delete) {
						const result = await deleteRedirectHelper(tx, deleteInput);
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
