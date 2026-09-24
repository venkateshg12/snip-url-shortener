import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import * as db from "../src/config/db";
import * as lifecycle from "../src/config/lifecycle";

const app = createApp();

describe("createApp", () => {
    afterEach(() => vi.restoreAllMocks());

    it("unknown API route → 404 envelope", async () => {
        const res = await request(app).get("/api/nope");
        expect(res.status).toBe(404);
        expect(res.body).toEqual({
            status: "error",
            data: null,
            errors: [{ message: "Route not Found: GET /api/nope", code: "ROUTE_NOT_FOUND" }],
        });
    });

    it("/health/live → 200", async () => {
        expect((await request(app).get("/health/live")).status).toBe(200);
    });

    it("/health/ready → 200 with the database up", async () => {
        const res = await request(app).get("/health/ready");
        expect(res.status).toBe(200);
        expect(res.body.checks.db).toBe("up");
    });

    it("/health/ready → 503 when the database is unreachable", async () => {
        vi.spyOn(db, "pingDB").mockResolvedValue(false);
        const res = await request(app).get("/health/ready");
        expect(res.status).toBe(503);
        expect(res.body.checks.db).toBe("down");
    });

    it("/health/ready → 503 while shutting down", async () => {
        vi.spyOn(lifecycle, "isShuttingDown").mockReturnValue(true);
        expect((await request(app).get("/health/ready")).status).toBe(503);
    });

    it("reuses a safe X-Request-Id and generates one otherwise", async () => {
        expect(
            (await request(app).get("/health/live").set("X-Request-Id", "abc-123")).headers["x-request-id"],
        ).toBe("abc-123");
        const generated = (await request(app).get("/health/live").set("X-Request-Id", "<script>")).headers[
            "x-request-id"
        ];
        expect(generated).toMatch(/^[0-9a-f-]{36}$/);
    });

    it("the JSON API rejects malformed bodies with the envelope", async () => {
        const res = await request(app)
            .post("/api/anything")
            .set("content-type", "application/json")
            .send("{");
        expect(res.status).toBe(400);
        expect(res.body.errors[0].code).toBe("INVALID_JSON");
    });
});
