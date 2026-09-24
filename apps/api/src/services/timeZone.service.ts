import { prisma } from "../config/db";
import aliases from "../constants/timeZoneAliases.json";
import { logger } from "../utils/logger";

const ALIASES: Record<string, string> = aliases;
let known: Promise<Set<string>> | null = null;

/** The zone names this Postgres can use, loaded once per process (≈500 names). */
function knownZones(): Promise<Set<string>> {
    known ??= prisma.$queryRaw<{ name: string }[]>`SELECT name FROM pg_timezone_names`
        .then((rows) => new Set(rows.map((r) => r.name)))
        .catch((error: unknown) => {
            known = null; // retry next time
            throw error;
        });
    return known;
}

/**
 * Browsers send CLDR zone names ("Asia/Calcutta"); Postgres may only know the tz target
 * ("Asia/Kolkata"). Follow tz links until Postgres recognises the name; if nothing matches,
 * use UTC rather than fail. The stats response reports the zone actually used.
 */
export async function resolveTimeZone(tz: string): Promise<string> {
    const zones = await knownZones();
    let candidate: string | undefined = tz;
    for (let hops = 0; candidate && hops < 5; hops++) {
        if (zones.has(candidate)) return candidate;
        candidate = ALIASES[candidate];
    }
    logger.warn({ tz }, "time zone unknown to Postgres; using UTC");
    return "UTC";
}
