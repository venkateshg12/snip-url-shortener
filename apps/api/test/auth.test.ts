import jwt from "jsonwebtoken";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import { prisma } from "../src/config/db";
import { JWT_SECRET } from "../src/constants/env";
import { purgeExpiredSessions } from "../src/services/purge.service";
import { resetState } from "./helpers/db";

const app = createApp();
const credentials = { name: "Aisha", email: "Aisha@Example.test", password: "correct horse battery" };

/** The refresh cookie (path=/api/auth) as a raw Cookie header value. */
const cookieValue = (res: request.Response, name: string) =>
    ([] as string[])
        .concat(res.headers["set-cookie"] ?? [])
        .find((c) => c.startsWith(`${name}=`))
        ?.split(";")[0];

describe("auth flow", () => {
    beforeEach(() => resetState("urls", "sessions", "users"));
    afterEach(() => vi.useRealTimers());

    it("register → me → refresh → logout → the old access token is rejected", async () => {
        const agent = request.agent(app);
        const registered = await agent.post("/api/auth/register").send(credentials);
        expect(registered.status).toBe(201);
        expect(registered.body.data.user).toMatchObject({ name: "Aisha", email: "aisha@example.test" }); // lowercased
        const cookies = ([] as string[]).concat(registered.headers["set-cookie"]);
        expect(cookies.find((c) => c.startsWith("accessToken="))).toMatch(/HttpOnly/);
        expect(cookies.find((c) => c.startsWith("refreshToken="))).toMatch(/Path=\/api\/auth;/);

        expect((await agent.get("/api/auth/me")).body.data.user.email).toBe("aisha@example.test");
        const oldAccess = cookieValue(registered, "accessToken")!;

        const refreshed = await agent.get("/api/auth/refresh");
        expect(refreshed.status).toBe(200);
        expect(cookieValue(refreshed, "refreshToken")).not.toBe(cookieValue(registered, "refreshToken")); // rotated

        expect((await agent.post("/api/auth/logout")).status).toBe(200);
        expect(await prisma.session.count()).toBe(0);
        const replay = await request(app).get("/api/auth/me").set("Cookie", oldAccess);
        expect(replay.status).toBe(401); // the token is still unexpired, but its session is gone
    });

    it("login: wrong password and unknown email give the same answer", async () => {
        await request(app).post("/api/auth/register").send(credentials);
        const wrong = await request(app)
            .post("/api/auth/login")
            .send({ email: credentials.email, password: "nope-nope" });
        const unknown = await request(app)
            .post("/api/auth/login")
            .send({ email: "nobody@example.test", password: "nope-nope" });
        expect(wrong.status).toBe(401);
        expect(unknown.status).toBe(401);
        expect(wrong.body.errors).toEqual(unknown.body.errors);
        const ok = await request(app)
            .post("/api/auth/login")
            .send({ email: "AISHA@example.test", password: credentials.password });
        expect(ok.status).toBe(200);
    });

    it("registering the same email twice (any case) → 409", async () => {
        await request(app).post("/api/auth/register").send(credentials);
        const again = await request(app)
            .post("/api/auth/register")
            .send({ ...credentials, email: "AISHA@EXAMPLE.TEST" });
        expect(again.status).toBe(409);
        expect(again.body.errors[0].code).toBe("EMAIL_TAKEN");
    });

    it("a refresh token reused after rotation → the session is revoked", async () => {
        const registered = await request(app).post("/api/auth/register").send(credentials);
        const firstRefresh = cookieValue(registered, "refreshToken")!;
        expect((await request(app).get("/api/auth/refresh").set("Cookie", firstRefresh)).status).toBe(200);

        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(Date.now() + 31_000); // past the concurrent-tab grace window
        const reuse = await request(app).get("/api/auth/refresh").set("Cookie", firstRefresh);
        expect(reuse.status).toBe(401);
        expect(await prisma.session.count()).toBe(0); // revoked everywhere
        expect(cookieValue(reuse, "refreshToken")).toBe("refreshToken="); // and the cookies are cleared
    });

    it("two tabs refreshing at once both succeed (grace window)", async () => {
        const registered = await request(app).post("/api/auth/register").send(credentials);
        const token = cookieValue(registered, "refreshToken")!;
        const [a, b] = await Promise.all([
            request(app).get("/api/auth/refresh").set("Cookie", token),
            request(app).get("/api/auth/refresh").set("Cookie", token),
        ]);
        expect([a.status, b.status]).toEqual([200, 200]);
        expect(await prisma.session.count()).toBe(1);
    });

    it("logout works with an expired access token (via the refresh cookie)", async () => {
        const registered = await request(app).post("/api/auth/register").send(credentials);
        const expiredAccess = `accessToken=${jwt.sign({ userId: "x", sessionId: "y" }, JWT_SECRET, { expiresIn: -10, audience: "api" })}`;
        const res = await request(app)
            .post("/api/auth/logout")
            .set("Cookie", [expiredAccess, cookieValue(registered, "refreshToken")!]);
        expect(res.status).toBe(200);
        expect(await prisma.session.count()).toBe(0);
    });

    it("an expired access cookie on POST /api/urls → 401, not an anonymous link", async () => {
        const token = jwt.sign({ userId: "x", sessionId: "y" }, JWT_SECRET, {
            expiresIn: -10,
            audience: "api",
        });
        const res = await request(app)
            .post("/api/urls")
            .set("Cookie", `accessToken=${token}`)
            .send({ url: "https://example.com" });
        expect(res.status).toBe(401);
        expect(res.body.errors[0].message).toBe("Token expired");
        expect(await prisma.url.count()).toBe(0);
    });

    it("the login limiter: 10 attempts per IP+email, then 429", async () => {
        const statuses = [];
        for (let i = 0; i < 11; i++) {
            statuses.push(
                (
                    await request(app)
                        .post("/api/auth/login")
                        .send({ email: "x@example.test", password: "wrong-pass" })
                ).status,
            );
        }
        expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
        expect(statuses[10]).toBe(429);
    });

    it("purgeExpiredSessions removes only expired sessions", async () => {
        await request(app).post("/api/auth/register").send(credentials);
        const user = await prisma.user.findFirstOrThrow();
        await prisma.session.create({
            data: {
                userId: user.id,
                refreshJti: crypto.randomUUID(),
                expiresAt: new Date(Date.now() - 1000),
            },
        });
        expect(await purgeExpiredSessions()).toBe(1);
        expect(await prisma.session.count()).toBe(1);
    });
});
