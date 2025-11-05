import { reportUsageToPolar } from "@rediredge/auth";
import { db } from "@rediredge/db";
import { usagePeriod } from "@rediredge/db/schema/usage";
import { redis } from "@/lib/redis";

const BATCH_LIMIT = 100;

type ProcessingResult = {
	processed: number;
	failed: number;
	errors: string[];
};

async function processUsageKey(
	key: string,
	userId: string,
	redirectId: string,
	redirectCount: number,
): Promise<void> {
	await db.transaction(async (tx) => {
		const periodId = `${redirectId}_${Date.now()}`;

		await tx.insert(usagePeriod).values({
			id: periodId,
			userId,
			redirectId,
			polarReportedAt: new Date(),
			polarReported: true,
			redirectCount,
		});

		const polarResult = await reportUsageToPolar({
			userId,
			timestamp: new Date(),
			count: redirectCount,
			redirectId,
		});

		if (polarResult.inserted <= 0) {
			throw new Error("Failed to report usage to Polar");
		}
	});

	// Atomically decrement by the count we just processed.
	// If new redirects arrived during processing, they remain for next batch.
	// If count becomes <= 0, delete key to keep Redis clean.
	const luaScript = `
		local count = tonumber(ARGV[1])
		local current = tonumber(redis.call('HGET', KEYS[1], 'redirects')) or 0
		local newCount = current - count

		if newCount <= 0 then
			redis.call('DEL', KEYS[1])
			return 0
		else
			redis.call('HSET', KEYS[1], 'redirects', newCount)
			return newCount
		end
	`;

	await redis.eval(luaScript, 1, key, redirectCount.toString());
}

export async function processUsageBatch(): Promise<ProcessingResult> {
	const result: ProcessingResult = {
		processed: 0,
		failed: 0,
		errors: [],
	};

	let cursor = "0";
	let processedCount = 0;

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
			if (processedCount >= BATCH_LIMIT) break;

			// Key format: usage:{userId}:{redirectId}
			const parts = key.split(":");
			if (parts.length !== 3) continue;

			const [, userId, redirectId] = parts;
			const count = await redis.hget(key, "redirects");

			if (!count || Number.parseInt(count, 10) <= 0) continue;

			const redirectCount = Number.parseInt(count, 10);

			try {
				await processUsageKey(key, userId, redirectId, redirectCount);
				result.processed++;
				processedCount++;
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : "Unknown error";
				result.errors.push(`${redirectId}: ${errorMessage}`);
				result.failed++;
				console.error(`[usage-worker] Failed to process ${key}:`, error);
			}
		}

		if (processedCount >= BATCH_LIMIT) break;
	} while (cursor !== "0");

	return result;
}
