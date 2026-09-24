import { prisma } from "../../config/db";
import { CLICK_RETENTION_DAYS } from "../../constants/queue";
import { purgeExpiredSessions, purgeExpiredUrls } from "../../services/purge.service";
import { logger } from "../../utils/logger";

/** Raw clicks older than the retention window, in batches. (At scale: monthly partitions + DROP.) */
export async function purgeOldClicks(batch = 5000): Promise<number> {
    let total = 0;
    for (;;) {
        const deleted = await prisma.$executeRaw`
            DELETE FROM clicks WHERE id IN (
                SELECT id FROM clicks
                WHERE occurred_at < now() - make_interval(days => ${CLICK_RETENTION_DAYS})
                LIMIT ${batch})`;
        total += deleted;
        if (deleted < batch) return total;
    }
}

/** The hourly maintenance job: everything Postgres would have done with TTL indexes. */
export async function runPurge() {
    const result = {
        urls: await purgeExpiredUrls(),
        sessions: await purgeExpiredSessions(),
        clicks: await purgeOldClicks(),
    };
    logger.info(result, "purge complete");
    return result;
}
