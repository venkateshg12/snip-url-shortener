import { estimate, windowPosition } from "./slidingWindow";
import type { RateLimitResult, RateLimitStore } from "./types";

/**
 * The same sliding-window math, in process memory. Used for the redirect limiters (no network hop
 * on the hot path) and as the fallback when Redis is down. Limits are per instance.
 */
export class MemoryRateLimitStore implements RateLimitStore {
    private counts = new Map<string, number>();
    private blocks = new Map<string, number>();

    constructor(private readonly now: () => number = () => Date.now()) {
        // Drop old windows now and then; counts older than two windows no longer matter
        setInterval(() => this.sweep(), 60_000).unref();
    }

    async hit(key: string, limit: number, windowMs: number, blockMs = 0): Promise<RateLimitResult> {
        const now = this.now();
        const blockedUntil = this.blocked(key, now);
        if (blockedUntil) return { allowed: false, remaining: 0, resetAt: blockedUntil };

        const { index, elapsed, windowEnd } = windowPosition(now, windowMs);
        const currentKey = `${key}:${index}`;
        const current = this.counts.get(currentKey) ?? 0;
        const previous = this.counts.get(`${key}:${index - 1}`) ?? 0;
        if (estimate(previous, current, elapsed) >= limit) {
            if (blockMs > 0) {
                this.blocks.set(key, now + blockMs);
                return { allowed: false, remaining: 0, resetAt: now + blockMs };
            }
            return { allowed: false, remaining: 0, resetAt: windowEnd };
        }
        this.counts.set(currentKey, current + 1);
        const used = Math.floor(estimate(previous, current + 1, elapsed));
        return { allowed: true, remaining: Math.max(0, limit - used), resetAt: windowEnd };
    }

    async blockedUntil(key: string): Promise<number | null> {
        return this.blocked(key, this.now());
    }

    /** Tests only: forget everything. */
    clear() {
        this.counts.clear();
        this.blocks.clear();
    }

    private blocked(key: string, now: number): number | null {
        const until = this.blocks.get(key);
        if (until === undefined) return null;
        if (until > now) return until;
        this.blocks.delete(key);
        return null;
    }

    private sweep() {
        for (const [key, until] of this.blocks) if (until <= this.now()) this.blocks.delete(key);
        if (this.counts.size > 100_000) this.counts.clear(); // bounded memory under a flood of keys
    }
}
