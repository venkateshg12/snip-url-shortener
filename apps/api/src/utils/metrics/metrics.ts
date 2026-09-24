import { createServer } from "node:http";
import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from "prom-client";
import type { CircuitBreaker } from "../cache/circuitBreaker";
import { logger } from "../logger";

export const registry = new Registry();
collectDefaultMetrics({ register: registry }); // event-loop lag, heap, GC

export const httpDuration = new Histogram({
    name: "http_request_duration_seconds",
    help: "HTTP request duration, by route TEMPLATE (never the raw path: one series per short code would explode)",
    labelNames: ["method", "route", "status_class"] as const,
    buckets: [0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
    registers: [registry],
});

export const cacheLookups = new Counter({
    name: "redirect_cache_lookups_total",
    help: "Redirect cache lookups by result",
    labelNames: ["result"] as const,
    registers: [registry],
});

export const rateLimitRejections = new Counter({
    name: "rate_limit_rejections_total",
    help: "Requests rejected with 429, by limiter",
    labelNames: ["limiter"] as const,
    registers: [registry],
});

export const clicksRecorded = new Counter({
    name: "clicks_recorded_total",
    help: "Clicks buffered for analytics",
    registers: [registry],
});
export const clicksDropped = new Counter({
    name: "clicks_dropped_total",
    help: "Clicks lost (buffer full or queue unavailable)",
    registers: [registry],
});

export const clickQueueWaiting = new Gauge({
    name: "click_queue_waiting",
    help: "Click batches waiting for a worker",
    registers: [registry],
});

const breakers = new Map<string, CircuitBreaker>();
export const trackBreaker = (name: string, breaker: CircuitBreaker) => breakers.set(name, breaker);
new Gauge({
    name: "circuit_breaker_open",
    help: "1 while a breaker is open or half-open (Redis is being skipped)",
    labelNames: ["name"] as const,
    registers: [registry],
    collect() {
        for (const [name, breaker] of breakers) this.set({ name }, breaker.state === "closed" ? 0 : 1);
    },
});

/** /metrics on its own port: scraped internally, never published through nginx. */
export function startMetricsServer(port: number) {
    const server = createServer(async (req, res) => {
        if (req.url !== "/metrics") {
            res.writeHead(404).end();
            return;
        }
        res.writeHead(200, { "content-type": registry.contentType }).end(await registry.metrics());
    });
    // A metrics problem (e.g. the port is taken) must never take the API down with it
    server.on("error", (err) => logger.error({ err: err.message, port }, "metrics server unavailable"));
    server.listen(port, () => logger.info({ port }, "metrics listening"));
    return server;
}
