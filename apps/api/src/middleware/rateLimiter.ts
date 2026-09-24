import type { Request, RequestHandler, Response } from "express";
import { AppErrorCode } from "../constants/appErrorCode";
import { TOO_MANY_REQUESTS } from "../constants/http";
import { HTTP_HEADERS } from "../constants/rateLimiter.constant";
import { fail } from "../utils/api";
import { catchError } from "../utils/errors";
import { rateLimitRejections } from "../utils/metrics/metrics";
import { extractClientIp, type RateLimitStore } from "../utils/rateLimiter";

export type RateLimiterOptions = {
    prefix: string;
    windowMs: number;
    /** A number, or a function of the request (e.g. more for logged-in users), as in the Mongo factory. */
    max: number | ((req: Request) => number);
    store: RateLimitStore;
    /** Once over the limit, reject everything for this long (default: until the window moves on). */
    blockMs?: number;
    keyResolver?: (req: Request) => string;
    /** How a rejection looks: the API's JSON envelope, or a small page for people clicking links. */
    respond?: "json" | "html";
};

const minutesUntil = (at: number) => Math.max(1, Math.ceil((at - Date.now()) / 60_000));

export function sendTooManyRequests(
    res: Response,
    resetAt: number,
    respond: "json" | "html" = "json",
    limiter = "unknown",
) {
    rateLimitRejections.inc({ limiter });
    const seconds = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
    const minutes = minutesUntil(resetAt);
    const message = `Too many requests. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
    res.setHeader(HTTP_HEADERS.RETRY_AFTER, seconds);
    res.status(TOO_MANY_REQUESTS);
    if (respond === "html") {
        res.type("html").send(
            `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Slow down</title><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1rem;line-height:1.5"><h1>Slow down</h1><p>${message}</p></body></html>`,
        );
    } else {
        res.json(fail(message, AppErrorCode.TooManyRequests));
    }
}

export function createRateLimiter(options: RateLimiterOptions): RequestHandler {
    const keyResolver = options.keyResolver ?? ((req: Request) => `ip:${extractClientIp(req)}`);

    return catchError(async (req, res, next) => {
        const limit = typeof options.max === "function" ? options.max(req) : options.max;
        const key = `${options.prefix}:${keyResolver(req)}`;
        const result = await options.store.hit(key, limit, options.windowMs, options.blockMs);

        res.setHeader(HTTP_HEADERS.RATELIMIT_LIMIT, limit);
        res.setHeader(HTTP_HEADERS.RATELIMIT_REMAINING, result.remaining);
        res.setHeader(HTTP_HEADERS.RATELIMIT_RESET, Math.ceil(result.resetAt / 1000));
        if (result.allowed) return next();
        sendTooManyRequests(res, result.resetAt, options.respond, options.prefix);
    });
}

/**
 * Counts only failures: `guard` rejects keys that are blocked, and `record` (called when a request
 * turned out to be a miss) counts toward the block. Scanners produce misses; real visitors don't.
 */
export function createMissLimiter(
    options: Omit<RateLimiterOptions, "max" | "keyResolver"> & { max: number; blockMs: number },
) {
    const keyOf = (req: Request) => `${options.prefix}:ip:${extractClientIp(req)}`;
    const guard: RequestHandler = catchError(async (req, res, next) => {
        const blockedUntil = await options.store.blockedUntil(keyOf(req));
        if (blockedUntil === null) return next();
        sendTooManyRequests(res, blockedUntil, options.respond, options.prefix);
    });
    const record = async (req: Request) => {
        const key = keyOf(req);
        try {
            const result = await options.store.hit(key, options.max, options.windowMs, options.blockMs);
            // The budget is spent: place the block now (one more hit over the limit sets it), so the
            // very next request is rejected rather than the one after it
            if (result.allowed && result.remaining === 0) {
                await options.store.hit(key, options.max, options.windowMs, options.blockMs);
            }
        } catch {
            // Limiting is best-effort: never fail a redirect because of it
        }
    };
    return { guard, record };
}
