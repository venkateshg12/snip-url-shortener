import { afterEach, describe, expect, it, vi } from "vitest";
import { parseShortcodeKeys } from "../src/constants/env";

// env.ts validates when it's imported, so each case reloads it with a different environment.
// An empty string counts as missing (dotenv never overrides a variable that's already set).
const load = async (overrides: Record<string, string>) => {
    vi.unstubAllEnvs(); // each load starts from the real environment
    vi.resetModules();
    for (const [key, value] of Object.entries(overrides)) vi.stubEnv(key, value);
    return import("../src/constants/env");
};

describe("env", () => {
    afterEach(() => vi.unstubAllEnvs());

    it("names a missing variable", async () => {
        await expect(load({ DATABASE_URL: "" })).rejects.toThrow("Missing environment variable DATABASE_URL");
    });

    it("names an invalid variable", async () => {
        await expect(load({ PORT: "abc" })).rejects.toThrow(/PORT must be a whole number/);
        await expect(load({ DATABASE_URL: "mysql://localhost/db" })).rejects.toThrow(/DATABASE_URL must start with postgres/);
        await expect(load({ CACHE_ENABLED: "maybe" })).rejects.toThrow(/CACHE_ENABLED/);
    });

    it("rejects short or identical JWT secrets", async () => {
        await expect(load({ JWT_SECRET: "short" })).rejects.toThrow(/JWT_SECRET must be at least 32/);
        const same = "x".repeat(40);
        await expect(load({ JWT_SECRET: same, JWT_REFRESH_SECRET: same })).rejects.toThrow(/must be different/);
    });

    it("applies defaults and parses lists", async () => {
        const env = await load({ PORT: "", DB_POOL_MAX: "", CORS_ORIGINS: "http://a.test, http://b.test", TRUSTED_PROXIES: "2" });
        expect(env.PORT).toBe(4000);
        expect(env.DB_POOL_MAX).toBe(10);
        expect(env.CORS_ORIGINS).toEqual(["http://a.test", "http://b.test"]);
        expect(env.TRUST_PROXY).toBe(2);
    });

    it("refuses short-code keys that would break the bijection", () => {
        expect(() => parseShortcodeKeys("2000000000000,1,1797563467723,1")).toThrow(/odd/); // even P1
        expect(() => parseShortcodeKeys("1797563467723,1,3100000000031,1")).toThrow(/31/); // 31 | P2
        expect(() => parseShortcodeKeys("1,2,3")).toThrow(/four integers/);
    });
});
