import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import { createLimiter } from "../src/config/rateLimiter";
import { limiterRedis } from "../src/config/redis";
import { logger } from "../src/utils/logger";
import { resetState } from "./helpers/db";

const app = createApp();
const create = (ip: string) =>
    request(app).post("/api/urls").set("X-Forwarded-For", ip).send({ url: "https://example.com/limited" });

describe("rate limits over HTTP", () => {
    beforeEach(() => resetState("urls"));
    afterEach(async () => {
        if (limiterRedis.status !== "ready") await limiterRedis.connect().catch(() => undefined);
    });

    it("anonymous create ×11 → the 11th is 429 with Retry-After", async () => {
        const statuses = [];
        for (let i = 0; i < 11; i++) statuses.push((await create("198.51.100.7")).status);
        expect(statuses.slice(0, 10).every((s) => s === 201)).toBe(true);
        const last = await create("198.51.100.7");
        expect(last.status).toBe(429);
        expect(Number(last.headers["retry-after"])).toBeGreaterThan(0);
        expect(last.body.errors[0].code).toBe("TOO_MANY_REQUESTS");
        expect(last.headers["x-ratelimit-limit"]).toBe("10");
        // Another IP isn't affected
        expect((await create("198.51.100.8")).status).toBe(201);
    });

    it("a logged-in user gets 60 an hour", async () => {
        const withUser = express();
        withUser.post(
            "/",
            (req, _res, next) => {
                req.userId = "00000000-0000-7000-8000-000000000001"; // what optionalAuth will set (phase 6)
                next();
            },
            createLimiter,
            (_req, res) => res.sendStatus(201),
        );
        const statuses = [];
        for (let i = 0; i < 61; i++) statuses.push((await request(withUser).post("/")).status);
        expect(statuses.filter((s) => s === 201)).toHaveLength(60);
        expect(statuses[60]).toBe(429);
    });

    it("Redis down → creates still succeed (fail open), limited per instance", async () => {
        limiterRedis.disconnect();
        const warn = vi.spyOn(logger, "warn");
        const statuses = [];
        for (let i = 0; i < 11; i++) statuses.push((await create("198.51.100.9")).status);
        expect(statuses.slice(0, 10).every((s) => s === 201)).toBe(true);
        expect(statuses[10]).toBe(429); // the in-memory fallback still enforces the limit
        // Visible in the logs, once per transition rather than once per request
        const degraded = warn.mock.calls.filter(([msg]) =>
            String(msg).includes("falling back to per-instance limits"),
        );
        expect(degraded).toHaveLength(1);
        warn.mockRestore();
    });

    it("61 unknown codes from one IP → blocked; another IP still redirects", async () => {
        const scanner = "203.0.113.5";
        for (let i = 0; i < 60; i++) {
            const res = await request(app)
                .get(`/scan${String(i).padStart(3, "0")}`)
                .set("X-Forwarded-For", scanner);
            expect(res.status).toBe(302);
        }
        const blocked = await request(app).get("/scan999").set("X-Forwarded-For", scanner);
        expect(blocked.status).toBe(429);
        expect(blocked.headers["content-type"]).toMatch(/html/);

        const { body } = await create("198.51.100.20");
        const visitor = await request(app)
            .get(`/${body.data.shortCode}`)
            .set("X-Forwarded-For", "198.51.100.21");
        expect(visitor.status).toBe(302);
        expect(visitor.headers.location).toBe("https://example.com/limited");
        // Even the scanner's valid requests are blocked for the 10 minutes
        expect(
            (await request(app).get(`/${body.data.shortCode}`).set("X-Forwarded-For", scanner)).status,
        ).toBe(429);
    });
});
