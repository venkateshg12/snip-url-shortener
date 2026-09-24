import type { Redis } from "ioredis";
import { BREAKER } from "../../constants/cache";
import { logger } from "../logger";
import { CircuitBreaker } from "../cache/circuitBreaker";
import { MemoryRateLimitStore } from "./memoryStore";
import { estimate, SLIDING_WINDOW_LUA, windowPosition } from "./slidingWindow";
import type { RateLimitResult, RateLimitStore } from "./types";

type SlidingWindowRedis = Redis & {
    slidingWindow(
        current: string,
        previous: string,
        block: string,
        limit: number,
        windowMs: number,
        elapsed: number,
        blockMs: number,
    ): Promise<[number, number, number, number]>;
};

/**
 * Global limits across every API instance, via one atomic Lua script (EVALSHA).
 * Fails OPEN: when Redis is unavailable the per-instance memory store takes over, so the app keeps
 * serving with approximate limits instead of rejecting everyone or hanging.
 */
export class RedisRateLimitStore implements RateLimitStore {
    private readonly redis: SlidingWindowRedis;
    readonly breaker = new CircuitBreaker(BREAKER);
    private readonly fallback = new MemoryRateLimitStore();
    private degraded = false;

    constructor(redis: Redis) {
        redis.defineCommand("slidingWindow", { numberOfKeys: 3, lua: SLIDING_WINDOW_LUA });
        this.redis = redis as SlidingWindowRedis;
    }

    async hit(key: string, limit: number, windowMs: number, blockMs = 0): Promise<RateLimitResult> {
        const now = Date.now();
        const { index, elapsed, windowEnd } = windowPosition(now, windowMs);
        const tag = `rl:{${key}}`; // the hash tag keeps all three keys in one Cluster slot
        try {
            const [allowed, current, blockPttl, previous] = await this.breaker.exec(() =>
                this.redis.slidingWindow(
                    `${tag}:${index}`,
                    `${tag}:${index - 1}`,
                    `${tag}:block`,
                    limit,
                    windowMs,
                    elapsed,
                    blockMs,
                ),
            );
            this.setDegraded(false);
            if (!allowed)
                return { allowed: false, remaining: 0, resetAt: blockPttl > 0 ? now + blockPttl : windowEnd };
            const used = Math.floor(estimate(previous, current, elapsed)); // `current` includes this request
            return { allowed: true, remaining: Math.max(0, limit - used), resetAt: windowEnd };
        } catch {
            this.setDegraded(true);
            return this.fallback.hit(key, limit, windowMs, blockMs);
        }
    }

    async blockedUntil(key: string): Promise<number | null> {
        try {
            const pttl = await this.breaker.exec(() => this.redis.pttl(`rl:{${key}}:block`));
            return pttl > 0 ? Date.now() + pttl : null;
        } catch {
            return this.fallback.blockedUntil(key);
        }
    }

    /** Log once per transition, not once per request. */
    private setDegraded(degraded: boolean) {
        if (degraded === this.degraded) return;
        this.degraded = degraded;
        if (degraded) logger.warn("rate limiter: Redis unavailable, falling back to per-instance limits");
        else logger.info("rate limiter: Redis back, limits are global again");
    }
}
