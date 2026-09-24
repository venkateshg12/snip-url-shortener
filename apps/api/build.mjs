import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { build } from "esbuild";

// Bundle the two entry points. Real npm dependencies stay external (installed in the image);
// the workspace's source-only @repo/types is compiled in, because plain `node` can't load .ts.
const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const external = Object.keys(pkg.dependencies ?? {});

await build({
    entryPoints: ["src/index.ts", "src/worker.ts"],
    outdir: "dist",
    bundle: true,
    platform: "node",
    target: "node22",
    format: "cjs",
    sourcemap: true,
    external: [...external, ...external.map((name) => `${name}/*`)],
    logLevel: "info",
});
