import { Queue } from "bullmq";
import { QUEUE_NAMES } from "../../constants/queue";
import type { ClickBatchPayload } from "../interfaces";
import { createQueueConnection } from "../redis/connection";

export const clickQueueConnection = createQueueConnection("producer");

export const clickQueue = new Queue<ClickBatchPayload>(QUEUE_NAMES.CLICKS, {
    connection: clickQueueConnection,
    defaultJobOptions: {
        attempts: 5,
        backoff: { type: "exponential", delay: 1_000 },
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 7 * 24 * 3600, count: 5000 },
    },
});
