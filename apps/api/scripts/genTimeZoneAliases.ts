import { readFileSync, writeFileSync } from "node:fs";

/**
 * Builds src/constants/timeZoneAliases.json from a tzdata.zi file (its "L <target> <link>" lines).
 * Browsers report CLDR names such as "Asia/Calcutta", which are tz *links*; Debian-based Postgres
 * images don't ship the legacy links (tzdata-legacy), so the API maps each link to its target.
 * Regenerate from the database image's own tzdata:
 *   docker compose exec -T postgres cat /usr/share/zoneinfo/tzdata.zi | pnpm --filter api gen:tz-aliases
 */
const source = readFileSync(process.argv[2] ?? "/dev/stdin", "utf8");
const aliases: Record<string, string> = {};
for (const line of source.split("\n")) {
    const [kind, target, link] = line.trim().split(/\s+/);
    if (kind === "L" && target && link) aliases[link] = target;
}
const sorted = Object.fromEntries(Object.entries(aliases).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(
    new URL("../src/constants/timeZoneAliases.json", import.meta.url),
    `${JSON.stringify(sorted, null, 4)}\n`,
);
console.log(`wrote ${Object.keys(sorted).length} aliases`);
