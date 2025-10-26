import { sleep } from "workflow";
import { redis } from "@/lib/redis";

const LOCK_KEY = "worker:sync:lock";
const STOP_KEY = "worker:sync:stop";
const LOCK_TTL_SECONDS = 90;

function withJitter(ms: number) {
	const jitter = Math.floor(ms * 0.2 * Math.random()); // ±20%
	return ms - Math.floor(ms * 0.1) + jitter;
}

async function acquireLock(lockKey: string, ttl: number) {
	"use step";
	const token = crypto.randomUUID();
	const ok = await redis.set(lockKey, token, "EX", ttl, "NX");
	return { acquired: ok === "OK", token };
}

async function renewLock(lockKey: string, token: string, ttl: number) {
	"use step";
	const owner = (await redis.get(lockKey)) as string | null;
	if (owner !== token) return false;
	await redis.expire(lockKey, ttl);
	return true;
}

async function releaseLock(lockKey: string, token: string) {
	"use step";
	const UNLOCK_LUA = `
    if redis.call('get', KEYS[1]) == ARGV[1] then
      return redis.call('del', KEYS[1])
    else
      return 0
    end
  `;
	await redis.eval(UNLOCK_LUA, 1, lockKey, token);
}

async function checkStopFlag(stopKey: string) {
	"use step";
	const v = (await redis.get(stopKey)) as string | null;
	return v === "1";
}

type TickResult = { processed: number };
async function outboxTick(): Promise<TickResult> {
	"use step";
	console.log("---------------- PROCESSING HERE ----------------");
	// TODO: implement:
	// 1) SELECT … FOR UPDATE SKIP LOCKED
	// 2) upsert to Redis read-model (idempotent by version)
	// 3) mark events processed
	return { processed: 0 };
}

export async function syncOutboxWorkflow() {
	"use workflow";

	const { acquired, token } = await acquireLock(LOCK_KEY, LOCK_TTL_SECONDS);
	if (!acquired) return; // another run owns the singleton

	let backoffMs = 500;
	const backoffMaxMs = 30_000;

	try {
		while (true) {
			const shouldStop = await checkStopFlag(STOP_KEY);
			if (shouldStop) break;

			const { processed } = await outboxTick();

			const stillOwner = await renewLock(LOCK_KEY, token, LOCK_TTL_SECONDS);
			if (!stillOwner) break;

			backoffMs =
				processed > 0
					? 500
					: Math.min(backoffMaxMs, Math.floor(backoffMs * 1.8));

			// Apply jitter (±20%) and sleep -> workflows are smoothed out
			const jittered = withJitter(backoffMs);
			await sleep(`${Math.ceil(jittered / 1000)}s`);
		}
	} finally {
		await releaseLock(LOCK_KEY, token);
	}
}
