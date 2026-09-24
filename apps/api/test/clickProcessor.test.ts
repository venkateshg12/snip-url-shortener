import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../src/config/db";
import type { ClickEvent } from "../src/jobs/interfaces";
import { processClickBatch } from "../src/jobs/processors/click.processor";
import { purgeOldClicks } from "../src/jobs/processors/maintenance.processor";
import { nextId } from "../src/services/idAllocator.service";
import { generateShortCode } from "../src/utils/shortCode";
import { uuidv7 } from "../src/utils/uuidv7";
import { resetState } from "./helpers/db";

const IPHONE =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const CHROME_WIN =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

async function newUrl() {
    const id = await nextId();
    await prisma.url.create({
        data: { id, shortCode: generateShortCode(id), longUrl: "https://example.com" },
    });
    return id;
}
const event = (urlId: bigint, ua: string, extra: Partial<ClickEvent> = {}): ClickEvent => ({
    id: uuidv7(),
    urlId: urlId.toString(),
    ts: Date.now(),
    ua,
    referrer: "https://www.news.example/story?id=1",
    country: "IN",
    visitor: "a".repeat(64),
    ...extra,
});

describe("processClickBatch", () => {
    beforeEach(() => resetState("clicks", "urls"));

    it("drops bots, parses agents, stores only the referrer host, and counts per link", async () => {
        const a = await newUrl();
        const b = await newUrl();
        const batch = [
            event(a, IPHONE),
            event(a, CHROME_WIN),
            event(b, IPHONE),
            event(a, "Slackbot-LinkExpanding 1.0"),
            event(b, ""),
        ];
        expect(await processClickBatch(batch)).toEqual({ inserted: 3, bots: 2 });

        const counts = await prisma.url.findMany({
            select: { id: true, clickCount: true, lastClickedAt: true },
            orderBy: { id: "asc" },
        });
        expect(counts.map((u) => Number(u.clickCount))).toEqual([2, 1]);
        expect(counts.every((u) => u.lastClickedAt !== null)).toBe(true);

        const iphone = await prisma.click.findFirstOrThrow({ where: { urlId: b } });
        expect(iphone).toMatchObject({
            device: "mobile",
            os: "iOS",
            browser: "Safari",
            referrerHost: "news.example",
            country: "IN",
        });
    });

    it("processing the same batch twice leaves every count unchanged (exactly-once effect)", async () => {
        const a = await newUrl();
        const batch = [event(a, IPHONE), event(a, IPHONE), event(a, CHROME_WIN)];
        expect((await processClickBatch(batch)).inserted).toBe(3);
        expect((await processClickBatch(batch)).inserted).toBe(0); // a BullMQ retry of the same job
        expect(Number((await prisma.url.findUniqueOrThrow({ where: { id: a } })).clickCount)).toBe(3);
        expect(await prisma.click.count()).toBe(3);
    });

    it("a click for a deleted link is skipped, not a failed job", async () => {
        const a = await newUrl();
        const gone = 999_999_999n;
        expect(await processClickBatch([event(a, IPHONE), event(gone, IPHONE)])).toEqual({
            inserted: 1,
            bots: 0,
        });
    });

    it("purgeOldClicks removes clicks past 180 days", async () => {
        const a = await newUrl();
        const old = Date.now() - 181 * 86_400_000;
        await processClickBatch([event(a, IPHONE, { ts: old }), event(a, IPHONE)]);
        expect(await purgeOldClicks()).toBe(1);
        expect(await prisma.click.count()).toBe(1);
    });
});
