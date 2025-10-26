import IORedis from "ioredis";

const url = process.env.REDIS_URL ?? "redis://localhost:5498";

export const redis = new IORedis(url, {
	maxRetriesPerRequest: null,
	enableReadyCheck: true,
});

redis.on("connect", () => console.log("[redis] connected:", url));
redis.on("error", (err) => console.error("[redis] error:", err.message));
