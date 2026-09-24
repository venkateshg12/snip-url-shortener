import type { Server } from "node:http";
import { logger } from "../utils/logger";

/**
 * Shutdown runs in stages, in this order. Later phases register their steps:
 * flush (the click buffer, phase 7) → queues (BullMQ producers) → redis (clients) → db (Prisma).
 */
const STAGES = ["flush", "queues", "redis", "db"] as const;
type Stage = (typeof STAGES)[number];

const steps: { stage: Stage; name: string; run: () => Promise<unknown> }[] = [];
let shuttingDown = false;

export const isShuttingDown = () => shuttingDown;

export function onShutdown(stage: Stage, name: string, run: () => Promise<unknown>) {
    steps.push({ stage, name, run });
}

/** SIGTERM/SIGINT: fail readiness, drain HTTP, run the steps in stage order, exit. */
export function registerShutdown(server?: Server, timeoutMs = 10_000) {
    const shutdown = async (signal: string) => {
        if (shuttingDown) return;
        shuttingDown = true; // /health/ready now answers 503, so the load balancer stops sending traffic
        logger.info({ signal }, "shutting down");

        const timer = setTimeout(() => {
            logger.error("shutdown timed out, exiting");
            process.exit(1);
        }, timeoutMs).unref();

        if (server) await new Promise<void>((resolve) => server.close(() => resolve())); // in-flight requests finish
        for (const stage of STAGES) {
            for (const step of steps.filter((s) => s.stage === stage)) {
                await step
                    .run()
                    .catch((error: unknown) =>
                        logger.error({ err: error, step: step.name }, "shutdown step failed"),
                    );
            }
        }
        clearTimeout(timer);
        logger.info("shutdown complete");
        process.exit(0);
    };
    process.once("SIGTERM", () => void shutdown("SIGTERM"));
    process.once("SIGINT", () => void shutdown("SIGINT"));
}
