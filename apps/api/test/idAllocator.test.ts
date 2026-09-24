import { describe, expect, it } from "vitest";
import { prisma } from "../src/config/db";
import type { PrismaClient } from "../src/generated/prisma/client";
import { createIdAllocator } from "../src/services/idAllocator.service";

/** Wraps the real client and counts nextval round trips. */
function countingClient() {
    let calls = 0;
    const client = {
        $queryRaw: (...args: Parameters<PrismaClient["$queryRaw"]>) => {
            calls++;
            return prisma.$queryRaw(...args);
        },
    } as unknown as PrismaClient;
    return { client, calls: () => calls };
}

describe("idAllocator", () => {
    it("5,000 parallel calls get 5,000 distinct ids from exactly 5 blocks", async () => {
        const { client, calls } = countingClient();
        const nextId = createIdAllocator(client);
        const ids = await Promise.all(Array.from({ length: 5000 }, () => nextId()));
        expect(new Set(ids).size).toBe(5000);
        expect(calls()).toBe(5);
    });

    it("two allocators (two API instances) never overlap", async () => {
        const a = createIdAllocator();
        const b = createIdAllocator();
        const ids = await Promise.all(Array.from({ length: 3000 }, (_, i) => (i % 2 ? a() : b())));
        expect(new Set(ids).size).toBe(3000);
    });
});
