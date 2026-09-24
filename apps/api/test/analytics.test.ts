import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import { prisma } from "../src/config/db";
import { clickRecorder } from "../src/jobs/producers";
import { clickQueue, clickQueueConnection } from "../src/jobs/queues/click.queue";
import { startWorkers } from "../src/jobs/workers";
import { uuidv7 } from "../src/utils/uuidv7";
import { resetState } from "./helpers/db";

const app = createApp();
const IPHONE =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

async function signUpWithLink(alias: string) {
    const agent = request.agent(app);
    await agent
        .post("/api/auth/register")
        .send({ name: alias, email: `${alias}@example.test`, password: "password-123" });
    await agent.post("/api/urls").send({ url: "https://example.com/tracked", customAlias: alias });
    return agent;
}

describe("click analytics end to end", () => {
    beforeEach(() => resetState("clicks", "urls", "sessions", "users"));
    afterEach(async () => {
        if (clickQueueConnection.status !== "ready")
            await clickQueueConnection.connect().catch(() => undefined);
    });

    it("clicks appear in stats within ~2 seconds", async () => {
        const workers = startWorkers();
        try {
            const owner = await signUpWithLink("tracked");
            for (let i = 0; i < 5; i++) {
                const res = await request(app)
                    .get("/tracked")
                    .set("User-Agent", IPHONE)
                    .set("X-Forwarded-For", `198.51.100.${i}`);
                expect(res.status).toBe(302);
            }
            const started = Date.now();
            await clickRecorder.flush(); // what the 1s timer does
            await vi.waitFor(
                async () => {
                    const stats = (await owner.get("/api/urls/tracked/stats?days=7&tz=UTC")).body.data;
                    if (stats.totals.clicks !== 5) {
                        await prisma.$executeRaw`SELECT 1`; // keep polling
                        throw new Error(`clicks: ${stats.totals.clicks}`);
                    }
                    return stats;
                },
                { timeout: 2_000, interval: 50 },
            );
            expect(Date.now() - started).toBeLessThan(2_000);
            // Past the 60s stats cache: read the rows directly for the breakdowns
            const devices = await prisma.click.groupBy({ by: ["device"], _count: true });
            expect(devices).toEqual([{ device: "mobile", _count: 5 }]);
        } finally {
            await workers.close();
        }
    });

    it("with no worker running, redirects are unaffected and batches wait in the queue", async () => {
        await signUpWithLink("queued");
        await clickQueue.drain();
        const started = Date.now();
        for (let i = 0; i < 20; i++) expect((await request(app).get("/queued")).status).toBe(302);
        expect(Date.now() - started).toBeLessThan(2_000);
        await clickRecorder.flush();
        expect(await clickQueue.getWaitingCount()).toBeGreaterThan(0);
        await clickQueue.drain();
    });

    it("Redis queue down: redirects still 302, and the dropped clicks are counted", async () => {
        await signUpWithLink("offline");
        clickQueueConnection.disconnect();
        const droppedBefore = clickRecorder.stats.dropped;
        for (let i = 0; i < 3; i++) expect((await request(app).get("/offline")).status).toBe(302);
        await clickRecorder.flush();
        expect(clickRecorder.stats.dropped - droppedBefore).toBe(3);
    });
});

describe("GET /api/urls/:code/stats", () => {
    beforeEach(() => resetState("clicks", "urls", "sessions", "users"));

    it("buckets by day in the viewer's time zone, zero-filled, with uniques per day", async () => {
        const owner = await signUpWithLink("tzlink");
        const url = await prisma.url.findUniqueOrThrow({ where: { shortCode: "tzlink" } });
        const now = Date.now();
        // Spread over 3 days, including times near midnight, so UTC and Kolkata disagree on the day
        const times = [
            now - 2 * 86_400_000,
            now - 86_400_000 - 3 * 3_600_000,
            now - 86_400_000 + 5 * 3_600_000,
            now - 60_000,
            now - 30_000,
        ];
        await prisma.click.createMany({
            data: times.map((t, i) => ({
                id: uuidv7(t),
                urlId: url.id,
                occurredAt: new Date(t),
                visitor: (i === 4 ? "b" : i === 3 ? "b" : String.fromCharCode(99 + i)).repeat(64), // last two: same visitor
                device: "mobile",
            })),
        });

        for (const tz of ["UTC", "Asia/Kolkata"]) {
            const stats = (await owner.get(`/api/urls/tzlink/stats?days=4&tz=${encodeURIComponent(tz)}`)).body
                .data;
            const dayOf = (t: number) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(t); // YYYY-MM-DD
            const today = dayOf(now);
            expect(stats.byDay).toHaveLength(4);
            expect(stats.byDay.at(-1).date).toBe(today);
            const expected = new Map<string, number>();
            for (const t of times) expected.set(dayOf(t), (expected.get(dayOf(t)) ?? 0) + 1);
            for (const day of stats.byDay) expect(day.clicks).toBe(expected.get(day.date) ?? 0); // zero days present
            // Uniques per day = distinct visitors per day (computed from the fixture, so the time of day doesn't matter)
            const visitorsByDay = new Map<string, Set<string>>();
            times.forEach((t, i) => {
                const visitor = i === 4 || i === 3 ? "b" : String.fromCharCode(99 + i);
                visitorsByDay.set(dayOf(t), (visitorsByDay.get(dayOf(t)) ?? new Set()).add(visitor));
            });
            for (const day of stats.byDay) expect(day.uniques).toBe(visitorsByDay.get(day.date)?.size ?? 0);
            expect(stats.totals.clicks).toBe(5);
            expect(stats.devices).toEqual([{ key: "mobile", count: 5 }]);
        }
    });

    it("another user → 404; a bad time zone → 400", async () => {
        const owner = await signUpWithLink("mine");
        const other = request.agent(app);
        await other
            .post("/api/auth/register")
            .send({ name: "Other", email: "other@example.test", password: "password-123" });
        expect((await other.get("/api/urls/mine/stats")).status).toBe(404);
        expect((await owner.get("/api/urls/mine/stats?tz=Mars/Olympus")).status).toBe(400);
        expect((await owner.get("/api/urls/mine/stats?days=365")).status).toBe(400);
    });
});

describe("time zones the database doesn't know by that name", () => {
    beforeEach(() => resetState("clicks", "urls", "sessions", "users"));

    it("a browser's CLDR name (Asia/Calcutta) resolves to the tz target, not a 500", async () => {
        const owner = await signUpWithLink("tzalias");
        const res = await owner.get("/api/urls/tzalias/stats?days=7&tz=Asia%2FCalcutta");
        expect(res.status).toBe(200);
        expect(res.body.data.tz).toBe("Asia/Kolkata");
        expect(res.body.data.byDay).toHaveLength(7);
    });

    it("a zone with no match at all falls back to UTC", async () => {
        const { resolveTimeZone } = await import("../src/services/timeZone.service");
        expect(await resolveTimeZone("US/Eastern")).toBe("America/New_York");
        expect(await resolveTimeZone("Europe/Kiev")).toBe("Europe/Kyiv");
        expect(await resolveTimeZone("Not/AZone")).toBe("UTC");
    });
});
