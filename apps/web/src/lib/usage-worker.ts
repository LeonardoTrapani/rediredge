import { reportUsageToPolar } from "@rediredge/auth";
import { and, db, eq, sql } from "@rediredge/db";
import { redirect } from "@rediredge/db/schema/domains";
import { usagePeriod } from "@rediredge/db/schema/usage";
import { redis } from "@/lib/redis";

const BATCH_LIMIT = 100;

type ProcessingResult = {
	processed: number;
	failed: number;
	errors: string[];
};

/**
 * Gets the start and end of the previous completed hour
 */
function getPreviousHourBucket(): { periodStart: Date; periodEnd: Date } {
	const now = new Date();
	const periodEnd = new Date(now);
	periodEnd.setMinutes(0, 0, 0); // Round down to start of current hour

	const periodStart = new Date(periodEnd);
	periodStart.setHours(periodStart.getHours() - 1); // Go back one hour

	return { periodStart, periodEnd };
}

/**
 * Scans Redis for usage keys and groups by user+redirect
 */
async function scanUsageKeys(): Promise<
	Map<string, { userId: string; redirectId: string; count: number }>
> {
	const usageMap = new Map<
		string,
		{ userId: string; redirectId: string; count: number }
	>();

	let cursor = "0";
	do {
		const [nextCursor, keys] = await redis.scan(
			cursor,
			"MATCH",
			"usage:*",
			"COUNT",
			100,
		);
		cursor = nextCursor;

		for (const key of keys) {
			// Key format: usage:{userId}:{redirectId}
			const parts = key.split(":");
			if (parts.length !== 3) continue;

			const [, userId, redirectId] = parts;
			const count = await redis.hget(key, "redirects");

			if (count && Number.parseInt(count, 10) > 0) {
				usageMap.set(key, {
					userId,
					redirectId,
					count: Number.parseInt(count, 10),
				});
			}
		}
	} while (cursor !== "0");

	return usageMap;
}

/**
 * Processes usage data for the previous hour
 */
export async function processUsageBatch(
	limit = BATCH_LIMIT,
): Promise<ProcessingResult> {
	const result: ProcessingResult = {
		processed: 0,
		failed: 0,
		errors: [],
	};

	const { periodStart, periodEnd } = getPreviousHourBucket();

	// Scan Redis for all usage keys
	const usageMap = await scanUsageKeys();

	if (usageMap.size === 0) {
		return result;
	}

	// Group by userId for Polar reporting
	const userTotals = new Map<string, number>();
	for (const { userId, count } of usageMap.values()) {
		userTotals.set(userId, (userTotals.get(userId) || 0) + count);
	}

	// Process each redirect's usage
	const entries = Array.from(usageMap.entries()).slice(0, limit);

	for (const [redisKey, { userId, redirectId, count }] of entries) {
		try {
			// Verify redirect exists
			const redirectRecords = await db
				.select()
				.from(redirect)
				.where(eq(redirect.id, redirectId))
				.limit(1);

			if (redirectRecords.length === 0) {
				result.errors.push(`Redirect ${redirectId} not found`);
				result.failed++;
				continue;
			}

			await db.transaction(async (tx) => {
				// Upsert usage_period record
				const periodId = `${redirectId}_${periodStart.getTime()}`;

				const existingRecords = await tx
					.select()
					.from(usagePeriod)
					.where(
						and(
							eq(usagePeriod.redirectId, redirectId),
							eq(usagePeriod.periodStart, periodStart),
						),
					)
					.limit(1);

				const existing = existingRecords.length > 0 ? existingRecords[0] : null;

				if (existing) {
					// Update existing record
					await tx
						.update(usagePeriod)
						.set({
							redirectCount: existing.redirectCount + count,
							updatedAt: new Date(),
						})
						.where(eq(usagePeriod.id, existing.id));
				} else {
					// Insert new record
					await tx.insert(usagePeriod).values({
						id: periodId,
						userId,
						redirectId,
						periodStart,
						periodEnd,
						redirectCount: count,
						polarReported: false,
					});
				}
			});

			await redis.del(redisKey);
			result.processed++;
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			result.errors.push(`${redirectId}: ${errorMessage}`);
			result.failed++;
			console.error(`[usage-worker] Failed to process ${redisKey}:`, error);
		}
	}

	// Report aggregated usage to Polar per user
	for (const [userId, totalCount] of userTotals.entries()) {
		try {
			const polarResult = await reportUsageToPolar({
				userId,
				periodStart,
				periodEnd,
				totalCount,
			});

			if (polarResult.success) {
				// Mark all user's records as polar reported
				await db
					.update(usagePeriod)
					.set({
						polarReported: true,
						polarReportedAt: new Date(),
					})
					.where(
						and(
							eq(usagePeriod.userId, userId),
							eq(usagePeriod.periodStart, periodStart),
						),
					);
			} else {
				// Update error tracking
				await db
					.update(usagePeriod)
					.set({
						lastError: polarResult.error || "Polar reporting failed",
						retryCount: sql`${usagePeriod.retryCount} + 1`,
					})
					.where(
						and(
							eq(usagePeriod.userId, userId),
							eq(usagePeriod.periodStart, periodStart),
						),
					);

				result.errors.push(`Polar: ${polarResult.error}`);
			}
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			result.errors.push(`Polar reporting for ${userId}: ${errorMessage}`);
			console.error(
				`[usage-worker] Failed to report to Polar for user ${userId}:`,
				error,
			);
		}
	}

	return result;
}
