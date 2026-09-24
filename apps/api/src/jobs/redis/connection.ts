import { Redis } from "ioredis";
import { REDIS_QUEUE_URL } from "../../constants/env";
import { logger } from "../../utils/logger";

/**
 * Producers (the API) fail fast: a Redis outage must not stall redirects, so a failed enqueue is
 * counted as dropped. Workers need the opposite, which BullMQ requires: never give up on a command.
 */
export function createQueueConnection(role: "producer" | "worker") {
    const client = new Redis(
        REDIS_QUEUE_URL,
        role === "producer"
            ? { enableOfflineQueue: false, maxRetriesPerRequest: 1, connectTimeout: 2_000 }
            : { maxRetriesPerRequest: null },
    );
    client.on("error", (err) => logger.warn({ err: err.message, client: `queue-${role}` }, "redis error"));
    return client;
}
