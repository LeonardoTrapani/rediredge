import type { OutboxEvent } from "@rediredge/api/schemas/outbox";
import { outboxEventSchema } from "@rediredge/api/schemas/outbox";
import { and, db, eq, sql } from "@rediredge/db";
import { outbox } from "@rediredge/db/schema/domains";
import { redis } from "@/lib/redis";

const BATCH_LIMIT = 50;
const MAX_ATTEMPTS = 5;

type ProcessingResult = {
	processed: number;
	failed: number;
};

async function upsertRedirectToRedis(event: OutboxEvent): Promise<void> {
	const { topic, payload } = event;

	const field = payload.subdomain
		? `${payload.apex}:${payload.subdomain}`
		: payload.apex;

	if (topic === "redirect.deleted") {
		await redis.hdel("redirects", field);
		return;
	}

	// Both redirect.created and redirect.updated are handled identically:
	// upsert to Redis with version-based idempotency

	const redirectRule = {
		to: payload.destinationUrl,
		status: Number.parseInt(payload.code, 10),
		preservePath: payload.preservePath,
		preserveQuery: payload.preserveQuery,
		enabled: payload.enabled,
		version: payload.version,
	};

	// Atomic check-and-set using Lua script to prevent race conditions
	const luaScript = `
		local existing = redis.call('HGET', KEYS[1], KEYS[2])
		if existing then
			local parsed = cjson.decode(existing)
			if parsed.version and parsed.version >= tonumber(ARGV[2]) then
				return 0
			end
		end
		redis.call('HSET', KEYS[1], KEYS[2], ARGV[1])
		return 1
	`;

	await redis.eval(
		luaScript,
		2,
		"redirects",
		field,
		JSON.stringify(redirectRule),
		payload.version.toString(),
	);
}

export async function processOutboxBatch(
	limit = BATCH_LIMIT,
): Promise<ProcessingResult> {
	"use step";

	const result: ProcessingResult = {
		processed: 0,
		failed: 0,
	};

	await db.transaction(async (tx) => {
		const events = await tx
			.select()
			.from(outbox)
			.where(
				and(
					eq(outbox.status, "pending"),
					sql`${outbox.attempts} < ${MAX_ATTEMPTS}`,
				),
			)
			.orderBy(outbox.createdAt)
			.limit(limit)
			.for("update", { skipLocked: true });

		if (events.length === 0) {
			return;
		}

		for (const event of events) {
			try {
				const parsed = outboxEventSchema.parse({
					topic: event.topic,
					payload: event.payload,
				});

				await upsertRedirectToRedis(parsed);

				await tx
					.update(outbox)
					.set({
						status: "done",
						processedAt: new Date(),
						attempts: sql`${outbox.attempts} + 1`,
					})
					.where(eq(outbox.id, event.id));

				result.processed++;
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : "Unknown error";

				await tx
					.update(outbox)
					.set({
						status: "failed",
						lastError: errorMessage,
						attempts: sql`${outbox.attempts} + 1`,
					})
					.where(eq(outbox.id, event.id));

				result.failed++;
				console.error(`[outbox] Failed to process event ${event.id}:`, error);
			}
		}
	});

	return result;
}
