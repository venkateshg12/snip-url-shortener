export class BreakerOpenError extends Error {
    constructor() {
        super("circuit open");
        this.name = "BreakerOpenError";
    }
}

type BreakerOptions = { failureThreshold: number; windowMs: number; openMs: number; now?: () => number };
export type BreakerState = "closed" | "open" | "half-open";

/**
 * closed ──N failures within the window──▶ open ──after openMs──▶ half-open ──probe ok──▶ closed
 *                                            ▲                        │
 *                                            └──────probe fails───────┘
 * While open, calls are skipped instantly instead of each waiting for a timeout.
 */
export class CircuitBreaker {
    private failures: number[] = [];
    private openedAt: number | null = null;
    private probing = false;
    private readonly now: () => number;

    constructor(private readonly options: BreakerOptions) {
        // Read the clock on every call (not a captured Date.now), so fake timers and clock changes apply
        this.now = options.now ?? (() => Date.now());
    }

    get state(): BreakerState {
        if (this.openedAt === null) return "closed";
        return this.now() - this.openedAt >= this.options.openMs ? "half-open" : "open";
    }

    async exec<T>(fn: () => Promise<T>): Promise<T> {
        const state = this.state;
        if (state === "open" || (state === "half-open" && this.probing)) throw new BreakerOpenError();
        const isProbe = state === "half-open";
        if (isProbe) this.probing = true;
        try {
            const result = await fn();
            if (isProbe) this.reset();
            return result;
        } catch (error) {
            this.recordFailure(isProbe);
            throw error;
        } finally {
            if (isProbe) this.probing = false;
        }
    }

    private recordFailure(isProbe: boolean) {
        const now = this.now();
        if (isProbe) {
            this.openedAt = now; // the probe failed: open for another full period
            return;
        }
        this.failures = this.failures.filter((t) => now - t < this.options.windowMs);
        this.failures.push(now);
        if (this.failures.length >= this.options.failureThreshold) this.openedAt = now;
    }

    private reset() {
        this.failures = [];
        this.openedAt = null;
    }
}
