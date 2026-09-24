import type { Redis } from "ioredis";
import { cacheRedis } from "../../config/redis";
import {
    BREAKER,
    DOUBLE_DELETE_DELAY_MS,
    NEGATIVE_TTL_SECONDS,
    NEGATIVE_VALUE,
    URL_KEY_PREFIX,
    URL_TTL_JITTER,
    URL_TTL_SECONDS,
} from "../../constants/cache";
import { CACHE_ENABLED } from "../../constants/env";
import { logger } from "../logger";
import { cacheLookups, trackBreaker } from "../metrics/metrics";
import { CircuitBreaker } from "./circuitBreaker";

/** Only what the redirect needs. Never clickCount: it changes on every click. */
export type CachedUrl = { i: string; u: string; e: number | null };
export const NEGATIVE = Symbol("negative");

export type CacheStats = { hit: number; miss: number; negative: number; bypass: number; error: number };

/** get/set/setNegative/del never throw: every failure degrades to "no cache". */
export function createUrlCache(
    redis: Redis,
    options: { enabled: boolean; now?: () => number } = { enabled: true },
) {
    const breaker = new CircuitBreaker({ ...BREAKER, now: options.now });
    trackBreaker("cache", breaker);
    const stats: CacheStats = { hit: 0, miss: 0, negative: 0, bypass: 0, error: 0 };
    const key = (code: string) => URL_KEY_PREFIX + code;

    async function guarded<T>(op: () => Promise<T>): Promise<T | undefined> {
        if (!options.enabled || breaker.state === "open") {
            stats.bypass++;
            cacheLookups.inc({ result: "bypass" });
            return undefined;
        }
        try {
            return await breaker.exec(op);
        } catch (error) {
            stats.error++;
            logger.debug({ err: (error as Error).message }, "cache call failed");
            return undefined;
        }
    }

    return {
        stats,
        breaker,

        /** A CachedUrl, NEGATIVE for "known not to exist", or null (miss, bypass or error). */
        async get(code: string): Promise<CachedUrl | typeof NEGATIVE | null> {
            const raw = await guarded(() => redis.get(key(code)));
            if (raw === undefined) return null; // bypass/error already counted
            if (raw === null) {
                stats.miss++;
                cacheLookups.inc({ result: "miss" });
                return null;
            }
            if (raw === NEGATIVE_VALUE) {
                stats.negative++;
                cacheLookups.inc({ result: "negative_hit" });
                return NEGATIVE;
            }
            stats.hit++;
            cacheLookups.inc({ result: "hit" });
            return JSON.parse(raw) as CachedUrl;
        },

        async set(code: string, value: CachedUrl, ttlSeconds: number) {
            await guarded(() => redis.set(key(code), JSON.stringify(value), "EX", ttlSeconds));
        },

        async setNegative(code: string) {
            await guarded(() => redis.set(key(code), NEGATIVE_VALUE, "EX", NEGATIVE_TTL_SECONDS));
        },

        async del(code: string) {
            await guarded(() => redis.del(key(code)));
        },
    };
}

export type UrlCache = ReturnType<typeof createUrlCache>;

export const urlCache = createUrlCache(cacheRedis, { enabled: CACHE_ENABLED });

/** 24h ±10%, capped at the time left before the link expires. */
export function ttlFor(expiresAtMs: number | null, now = Date.now()): number {
    const jittered = URL_TTL_SECONDS * (1 + (Math.random() * 2 - 1) * URL_TTL_JITTER);
    const untilExpiry = expiresAtMs === null ? Infinity : (expiresAtMs - now) / 1000;
    return Math.max(1, Math.floor(Math.min(jittered, untilExpiry)));
}

/**
 * After a write that changes where a code points: DEL now, and again a moment later. The second DEL
 * clears a stale value that a concurrent miss on another instance read before our write and SET after it.
 */
export function invalidateUrl(code: string, cache: UrlCache = urlCache, delayMs = DOUBLE_DELETE_DELAY_MS) {
    const first = cache.del(code);
    setTimeout(() => void cache.del(code), delayMs).unref();
    return first;
}
