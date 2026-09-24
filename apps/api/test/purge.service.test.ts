import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../src/config/db";
import { nextId } from "../src/services/idAllocator.service";
import { purgeExpiredUrls } from "../src/services/purge.service";
import { generateShortCode } from "../src/utils/shortCode";
import { truncate } from "./helpers/db";

const DAY = 86_400_000;
async function insert(n: number, purgeAt: Date | null) {
    const data = [];
    for (let i = 0; i < n; i++) {
        const id = await nextId();
        const expiresAt = purgeAt && new Date(purgeAt.getTime() - 30 * DAY);
        data.push({
            id,
            shortCode: generateShortCode(id),
            longUrl: "https://example.com",
            expiresAt,
            purgeAt,
        });
    }
    await prisma.url.createMany({ data });
}

describe("purgeExpiredUrls", () => {
    beforeEach(() => truncate("urls"));

    it("deletes only rows past purge_at", async () => {
        await insert(3, new Date(Date.now() - DAY)); // due
        await insert(2, new Date(Date.now() + DAY)); // expired, still in the 30-day grace window
        await insert(4, null); // never expires
        expect(await purgeExpiredUrls()).toBe(3);
        expect(await prisma.url.count()).toBe(6);
    });

    it("works in batches", async () => {
        await insert(2500, new Date(Date.now() - DAY));
        const spy = vi.spyOn(prisma, "$executeRaw");
        expect(await purgeExpiredUrls(1000)).toBe(2500);
        expect(spy).toHaveBeenCalledTimes(3);
        spy.mockRestore();
    });
});
