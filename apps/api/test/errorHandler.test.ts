import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AppErrorCode } from "../src/constants/appErrorCode";
import { FORBIDDEN } from "../src/constants/http";
import { Prisma } from "../src/generated/prisma/client";
import { errorHandler } from "../src/middleware/errorHandler";
import { AppError } from "../src/utils/errors";

const prismaError = (code: string) =>
    new Prisma.PrismaClientKnownRequestError("boom", { code, clientVersion: Prisma.prismaVersion.client });

function appThrowing(error: unknown) {
    const app = express();
    app.use(express.json({ limit: "10b" }));
    app.post("/", () => {
        throw error;
    });
    app.use(errorHandler);
    return app;
}

describe("errorHandler", () => {
    it("Zod → 400 with every issue as a field error", async () => {
        const zodError = z.object({ url: z.url(), n: z.number() }).safeParse({ url: "x", n: "y" }).error;
        const res = await request(appThrowing(zodError)).post("/");
        expect(res.status).toBe(400);
        expect(res.body).toMatchObject({ status: "error", data: null });
        expect(res.body.errors.map((e: { path: string }) => e.path).sort()).toEqual(["n", "url"]);
        expect(res.body.errors[0].code).toBe(AppErrorCode.ValidationError);
    });

    it("AppError → its status, message and code", async () => {
        const res = await request(appThrowing(new AppError(FORBIDDEN, "Nope", AppErrorCode.NotFound))).post(
            "/",
        );
        expect(res.status).toBe(403);
        expect(res.body.errors).toEqual([{ message: "Nope", code: AppErrorCode.NotFound }]);
    });

    it("Prisma P2002 → 409, P2025 → 404", async () => {
        expect((await request(appThrowing(prismaError("P2002"))).post("/")).status).toBe(409);
        expect((await request(appThrowing(prismaError("P2025"))).post("/")).status).toBe(404);
    });

    it("bad JSON → 400, oversized body → 413", async () => {
        const app = appThrowing(new Error("unreachable"));
        const bad = await request(app).post("/").set("content-type", "application/json").send("{nope");
        expect(bad.status).toBe(400);
        expect(bad.body.errors[0].code).toBe(AppErrorCode.InvalidJson);
        const big = await request(app).post("/").send({ text: "much more than ten bytes" });
        expect(big.status).toBe(413);
    });

    it("anything else → 500 without leaking the message", async () => {
        const res = await request(appThrowing(new Error("secret internals"))).post("/");
        expect(res.status).toBe(500);
        expect(res.body.errors).toEqual([
            { message: "Internal Server Error", code: AppErrorCode.InternalServerError },
        ]);
    });
});
