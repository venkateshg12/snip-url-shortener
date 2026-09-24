import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import { prisma } from "../src/config/db";
import { SHORT_BASE_URL, WEB_URL } from "../src/constants/env";
import { createIdAllocator, nextId } from "../src/services/idAllocator.service";
import { createShortUrl } from "../src/services/url.service";
import { generateShortCode } from "../src/utils/shortCode";
import { createTestUser, resetState } from "./helpers/db";

const app = createApp();
const create = (body: object) => request(app).post("/api/urls").send(body);
const DAY = 86_400_000;

describe("POST /api/urls", () => {
    beforeEach(() => resetState("urls"));

    it("creates a link and returns the DTO", async () => {
        const res = await create({ url: "https://Example.com/some/long/path?x=1" });
        expect(res.status).toBe(201);
        expect(res.body.status).toBe("success");
        const dto = res.body.data;
        expect(dto.shortCode).toMatch(/^[0-9a-zA-Z]{7}$/);
        expect(dto.shortUrl).toBe(`${SHORT_BASE_URL}/${dto.shortCode}`);
        expect(dto.longUrl).toBe("https://example.com/some/long/path?x=1"); // host lowercased
        expect(dto).toMatchObject({ isCustomAlias: false, status: "active", clickCount: 0 });
        expect(dto).not.toHaveProperty("id");
    });

    it.each([
        ["javascript:alert(1)"],
        ["ftp://files.example.com"],
        ["example.com"],
        [`https://example.com/${"a".repeat(3000)}`],
    ])("rejects %s with a field error", async (url) => {
        const res = await create({ url });
        expect(res.status).toBe(400);
        expect(res.body.errors[0]).toMatchObject({ path: "url", code: "VALIDATION_ERROR" });
    });

    it("rejects our own domain", async () => {
        const res = await create({ url: `${SHORT_BASE_URL}/abc1234` });
        expect(res.status).toBe(400);
        expect(res.body.errors[0].code).toBe("INVALID_TARGET");
    });

    it("an anonymous alias → 401", async () => {
        const res = await create({ url: "https://example.com", customAlias: "my-link" });
        expect(res.status).toBe(401);
        expect(res.body.errors[0].code).toBe("LOGIN_REQUIRED");
    });

    it("anonymous links are clamped to 30 days", async () => {
        const res = await create({
            url: "https://example.com",
            expiresAt: new Date(Date.now() + 90 * DAY).toISOString(),
        });
        const expiresAt = new Date(res.body.data.expiresAt).getTime();
        expect(expiresAt).toBeLessThanOrEqual(Date.now() + 30 * DAY);
        expect(expiresAt).toBeGreaterThan(Date.now() + 29 * DAY);
    });
});

describe("createShortUrl with a user", () => {
    let userId: string;
    beforeEach(async () => {
        await resetState("urls", "users");
        userId = (await createTestUser()).id;
    });

    it("reserved alias → 400, taken alias → 409", async () => {
        await expect(
            createShortUrl({ url: "https://example.com", customAlias: "Dashboard" }, { userId }),
        ).rejects.toMatchObject({
            statusCode: 400,
            errorCode: "RESERVED_ALIAS",
        });
        await createShortUrl({ url: "https://example.com", customAlias: "launch" }, { userId });
        await expect(
            createShortUrl({ url: "https://example.org", customAlias: "launch" }, { userId }),
        ).rejects.toMatchObject({
            statusCode: 409,
            errorCode: "ALIAS_TAKEN",
        });
    });

    it("users may set any expiry, or none", async () => {
        const noExpiry = await createShortUrl({ url: "https://example.com" }, { userId });
        expect(noExpiry.expiresAt).toBeNull();
    });

    it("the collision path: an alias holding the next generated code forces a retry", async () => {
        // The allocator is deterministic: find the next id that isn't a block boundary
        let id = await nextId();
        while ((id + 1n) % 1000n === 1n) id = await nextId();
        const predicted = generateShortCode(id + 1n);
        const otherInstance = createIdAllocator(); // a different block, so the primary keys don't clash
        await prisma.url.create({
            data: {
                id: await otherInstance(),
                shortCode: predicted,
                longUrl: "https://example.com/alias",
                isCustomAlias: true,
            },
        });

        const dto = await createShortUrl({ url: "https://example.com/generated" }, { userId });
        expect(dto.shortCode).not.toBe(predicted);
        expect(dto.shortCode).toBe(generateShortCode(id + 2n));
    });
});

describe("GET /:code", () => {
    beforeEach(() => resetState("urls"));

    it("302s to the target with no-store", async () => {
        const { body } = await create({ url: "https://example.com/target" });
        const res = await request(app).get(`/${body.data.shortCode}`);
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("https://example.com/target");
        expect(res.headers["cache-control"]).toBe("no-store");
    });

    it("expired → /expired, disabled or unknown → /not-found", async () => {
        const base = { longUrl: "https://example.com" };
        await prisma.url.create({
            data: {
                ...base,
                id: await nextId(),
                shortCode: "old-one",
                expiresAt: new Date(Date.now() - 1000),
            },
        });
        await prisma.url.create({
            data: { ...base, id: await nextId(), shortCode: "off-one", status: "disabled" },
        });
        expect((await request(app).get("/old-one")).headers.location).toBe(`${WEB_URL}/expired`);
        expect((await request(app).get("/off-one")).headers.location).toBe(`${WEB_URL}/not-found`);
        expect((await request(app).get("/nope123")).headers.location).toBe(`${WEB_URL}/not-found`);
    });

    it("junk paths never reach the database", async () => {
        const spy = vi.spyOn(prisma.url, "findUnique");
        const res = await request(app).get("/wp-login.php");
        expect(res.headers.location).toBe(`${WEB_URL}/not-found`);
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });

    it("the bare domain goes to the website", async () => {
        expect((await request(app).get("/")).headers.location).toBe(WEB_URL);
    });

    it("a database failure answers 503 HTML, not JSON", async () => {
        const spy = vi.spyOn(prisma.url, "findUnique").mockRejectedValue(new Error("db down"));
        const res = await request(app).get("/abcdefg");
        expect(res.status).toBe(503);
        expect(res.headers["content-type"]).toMatch(/text\/html/);
        spy.mockRestore();
    });
});
