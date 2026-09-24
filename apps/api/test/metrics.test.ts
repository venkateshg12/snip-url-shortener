import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import { cacheRedis } from "../src/config/redis";
import { clickRecorder } from "../src/jobs/producers";
import { registry } from "../src/utils/metrics/metrics";
import { resetState } from "./helpers/db";

const app = createApp();
const value = async (name: string, labels: Record<string, string> = {}) => {
    const metric = (await registry.getMetricsAsJSON()).find((m) => m.name === name);
    const match = (metric?.values ?? []).find((v) =>
        Object.entries(labels).every(([k, l]) => v.labels[k] === l),
    );
    return match?.value ?? 0;
};

describe("metrics move when exercised", () => {
    beforeEach(() => resetState("clicks", "urls"));

    it("request duration by route template, cache lookups, clicks recorded, limiter rejections, breaker state", async () => {
        const { body } = await request(app)
            .post("/api/urls")
            .set("X-Forwarded-For", "203.0.113.50")
            .send({ url: "https://example.com/m" });
        const code = body.data.shortCode;
        await request(app).get(`/${code}`); // write-through made this a hit
        await request(app).get("/unknown1"); // miss → negative entry
        await vi.waitFor(async () => expect(await cacheRedis.exists("url:v1:unknown1")).toBe(1));
        await request(app).get("/unknown1"); // negative hit

        const text = await registry.metrics();
        expect(text).toMatch(
            /http_request_duration_seconds_count\{method="GET",route="\/:code",status_class="3xx"\} [1-9]/,
        );
        expect(text).not.toContain(`route="/${code}"`); // never the raw path
        expect(await value("redirect_cache_lookups_total", { result: "hit" })).toBeGreaterThan(0);
        expect(await value("redirect_cache_lookups_total", { result: "miss" })).toBeGreaterThan(0);
        expect(await value("redirect_cache_lookups_total", { result: "negative_hit" })).toBeGreaterThan(0);
        expect(await value("clicks_recorded_total")).toBeGreaterThan(0);

        for (let i = 0; i < 11; i++)
            await request(app)
                .post("/api/urls")
                .set("X-Forwarded-For", "203.0.113.51")
                .send({ url: "https://example.com/r" });
        expect(await value("rate_limit_rejections_total", { limiter: "create" })).toBeGreaterThan(0);

        expect(await value("circuit_breaker_open", { name: "cache" })).toBe(0);
        expect(text).toContain("nodejs_eventloop_lag_seconds"); // default metrics
        await clickRecorder.flush();
    });
});
