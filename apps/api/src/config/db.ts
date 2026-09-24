import { PrismaPg } from "@prisma/adapter-pg";
import { DATABASE_URL, DB_POOL_MAX } from "../constants/env";
import { PrismaClient } from "../generated/prisma/client";

/** One client per process: each PrismaClient owns a pg pool. */
export function createPrismaClient(connectionString: string) {
    const adapter = new PrismaPg({
        connectionString,
        max: DB_POOL_MAX, // per instance; phase 9 budgets this against max_connections
        connectionTimeoutMillis: 5_000,
    });
    return new PrismaClient({ adapter });
}

export const prisma = createPrismaClient(DATABASE_URL);

/** Prisma connects lazily; this fails the boot now instead of on the first request. */
export async function connectDB(client: PrismaClient = prisma) {
    await client.$queryRaw`SELECT 1`;
}

export const disconnectDB = (client: PrismaClient = prisma) => client.$disconnect();

export async function pingDB(client: PrismaClient = prisma, timeoutMs = 1_000): Promise<boolean> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("db ping timed out")), timeoutMs);
    });
    try {
        await Promise.race([client.$queryRaw`SELECT 1`, timeout]);
        return true;
    } catch {
        return false;
    } finally {
        clearTimeout(timer);
    }
}
