import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import { prisma } from "../src/config/db";
import { cacheRedis } from "../src/config/redis";
import { WEB_URL } from "../src/constants/env";
import { resetState } from "./helpers/db";

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

async function signUp(name: string) {
    const agent = request.agent(app);
    await agent
        .post("/api/auth/register")
        .send({ name, email: `${name.toLowerCase()}@example.test`, password: "password-123" });
    return agent;
}

describe("link management (owner only)", () => {
    beforeEach(() => resetState("urls", "sessions", "users"));

    it("anonymous creation still works; logged-in creation records the owner", async () => {
        const anon = await request(app).post("/api/urls").send({ url: "https://example.com/anon" });
        expect(anon.status).toBe(201);
        const alice = await signUp("Alice");
        const owned = await alice
            .post("/api/urls")
            .send({ url: "https://example.com/mine", customAlias: "alice-link" });
        expect(owned.status).toBe(201);
        const row = await prisma.url.findUniqueOrThrow({
            where: { shortCode: "alice-link" },
            include: { user: true },
        });
        expect(row.user?.name).toBe("Alice");
        expect(
            (await prisma.url.findUniqueOrThrow({ where: { shortCode: anon.body.data.shortCode } })).userId,
        ).toBeNull();
    });

    it("another user gets 404 on GET, PATCH and DELETE", async () => {
        const alice = await signUp("Alice");
        const bob = await signUp("Bob");
        await alice.post("/api/urls").send({ url: "https://example.com", customAlias: "alices" });
        expect((await bob.get("/api/urls/alices")).status).toBe(404);
        expect((await bob.patch("/api/urls/alices").send({ status: "disabled" })).status).toBe(404);
        expect((await bob.delete("/api/urls/alices")).status).toBe(404);
        expect((await alice.get("/api/urls/alices")).status).toBe(200);
        expect((await request(app).get("/api/urls/alices")).status).toBe(401); // and nobody anonymous
    });

    it("PATCH disable on a cached link → the next redirect goes to /not-found", async () => {
        const alice = await signUp("Alice");
        await alice.post("/api/urls").send({ url: "https://example.com/live", customAlias: "live-one" });
        await cachedKey("live-one");
        expect((await request(app).get("/live-one")).headers.location).toBe("https://example.com/live"); // cached
        const patched = await alice.patch("/api/urls/live-one").send({ status: "disabled" });
        expect(patched.body.data.status).toBe("disabled");
        expect((await request(app).get("/live-one")).headers.location).toBe(`${WEB_URL}/not-found`);
    });

    it("PATCH expiry sets purge_at 30 days later; null removes both", async () => {
        const alice = await signUp("Alice");
        await alice.post("/api/urls").send({ url: "https://example.com", customAlias: "timed" });
        const expiresAt = new Date(Date.now() + 86_400_000);
        await alice.patch("/api/urls/timed").send({ expiresAt: expiresAt.toISOString() });
        let row = await prisma.url.findUniqueOrThrow({ where: { shortCode: "timed" } });
        expect(row.purgeAt!.getTime() - row.expiresAt!.getTime()).toBe(30 * 86_400_000);
        await alice.patch("/api/urls/timed").send({ expiresAt: null });
        row = await prisma.url.findUniqueOrThrow({ where: { shortCode: "timed" } });
        expect([row.expiresAt, row.purgeAt]).toEqual([null, null]);
        expect((await alice.patch("/api/urls/timed").send({})).status).toBe(400); // nothing to update
    });

    it("DELETE is soft: the link stops, disappears from lists, and the alias stays taken", async () => {
        const alice = await signUp("Alice");
        await alice.post("/api/urls").send({ url: "https://example.com", customAlias: "gone-soon" });
        expect((await alice.delete("/api/urls/gone-soon")).status).toBe(204);
        expect((await request(app).get("/gone-soon")).headers.location).toBe(`${WEB_URL}/not-found`);
        expect((await alice.get("/api/urls")).body.data).toHaveLength(0);
        const row = await prisma.url.findUniqueOrThrow({ where: { shortCode: "gone-soon" } });
        expect(row.status).toBe("deleted");
        const bob = await signUp("Bob");
        expect(
            (await bob.post("/api/urls").send({ url: "https://evil.example", customAlias: "gone-soon" }))
                .status,
        ).toBe(409);
    });

    it("listing: 25 links, limit 10 → three pages, newest first, hasMore false on the last", async () => {
        const alice = await signUp("Alice");
        const user = await prisma.user.findFirstOrThrow({ where: { name: "Alice" } });
        const base = Date.now();
        await prisma.url.createMany({
            data: Array.from({ length: 25 }, (_, i) => ({
                id: BigInt(9_000_000 + i),
                shortCode: `list${String(i).padStart(2, "0")}`,
                longUrl: "https://example.com",
                userId: user.id,
                createdAt: new Date(base + i * 1000),
            })),
        });
        const pages = await Promise.all(
            [1, 2, 3].map((page) => alice.get(`/api/urls?page=${page}&limit=10`)),
        );
        expect(pages.map((p) => p.body.data.length)).toEqual([10, 10, 5]);
        expect(pages.map((p) => p.body.meta.hasMore)).toEqual([true, true, false]);
        expect(pages[0]!.body.meta).toMatchObject({ page: 1, limit: 10, total: 25 });
        expect(pages[0]!.body.data[0].shortCode).toBe("list24"); // newest first
        expect((await alice.get("/api/urls?limit=500")).status).toBe(400); // capped at 100
    });
});
