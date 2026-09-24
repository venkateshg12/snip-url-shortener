import { prisma } from "../config/db";

/**
 * Postgres has no TTL index, so expired links are deleted by a job (scheduled hourly in phase 7).
 * Batches keep each statement short, and the partial index on purge_at keeps them cheap.
 */
export async function purgeExpiredUrls(batch = 1000): Promise<number> {
    let total = 0;
    for (;;) {
        const deleted = await prisma.$executeRaw`
            DELETE FROM urls WHERE id IN (
                SELECT id FROM urls WHERE purge_at < now() ORDER BY purge_at LIMIT ${batch})`;
        total += deleted;
        if (deleted < batch) return total;
    }
}

/** Expired sessions are already rejected by authenticate/refresh; this is housekeeping. */
export async function purgeExpiredSessions(batch = 1000): Promise<number> {
    let total = 0;
    for (;;) {
        const deleted = await prisma.$executeRaw`
            DELETE FROM sessions WHERE id IN (
                SELECT id FROM sessions WHERE expires_at < now() ORDER BY expires_at LIMIT ${batch})`;
        total += deleted;
        if (deleted < batch) return total;
    }
}
