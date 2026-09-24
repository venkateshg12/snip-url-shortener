import type { Request } from "express";
import { describe, expect, it } from "vitest";
import type { ClickEvent } from "../src/jobs/interfaces";
import { ClickRecorder } from "../src/jobs/producers/clickRecorder";
import { uuidv7 } from "../src/utils/uuidv7";

const fakeReq = (headers: Record<string, string> = {}) =>
    ({ ip: "198.51.100.1", get: (name: string) => headers[name.toLowerCase()] }) as unknown as Request;

function recorder(options: Partial<ConstructorParameters<typeof ClickRecorder>[0]> = {}) {
    const batches: ClickEvent[][] = [];
    const rec = new ClickRecorder({ enqueue: async (events) => batches.push(events), ...options });
    return { rec, batches };
}

describe("ClickRecorder", () => {
    it("flushes at 500 events", async () => {
        const { rec, batches } = recorder();
        for (let i = 0; i < 500; i++) rec.record("1", fakeReq());
        await Promise.resolve();
        expect(batches).toHaveLength(1);
        expect(batches[0]).toHaveLength(500);
    });

    it("flushes on the timer", async () => {
        const { rec, batches } = recorder({ intervalMs: 20 });
        rec.start();
        rec.record("1", fakeReq());
        await new Promise((r) => setTimeout(r, 60));
        expect(batches.flat()).toHaveLength(1);
        await rec.stop();
    });

    it("caps the buffer and counts drops", () => {
        const { rec } = recorder({ maxBuffer: 10, flushSize: 1_000 });
        for (let i = 0; i < 15; i++) rec.record("1", fakeReq());
        expect(rec.stats).toMatchObject({ recorded: 10, dropped: 5 });
    });

    it("stop() flushes what's buffered (graceful shutdown loses nothing)", async () => {
        const { rec, batches } = recorder();
        rec.start();
        for (let i = 0; i < 7; i++) rec.record("1", fakeReq());
        await rec.stop();
        expect(batches.flat()).toHaveLength(7);
    });

    it("a failing enqueue counts the batch as dropped instead of throwing", async () => {
        const rec = new ClickRecorder({ enqueue: () => Promise.reject(new Error("redis down")) });
        rec.record("1", fakeReq());
        rec.record("1", fakeReq());
        await rec.flush();
        expect(rec.stats.dropped).toBe(2);
    });

    it("captures only what analytics need: no raw IP", () => {
        const { rec } = recorder({ flushSize: 1_000 });
        rec.record(
            "42",
            fakeReq({ "user-agent": "UA", referer: "https://news.example/a?b", "cf-ipcountry": "in" }),
        );
        const event = (rec as unknown as { buffer: ClickEvent[] }).buffer[0]!;
        expect(event).toMatchObject({
            urlId: "42",
            ua: "UA",
            referrer: "https://news.example/a?b",
            country: "IN",
        });
        expect(event.visitor).toMatch(/^[0-9a-f]{64}$/);
        expect(JSON.stringify(event)).not.toContain("198.51.100.1");
    });
});

describe("uuidv7", () => {
    it("is a version-7, variant-10 UUID ordered by time", () => {
        const a = uuidv7(1_700_000_000_000);
        const b = uuidv7(1_700_000_000_001);
        expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
        expect(a < b).toBe(true);
    });
});
