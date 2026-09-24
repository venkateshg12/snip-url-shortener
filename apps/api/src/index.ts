import { connectDB, disconnectDB } from "./config/db";
import { onShutdown, registerShutdown } from "./config/lifecycle";
import { cacheRedis, limiterRedis, waitForCache } from "./config/redis";
import { METRICS_PORT, PORT } from "./constants/env";
import { clickRecorder } from "./jobs/producers";
import { clickQueue, clickQueueConnection } from "./jobs/queues/click.queue";
import { createApp } from "./app";
import { logger } from "./utils/logger";
import { startMetricsServer } from "./utils/metrics/metrics";

// The API is CommonJS (like the Mongo backend), which has no top-level await.
async function main() {
    await connectDB();
    if (!(await waitForCache()))
        logger.warn("cache not reachable at boot; redirects will use Postgres until it is");
    const app = createApp();
    const server = app.listen(PORT, () => logger.info({ port: PORT }, "listening"));
    server.keepAliveTimeout = 65_000; // longer than the load balancer's idle timeout (phase 9)
    server.headersTimeout = 66_000;
    clickRecorder.start();
    onShutdown("flush", "click-recorder", () => clickRecorder.stop()); // deploys lose no buffered clicks
    onShutdown("queues", "click-queue", () => clickQueue.close());
    onShutdown("redis", "cache", () => cacheRedis.quit());
    onShutdown("redis", "queue-producer", () => clickQueueConnection.quit());
    onShutdown("redis", "limiter", () => limiterRedis.quit());
    onShutdown("db", "prisma", () => disconnectDB());
    const metrics = startMetricsServer(METRICS_PORT);
    onShutdown("db", "metrics", () => new Promise((resolve) => metrics.close(resolve)));
    registerShutdown(server);
}

main().catch((error: unknown) => {
    logger.fatal({ err: error }, "boot failed");
    process.exit(1);
});
