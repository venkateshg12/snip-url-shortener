import { spawn } from "node:child_process";
import { describe, expect, it } from "vitest";

// Boots the real entry point and sends it SIGTERM: it must drain and exit 0.
describe("graceful shutdown", () => {
    it("exits 0 after SIGTERM, running the shutdown steps", async () => {
        // node itself (not a pnpm wrapper), so the signal reaches the server process
        const child = spawn(process.execPath, ["--import", "tsx", "src/index.ts"], {
            env: { ...process.env, NODE_ENV: "development", LOG_LEVEL: "info", PORT: "4199", METRICS_PORT: "9199" },
            stdio: ["ignore", "pipe", "pipe"],
        });
        let output = "";
        child.stdout.on("data", (chunk) => (output += chunk));
        child.stderr.on("data", (chunk) => (output += chunk));

        await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error(`never listened:\n${output}`)), 30_000);
            child.stdout.on("data", () => {
                if (output.includes('"msg":"listening"')) {
                    clearTimeout(timer);
                    resolve();
                }
            });
        });
        const exit = new Promise<number | null>((resolve) => child.on("exit", (code) => resolve(code)));
        child.kill("SIGTERM");
        expect(await exit).toBe(0);
        expect(output).toContain("shutdown complete");
    }, 60_000);
});
