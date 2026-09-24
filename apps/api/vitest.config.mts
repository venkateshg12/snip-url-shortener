import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
        include: ["test/**/*.test.ts"],
        globalSetup: ["test/globalSetup.ts"],
        setupFiles: ["test/setupEnv.ts"],
        // Integration tests share one Postgres database, so files run one at a time
        fileParallelism: false,
        testTimeout: 20_000,
        hookTimeout: 60_000,
    },
});
