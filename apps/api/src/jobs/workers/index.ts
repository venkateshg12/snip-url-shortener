import { type Job, Worker } from "bullmq";
import { JOB_NAMES, QUEUE_NAMES } from "../../constants/queue";
import { logger } from "../../utils/logger";
import type { ClickBatchPayload } from "../interfaces";
import { processClickBatch } from "../processors/click.processor";
import { runPurge } from "../processors/maintenance.processor";
import { createQueueConnection } from "../redis/connection";

/** Created on demand (worker.ts, tests), never at import time: the API process must not consume jobs. */
export function startWorkers() {
    const clickWorker = new Worker<ClickBatchPayload>(
        QUEUE_NAMES.CLICKS,
        async (job: Job<ClickBatchPayload>) => processClickBatch(job.data.events),
        { connection: createQueueConnection("worker"), concurrency: 2 },
    );
    const maintenanceWorker = new Worker(
        QUEUE_NAMES.MAINTENANCE,
        async (job: Job) => {
            if (job.name !== JOB_NAMES.PURGE) throw new Error(`Unknown job ${job.name}`);
            return runPurge();
        },
        { connection: createQueueConnection("worker"), concurrency: 1 },
    );
    for (const worker of [clickWorker, maintenanceWorker]) {
        worker.on("failed", (job, err) =>
            logger.error({ jobId: job?.id, queue: worker.name, err: err.message }, "job failed"),
        );
        worker.on("error", (err) => logger.error({ queue: worker.name, err: err.message }, "worker error"));
    }
    return {
        clickWorker,
        maintenanceWorker,
        close: () => Promise.all([clickWorker.close(), maintenanceWorker.close()]),
    };
}
