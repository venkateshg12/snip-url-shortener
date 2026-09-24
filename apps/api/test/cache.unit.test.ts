import { describe, expect, it } from "vitest";
import { BreakerOpenError, CircuitBreaker, singleFlight, ttlFor } from "../src/utils/cache";

describe("CircuitBreaker", () => {
    const setup = () => {
        let now = 0;
        const breaker = new CircuitBreaker({
            failureThreshold: 5,
            windowMs: 10_000,
            openMs: 30_000,
            now: () => now,
        });
        return { breaker, advance: (ms: number) => (now += ms) };
    };
    const fail = () => Promise.reject(new Error("down"));
    const succeed = () => Promise.resolve("ok");

    it("opens after 5 failures within 10s and skips calls while open", async () => {
        const { breaker } = setup();
        for (let i = 0; i < 5; i++) await breaker.exec(fail).catch(() => {});
        expect(breaker.state).toBe("open");
        let called = false;
        await expect(breaker.exec(async () => (called = true))).rejects.toBeInstanceOf(BreakerOpenError);
        expect(called).toBe(false);
    });

    it("failures spread beyond the window don't open it", async () => {
        const { breaker, advance } = setup();
        for (let i = 0; i < 8; i++) {
            await breaker.exec(fail).catch(() => {});
            advance(3_000);
        }
        expect(breaker.state).toBe("closed");
    });

    it("half-opens after 30s: a good probe closes it, a bad one re-opens it", async () => {
        const { breaker, advance } = setup();
        for (let i = 0; i < 5; i++) await breaker.exec(fail).catch(() => {});
        advance(30_000);
        expect(breaker.state).toBe("half-open");
        await breaker.exec(fail).catch(() => {});
        expect(breaker.state).toBe("open");
        advance(30_000);
        await expect(breaker.exec(succeed)).resolves.toBe("ok");
        expect(breaker.state).toBe("closed");
    });

    it("allows exactly one probe at a time", async () => {
        const { breaker, advance } = setup();
        for (let i = 0; i < 5; i++) await breaker.exec(fail).catch(() => {});
        advance(30_000);
        let release!: () => void;
        const slowProbe = breaker.exec(() => new Promise<void>((r) => (release = r)));
        await expect(breaker.exec(succeed)).rejects.toBeInstanceOf(BreakerOpenError);
        release();
        await slowProbe;
        expect(breaker.state).toBe("closed");
    });
});

describe("ttlFor", () => {
    it("is 24h ±10%", () => {
        for (let i = 0; i < 200; i++) {
            const ttl = ttlFor(null);
            expect(ttl).toBeGreaterThanOrEqual(Math.floor(86_400 * 0.9));
            expect(ttl).toBeLessThanOrEqual(Math.ceil(86_400 * 1.1));
        }
    });

    it("never outlives the link", () => {
        expect(ttlFor(Date.now() + 10_000)).toBeLessThanOrEqual(10);
        expect(ttlFor(Date.now() + 10)).toBe(1);
    });
});

describe("singleFlight", () => {
    it("shares one load between concurrent callers, then forgets it", async () => {
        let loads = 0;
        const load = () => new Promise<number>((r) => setTimeout(() => r(++loads), 10));
        const results = await Promise.all(Array.from({ length: 20 }, () => singleFlight("k", load)));
        expect(new Set(results)).toEqual(new Set([1]));
        expect(await singleFlight("k", load)).toBe(2);
    });
});
