import { Redis } from "ioredis";
import { prisma } from "../../src/config/db";

/** Empties the given tables. Safe: setupEnv refuses any database whose name doesn't end in _test. */
export async function truncate(...tables: string[]) {
    if (tables.length === 0) return;
    await prisma.$executeRawUnsafe(
        `TRUNCATE ${tables.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`,
    );
}

/** Empties the tables, both test Redis databases (index 1) and the in-memory limiters. */
export async function resetState(...tables: string[]) {
    const { cacheRedis, limiterRedis } = await import("../../src/config/redis");
    const { memoryStore } = await import("../../src/config/rateLimiter");
    const { clickQueueConnection } = await import("../../src/jobs/queues/click.queue");
    await Promise.all([ready(cacheRedis), ready(limiterRedis), ready(clickQueueConnection)]);
    memoryStore.clear();
    // Each test must start with the cache usable; a breaker left open by an earlier test would make
    // the next ones fail for confusing reasons, so fail here instead
    const { urlCache } = await import("../../src/utils/cache");
    if (urlCache.breaker.state !== "closed")
        throw new Error(`cache breaker is ${urlCache.breaker.state} at the start of a test`);
    await Promise.all([truncate(...tables), admin("cache").flushdb(), admin("queue").flushdb()]);
}

const ready = (client: Redis) =>
    client.status === "ready" ? Promise.resolve() : new Promise((resolve) => client.once("ready", resolve));

// Housekeeping uses its own ordinary clients: the app's are fail-fast by design (50ms timeout, no queue)
const admins: Partial<Record<"cache" | "queue", Redis>> = {};
function admin(which: "cache" | "queue") {
    admins[which] ??= new Redis(
        which === "cache" ? process.env.REDIS_CACHE_URL! : process.env.REDIS_QUEUE_URL!,
    );
    return admins[which]!;
}

let userCounter = 0;
/** A real user row (urls.user_id is a foreign key). */
export async function createTestUser(name = "Test User") {
    const email = `user${Date.now()}${userCounter++}@example.test`;
    return prisma.user.create({ data: { name, email, passwordHash: "x" } });
}
