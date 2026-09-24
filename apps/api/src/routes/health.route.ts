import { Router } from "express";
import { OK, SERVICE_UNAVAILABLE } from "../constants/http";
import { pingDB } from "../config/db";
import { isShuttingDown } from "../config/lifecycle";
import { cacheRedis } from "../config/redis";
import { urlCache } from "../utils/cache";

export const healthRouter = Router();

// Liveness: the process runs. No dependency checks, or a database blip restarts every instance.
healthRouter.get("/health/live", (_req, res) => {
    res.status(OK).json({ status: "ok" });
});

// Readiness: route traffic here only if the database answers and we're not shutting down.
// Redis is reported from phase 4 on, but never required (see the degradation table).
healthRouter.get("/health/ready", async (_req, res) => {
    const shuttingDown = isShuttingDown();
    const db = shuttingDown ? false : await pingDB();
    const ready = db && !shuttingDown;
    res.status(ready ? OK : SERVICE_UNAVAILABLE).json({
        status: ready ? "ok" : "unavailable",
        // The cache is reported, never required: redirects fall back to Postgres without it
        checks: {
            db: db ? "up" : "down",
            cache: cacheRedis.status === "ready" ? "up" : "down",
            cacheBreaker: urlCache.breaker.state,
            shuttingDown,
        },
    });
});
