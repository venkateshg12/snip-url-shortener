import MockAdapter from "axios-mock-adapter";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { API } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { useAuthStore } from "@/store/auth.store";

describe("the refresh interceptor", () => {
    let mock: MockAdapter;
    beforeEach(() => {
        mock = new MockAdapter(API);
        useAuthStore.setState({
            status: "authenticated",
            user: { id: "1", email: "a@b.c", name: "A", createdAt: "" },
            guestReason: null,
        });
    });
    afterEach(() => mock.restore());

    it("three concurrent 401s → ONE refresh, and all three are replayed", async () => {
        let refreshed = false;
        let refreshCalls = 0;
        mock.onGet("/auth/refresh").reply(() => {
            refreshCalls++;
            refreshed = true;
            return [200, { status: "success", data: { refreshed: true } }];
        });
        mock.onGet(/\/urls.*/).reply(() =>
            refreshed
                ? [200, { status: "success", data: [] }]
                : [401, { status: "error", data: null, errors: [{ message: "Token expired" }] }],
        );

        const results = await Promise.all([
            API.get("/urls?page=1"),
            API.get("/urls?page=2"),
            API.get("/urls/abc"),
        ]);
        expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
        expect(refreshCalls).toBe(1);
    });

    it("refresh fails → the store becomes guest and the caller gets an ApiError", async () => {
        mock.onGet("/auth/refresh").reply(401, {
            status: "error",
            data: null,
            errors: [{ message: "Session expired. Log in again." }],
        });
        mock.onGet("/urls").reply(401, {
            status: "error",
            data: null,
            errors: [{ message: "Token expired" }],
        });

        const error = await API.get("/urls").catch((e: unknown) => e);
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(401);
        expect(useAuthStore.getState().status).toBe("guest");
    });

    it("auth routes never trigger a refresh (no loops)", async () => {
        let refreshCalls = 0;
        mock.onGet("/auth/refresh").reply(() => {
            refreshCalls++;
            return [200, {}];
        });
        mock.onPost("/auth/login").reply(401, {
            status: "error",
            data: null,
            errors: [{ message: "Email or password is incorrect" }],
        });
        await API.post("/auth/login", {}).catch(() => undefined);
        expect(refreshCalls).toBe(0);
    });
});
