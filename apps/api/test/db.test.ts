import { describe, expect, it } from "vitest";
import { connectDB, createPrismaClient, disconnectDB, pingDB, prisma } from "../src/config/db";

describe("db", () => {
    const unreachable = createPrismaClient("postgresql://postgres:postgres@127.0.0.1:1/nowhere");

    it("connectDB rejects for an unreachable database", async () => {
        await expect(connectDB(unreachable)).rejects.toThrow();
        await disconnectDB(unreachable);
    });

    it("pingDB returns false instead of throwing", async () => {
        expect(await pingDB(unreachable)).toBe(false);
        expect(await pingDB(prisma)).toBe(true);
    });
});
