import { Redis, type RedisOptions } from "ioredis";
import { CACHE_COMMAND_TIMEOUT_MS, REDIS_CACHE_URL, REDIS_QUEUE_URL } from "../constants/env";
import { logger } from "../utils/logger";

/**
 * The cache client fails FAST. ioredis's default queues commands while disconnected, which turns a
 * Redis outage into hanging redirects. Here a disconnected client rejects at once, and a slow one
 * times out (CACHE_COMMAND_TIMEOUT_MS, 50ms by default); the circuit breaker (utils/cache) then stops calling it altogether.
 */
export function createFailFastRedis(url: string, name = "cache") {
    const client = new Redis(url, {
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
        commandTimeout: CACHE_COMMAND_TIMEOUT_MS,
        connectTimeout: 2_000,
        retryStrategy: (times) => Math.min(times * 200, 2_000), // keep reconnecting in the background
    });
    // Without a listener, ioredis reports every connection error as unhandled
    client.on("error", (err) => logger.warn({ err: err.message, client: name }, "redis error"));
    return client;
}

export const cacheRedis = createFailFastRedis(REDIS_CACHE_URL, "cache");

/**
 * Rate-limit counters must never be evicted, so they live on the noeviction instance (redis-queue),
 * but through their own fail-fast client: BullMQ's connection waits forever during an outage.
 */
export const limiterRedis = createFailFastRedis(REDIS_QUEUE_URL, "limiter");

/** BullMQ (phase 7) needs the opposite: never give up on a command (maxRetriesPerRequest: null). */
export const queueRedisOptions: RedisOptions = { maxRetriesPerRequest: null };

/**
 * At boot, give the cache a moment to connect: otherwise the first redirects fail against a
 * half-open socket and can trip the breaker for 30s. Never blocks for long: the cache is optional.
 */
export async function waitForCache(client = cacheRedis, timeoutMs = 2_000): Promise<boolean> {
    if (client.status === "ready") return true;
    return new Promise((resolve) => {
        const timer = setTimeout(() => {
            client.off("ready", onReady);
            resolve(false);
        }, timeoutMs);
        const onReady = () => {
            clearTimeout(timer);
            resolve(true);
        };
        client.once("ready", onReady);
    });
}
