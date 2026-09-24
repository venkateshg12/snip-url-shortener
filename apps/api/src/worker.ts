import { connectDB, disconnectDB } from "./config/db";
import { onShutdown, registerShutdown } from "./config/lifecycle";
import { maintenanceQueue, schedulePurge } from "./jobs/queues/maintenance.queue";
import { startWorkers } from "./jobs/workers";
import { METRICS_PORT } from "./constants/env";
import { clickQueue } from "./jobs/queues/click.queue";
import { logger } from "./utils/logger";
import { clickQueueWaiting, startMetricsServer } from "./utils/metrics/metrics";

// The worker process: consumes click batches and runs the hourly purge. Scale it independently.
async function main() {
    await connectDB();
    const workers = startWorkers();
    await schedulePurge();
    logger.info("worker started");
    // Queue depth: the signal for "add a worker"
    const poll = setInterval(
        () =>
            void clickQueue
                .getWaitingCount()
                .then((n) => clickQueueWaiting.set(n))
                .catch(() => undefined),
        15_000,
    );
    poll.unref();
    const metrics = startMetricsServer(METRICS_PORT + 1); // 9101: the API owns 9100
    onShutdown("db", "metrics", () => new Promise((resolve) => metrics.close(resolve)));
    onShutdown("queues", "workers", () => workers.close()); // finishes the jobs in progress
    onShutdown("queues", "maintenance-queue", () => maintenanceQueue.close());
    onShutdown("db", "prisma", () => disconnectDB());
    registerShutdown();
}

main().catch((error: unknown) => {
    logger.fatal({ err: error }, "worker boot failed");
    process.exit(1);
});
