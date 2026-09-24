import dotenv from "dotenv";

/** Loads .env and returns the test database URL. Every test entry point uses this. */
export function testDatabaseUrl(): string {
    dotenv.config({ quiet: true });
    const url = process.env.DATABASE_URL_TEST;
    if (!url) throw new Error("DATABASE_URL_TEST is not set (see apps/api/.env.example)");
    if (!/_test\b/.test(url)) throw new Error(`Refusing to run tests against a non-test database: ${url}`);
    return url;
}
