import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import { prisma } from "../src/config/db";
import { cacheRedis, limiterRedis } from "../src/config/redis";
import { WEB_URL } from "../src/constants/env";
import { createShortUrl } from "../src/services/url.service";
import { invalidateUrl, urlCache } from "../src/utils/cache";
import { createTestUser, resetState } from "./helpers/db";

const app = createApp();
/** Fire-and-forget cache writes land asynchronously: wait for the key, don't guess a delay. */
const cachedKey = (code: string) =>
    vi.waitFor(
        async () => {
            if (!(await cacheRedis.exists(`url:v1:${code}`)))
                throw new Error(`url:v1:${code} not cached yet`);
        },
        { timeout: 3_000, interval: 10 },
    );
let userId: string;

async function newLink(url = "https://example.com/target") {
    const dto = await createShortUrl({ url }, { userId });
    await cacheRedis.del(`url:v1:${dto.shortCode}`); // start cold: undo the write-through
    return dto.shortCode;
}

describe("redirect cache", () => {
    beforeEach(async () => {
        await resetState("urls", "users");
        userId = (await createTestUser()).id;
    });
    afterEach(() => vi.restoreAllMocks());

    it("cold code: the first request loads and SETs, the second is a pure hit", async () => {
        const code = await newLink();
        const find = vi.spyOn(prisma.url, "findUnique");
        expect((await request(app).get(`/${code}`)).status).toBe(302);
        await cachedKey(code);

        // Every command either Redis client sends goes through sendCommand
        const cacheCommands = vi.spyOn(cacheRedis, "sendCommand");
        const limiterCommands = vi.spyOn(limiterRedis, "sendCommand");
        const res = await request(app).get(`/${code}`);
        expect(res.headers.location).toBe("https://example.com/target");
        expect(find).toHaveBeenCalledTimes(1); // only the cold request
        expect(cacheCommands).toHaveBeenCalledTimes(1); // the hit path: exactly one network call…
        expect(cacheCommands.mock.calls[0]![0].name).toBe("get");
        expect(limiterCommands).not.toHaveBeenCalled(); // …the redirect limiters are in memory
    });

    it("an unknown code requested twice → one Postgres query (negative cache)", async () => {
        const find = vi.spyOn(prisma.url, "findUnique");
        await request(app).get("/nothing1");
        await cachedKey("nothing1");
        await request(app).get("/nothing1");
        expect(find).toHaveBeenCalledTimes(1);
        expect(await cacheRedis.ttl("url:v1:nothing1")).toBeLessThanOrEqual(60);
    });

    it("probe /sale, then create the alias sale → it redirects immediately", async () => {
        expect((await request(app).get("/sale")).headers.location).toBe(`${WEB_URL}/not-found`);
        await cachedKey("sale"); // the negative entry
        await createShortUrl({ url: "https://example.com/sale", customAlias: "sale" }, { userId });
        await vi.waitFor(async () => expect(await cacheRedis.get("url:v1:sale")).not.toBe("__none__"), {
            timeout: 3_000,
            interval: 10,
        });
        expect((await request(app).get("/sale")).headers.location).toBe("https://example.com/sale");
    });

    it("50 concurrent requests for a cold code → exactly 1 Postgres query", async () => {
        const code = await newLink();
        const find = vi.spyOn(prisma.url, "findUnique");
        const responses = await Promise.all(Array.from({ length: 50 }, () => request(app).get(`/${code}`)));
        expect(responses.every((r) => r.status === 302)).toBe(true);
        expect(find).toHaveBeenCalledTimes(1);
    });

    it("disabling a cached link takes effect once it's invalidated", async () => {
        const code = await newLink();
        await request(app).get(`/${code}`);
        await cachedKey(code);
        await prisma.url.update({ where: { shortCode: code }, data: { status: "disabled" } });
        expect((await request(app).get(`/${code}`)).headers.location).toBe("https://example.com/target"); // still cached
        await invalidateUrl(code);
        expect((await request(app).get(`/${code}`)).headers.location).toBe(`${WEB_URL}/not-found`);
    });

    it("a link expiring in 10s gets a cache TTL ≤ 10s", async () => {
        const dto = await createShortUrl(
            { url: "https://example.com/soon", expiresAt: new Date(Date.now() + 10_000) },
            { userId },
        );
        await cachedKey(dto.shortCode);
        const ttl = await cacheRedis.ttl(`url:v1:${dto.shortCode}`);
        expect(ttl).toBeGreaterThan(0);
        expect(ttl).toBeLessThanOrEqual(10);
    });

    it("counts hits, misses and negatives", async () => {
        const before = { ...urlCache.stats };
        const code = await newLink();
        await request(app).get(`/${code}`); // miss
        await cachedKey(code);
        await request(app).get(`/${code}`); // hit
        await request(app).get("/nothing2"); // miss
        await cachedKey("nothing2");
        await request(app).get("/nothing2"); // negative
        expect(urlCache.stats.hit - before.hit).toBe(1);
        expect(urlCache.stats.miss - before.miss).toBe(2);
        expect(urlCache.stats.negative - before.negative).toBe(1);
    });

    // Last: it takes the client down and brings it back
    it("Redis down: redirects still 302, the breaker opens, then recovers", async () => {
        const codes = await Promise.all(
            Array.from({ length: 8 }, (_, i) => newLink(`https://example.com/${i}`)),
        );
        cacheRedis.disconnect(); // enableOfflineQueue: false → every command now rejects at once
        const get = vi.spyOn(cacheRedis, "get");

        for (const code of codes.slice(0, 5)) expect((await request(app).get(`/${code}`)).status).toBe(302);
        expect(urlCache.breaker.state).toBe("open");
        const callsWhenOpened = get.mock.calls.length;

        for (const code of codes.slice(5)) expect((await request(app).get(`/${code}`)).status).toBe(302);
        expect(get.mock.calls.length).toBe(callsWhenOpened); // open → no Redis calls at all
        expect(urlCache.stats.bypass).toBeGreaterThan(0);

        await cacheRedis.connect();
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(Date.now() + 31_000);
        expect(urlCache.breaker.state).toBe("half-open");
        expect((await request(app).get(`/${codes[0]}`)).status).toBe(302); // the probe succeeds
        expect(urlCache.breaker.state).toBe("closed");
        vi.useRealTimers();
    });
});
