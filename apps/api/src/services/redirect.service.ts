import { prisma } from "../config/db";
import { type CachedUrl, NEGATIVE, singleFlight, ttlFor, urlCache } from "../utils/cache";

export type ResolveResult =
    { kind: "found"; urlId: string; longUrl: string } | { kind: "expired" } | { kind: "not_found" };

const RESOLVE_SELECT = { id: true, longUrl: true, expiresAt: true, status: true } as const;

export const toCached = (url: { id: bigint; longUrl: string; expiresAt: Date | null }): CachedUrl => ({
    i: url.id.toString(), // a string: Redis and BullMQ (phase 7) can't carry a bigint
    u: url.longUrl,
    e: url.expiresAt?.getTime() ?? null,
});

const evaluate = (cached: CachedUrl): ResolveResult =>
    cached.e !== null && cached.e <= Date.now()
        ? { kind: "expired" }
        : { kind: "found", urlId: cached.i, longUrl: cached.u };

/**
 * Cache first. On a miss, concurrent requests for the same code share one Postgres query
 * (single-flight), and the result is cached without making the visitor wait for the SET.
 */
export async function resolveShortCode(code: string): Promise<ResolveResult> {
    const cached = await urlCache.get(code); // null on miss, breaker open, or any error
    if (cached === NEGATIVE) return { kind: "not_found" };
    if (cached) return evaluate(cached);

    return singleFlight(code, async () => {
        const url = await prisma.url.findUnique({ where: { shortCode: code }, select: RESOLVE_SELECT });
        if (!url || url.status !== "active") {
            void urlCache.setNegative(code);
            return { kind: "not_found" } as const;
        }
        const value = toCached(url);
        if (value.e === null || value.e > Date.now()) void urlCache.set(code, value, ttlFor(value.e));
        return evaluate(value);
    });
}
