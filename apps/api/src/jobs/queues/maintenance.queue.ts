import { Queue } from "bullmq";
import { JOB_NAMES, PURGE_EVERY_MS, QUEUE_NAMES } from "../../constants/queue";
import { createQueueConnection } from "../redis/connection";

export const maintenanceQueue = new Queue(QUEUE_NAMES.MAINTENANCE, {
    connection: createQueueConnection("worker"),
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 10_000 },
        removeOnComplete: 100,
        removeOnFail: 100,
    },
});

/** Idempotent: every worker calls it at boot, and there's still exactly one hourly schedule. */
export const schedulePurge = () =>
    maintenanceQueue.upsertJobScheduler("purge-hourly", { every: PURGE_EVERY_MS }, { name: JOB_NAMES.PURGE });
