export type RateLimitResult = {
    allowed: boolean;
    /** Requests left in the current window (0 when rejected). */
    remaining: number;
    /** Epoch ms when the caller may try again. */
    resetAt: number;
};

export interface RateLimitStore {
    /** Counts one request against `key` and says whether it's allowed. */
    hit(key: string, limit: number, windowMs: number, blockMs?: number): Promise<RateLimitResult>;
    /** Whether `key` is currently blocked, without counting a request. */
    blockedUntil(key: string): Promise<number | null>;
}
