import { execSync } from "node:child_process";
import { testDatabaseUrl } from "./testEnv";

// Once per run: apply any pending migrations to the test database. `migrate deploy` never drops
// data; tests clean up with TRUNCATE (see test/db.ts), which only ever runs against *_test.
export default function setup() {
    execSync("pnpm exec prisma migrate deploy", {
        env: { ...process.env, DATABASE_URL: testDatabaseUrl(), PRISMA_HIDE_UPDATE_MESSAGE: "1" },
        stdio: "pipe",
    });
}
