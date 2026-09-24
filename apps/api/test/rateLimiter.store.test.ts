import { Redis } from "ioredis";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    ipv6Prefix64,
    MemoryRateLimitStore,
    RedisRateLimitStore,
    type RateLimitStore,
} from "../src/utils/rateLimiter";
import { resetState } from "./helpers/db";

const clients: Redis[] = [];
const newRedisStore = () => {
    const client = new Redis(process.env.REDIS_QUEUE_URL!);
    clients.push(client);
    return new RedisRateLimitStore(client);
};
afterAll(() => Promise.all(clients.map((c) => c.quit())));

const WINDOW = 60_000;
const hits = async (store: RateLimitStore, key: string, n: number, blockMs?: number) => {
    const results = [];
    for (let i = 0; i < n; i++) results.push(await store.hit(key, 10, WINDOW, blockMs));
    return results;
};

describe.each([
    ["redis", newRedisStore],
    ["memory", () => new MemoryRateLimitStore()],
] as const)("%s store: sliding window", (_name, makeStore) => {
    beforeEach(() => resetState());
    afterEach(() => vi.useRealTimers());

    it("allows 10, rejects the 11th, and counts down remaining", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(Math.floor(Date.now() / WINDOW) * WINDOW + 1_000); // early in a window
        const results = await hits(makeStore(), `k:${Math.random()}`, 11);
        expect(results.slice(0, 10).every((r) => r.allowed)).toBe(true);
        expect(results[9]!.remaining).toBe(0);
        expect(results[10]!.allowed).toBe(false);
    });

    it("allows again once the window has passed", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        const start = Math.floor(Date.now() / WINDOW) * WINDOW + 1_000;
        vi.setSystemTime(start);
        const store = makeStore();
        const key = `k:${Math.random()}`;
        await hits(store, key, 10);
        vi.setSystemTime(start + 2 * WINDOW); // both windows are now in the past
        expect((await store.hit(key, 10, WINDOW)).allowed).toBe(true);
    });

    it("no double burst at the boundary", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        const windowStart = Math.floor(Date.now() / WINDOW) * WINDOW;
        const store = makeStore();
        const key = `k:${Math.random()}`;
        vi.setSystemTime(windowStart + 0.99 * WINDOW); // 10 at the very end of a window…
        expect((await hits(store, key, 10)).every((r) => r.allowed)).toBe(true);
        vi.setSystemTime(windowStart + 1.01 * WINDOW); // …then the next window starts
        const next = await hits(store, key, 10);
        // A fixed window would allow 10 more here; the sliding estimate (10 × 0.99 ≈ 9.9) allows ~1
        expect(next.filter((r) => r.allowed).length).toBeLessThanOrEqual(1);
    });

    it("blocks for blockMs once over the limit", async () => {
        const store = makeStore();
        const key = `k:${Math.random()}`;
        const results = await hits(store, key, 11, 3_600_000);
        expect(results[10]!.allowed).toBe(false);
        expect(results[10]!.resetAt).toBeGreaterThan(Date.now() + 3_500_000);
        expect(await store.blockedUntil(key)).toBeGreaterThan(Date.now());
    });
});

describe("redis store is global", () => {
    beforeEach(() => resetState());

    it("two instances (separate clients) share one limit", async () => {
        const a = newRedisStore();
        const b = newRedisStore();
        const key = `shared:${Math.random()}`;
        const results = [];
        for (let i = 0; i < 12; i++) results.push(await (i % 2 ? a : b).hit(key, 10, WINDOW));
        expect(results.filter((r) => r.allowed)).toHaveLength(10);
    });
});

describe("ipv6Prefix64", () => {
    it.each([
        ["2001:db8:85a3:8d3:1319:8a2e:370:7348", "2001:db8:85a3:8d3::/64"],
        ["2001:db8::1", "2001:db8:0:0::/64"],
        ["2001:0db8:0000:0042::abcd", "2001:db8:0:42::/64"],
    ])("%s → %s", (ip, prefix) => {
        expect(ipv6Prefix64(ip)).toBe(prefix);
    });
});
