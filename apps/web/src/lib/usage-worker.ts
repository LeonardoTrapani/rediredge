import { reportUsageToPolar } from "@rediredge/auth";
import { db, eq } from "@rediredge/db";
import { redirect } from "@rediredge/db/schema/domains";
import { usagePeriod } from "@rediredge/db/schema/usage";
import { redis } from "@/lib/redis";

const BATCH_LIMIT = 300;

type ProcessingResult = {
	processed: number;
	failed: number;
	errors: string[];
};

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

export async function processUsageBatch(
	limit = BATCH_LIMIT,
): Promise<ProcessingResult> {
	const result: ProcessingResult = {
		processed: 0,
		failed: 0,
		errors: [],
	};

	// Get usage keys for ALL redirects from redis
	const usageMap = await scanUsageKeys();

	if (usageMap.size === 0) {
		return result;
	}

	const entries = Array.from(usageMap.entries()).slice(0, limit);

	for (const [redisKey, { userId, redirectId, count }] of entries) {
		try {
			const redirectRecords = await db
				.select()
				.from(redirect)
				.where(eq(redirect.id, redirectId))
				.limit(1);

			if (redirectRecords.length === 0) {
				throw new Error(`Redirect record not found for ${redirectId}`);
			}

			await db.transaction(async (tx) => {
				const periodId = `${redirectId}_${Date.now()}`;

				await tx.insert(usagePeriod).values({
					id: periodId,
					userId,
					redirectId,
					polarReportedAt: new Date(),
					polarReported: true,
					redirectCount: count,
				});

				const polarResult = await reportUsageToPolar({
					userId,
					timestamp: new Date(),
					count,
					redirectId,
				});

				if (polarResult.inserted <= 0) {
					throw new Error("Failed to report usage to Polar");
				}

				await redis.del(redisKey);
				result.processed++;
			});
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			result.errors.push(`${redirectId}: ${errorMessage}`);
			result.failed++;
			console.error(`[usage-worker] Failed to process ${redisKey}:`, error);
		}
	}

	return result;
}
