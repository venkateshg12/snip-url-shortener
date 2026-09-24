import { z } from "zod";

const isTimeZone = (tz: string) => {
    try {
        new Intl.DateTimeFormat("en", { timeZone: tz });
        return true;
    } catch {
        return false;
    }
};

export const STATS_DAY_OPTIONS = [7, 30, 90] as const;

export const statsQuerySchema = z.object({
    days: z.coerce.number().int().min(1).max(90).default(30),
    tz: z.string().default("UTC").refine(isTimeZone, "Unknown time zone"),
});
export type StatsQuery = z.input<typeof statsQuerySchema>;

/** `key: null` means "none recorded": direct visits for referrers, unknown otherwise. */
export type StatsBucket = { key: string | null; count: number };

export type UrlStatsDto = {
    shortCode: string;
    days: number;
    tz: string;
    /** `uniques` is the sum of daily unique visitors: someone who visits on 3 days counts 3 times. */
    totals: { clicks: number; uniques: number };
    /** One entry per day in the range, oldest first, zero-filled. `date` is YYYY-MM-DD in `tz`. */
    byDay: { date: string; clicks: number; uniques: number }[];
    referrers: StatsBucket[];
    browsers: StatsBucket[];
    os: StatsBucket[];
    devices: StatsBucket[];
    countries: StatsBucket[];
};
