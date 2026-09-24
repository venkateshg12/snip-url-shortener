import { createMissLimiter, createRateLimiter } from "../middleware/rateLimiter";
import { HOUR_MS, MINUTE_MS, RATE_LIMIT_PREFIXES as P } from "../constants/rateLimiter.constant";
import { extractClientIp, MemoryRateLimitStore, RedisRateLimitStore } from "../utils/rateLimiter";
import { trackBreaker } from "../utils/metrics/metrics";
import { limiterRedis } from "./redis";

/** Global limits (every instance shares them), for the expensive, abusable operations. */
export const redisStore = new RedisRateLimitStore(limiterRedis);
trackBreaker("rate-limiter", redisStore.breaker);
/** Per-instance limits for redirects: no network hop on the hot path. With N instances, ≈ N × the limit. */
export const memoryStore = new MemoryRateLimitStore();

const ANONYMOUS_CREATES_PER_HOUR = 10;
const USER_CREATES_PER_HOUR = 60;

export const createLimiter = createRateLimiter({
    prefix: P.create,
    windowMs: HOUR_MS,
    max: (req) => (req.userId ? USER_CREATES_PER_HOUR : ANONYMOUS_CREATES_PER_HOUR),
    keyResolver: (req) => (req.userId ? `user:${req.userId}` : `ip:${extractClientIp(req)}`),
    store: redisStore,
});

// Used by the auth routes (phase 6)
export const loginLimiter = createRateLimiter({
    prefix: P.login,
    windowMs: 15 * MINUTE_MS,
    blockMs: HOUR_MS,
    max: 10,
    keyResolver: (req) => {
        const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "none";
        return `ip:${extractClientIp(req)}:email:${email}`;
    },
    store: redisStore,
});

export const registerLimiter = createRateLimiter({
    prefix: P.register,
    windowMs: 15 * MINUTE_MS,
    blockMs: HOUR_MS,
    max: 10,
    store: redisStore,
});

export const apiLimiter = createRateLimiter({
    prefix: P.api,
    windowMs: 5 * MINUTE_MS,
    max: 300,
    store: redisStore,
});

export const redirectLimiter = createRateLimiter({
    prefix: P.redirect,
    windowMs: MINUTE_MS,
    max: 600,
    store: memoryStore,
    respond: "html",
});

/** 60 not-found redirects a minute from one IP → blocked for 10 minutes. Stops code enumeration. */
export const missLimiter = createMissLimiter({
    prefix: P.miss,
    windowMs: MINUTE_MS,
    max: 60,
    blockMs: 10 * MINUTE_MS,
    store: memoryStore,
    respond: "html",
});
