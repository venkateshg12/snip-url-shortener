import type { StatsBucket, UrlStatsDto } from "@repo/types";
import { prisma } from "../config/db";
import { cacheRedis } from "../config/redis";
import { AppErrorCode } from "../constants/appErrorCode";
import { NOT_FOUND } from "../constants/http";
import { Prisma } from "../generated/prisma/client";
import { appAssert } from "../utils/errors";
import { resolveTimeZone } from "./timeZone.service";

const STATS_TTL_SECONDS = 60; // stats a minute stale are fine, and they're the heaviest reads
const TOP_N = 10;

type Dimension = "referrer_host" | "browser" | "os" | "device" | "country";

async function topValues(urlId: bigint, from: Date, column: Dimension): Promise<StatsBucket[]> {
    const rows = await prisma.$queryRaw<{ key: string | null; count: bigint }[]>`
        SELECT ${Prisma.raw(column)} AS key, count(*) AS count
        FROM clicks WHERE url_id = ${urlId} AND occurred_at >= ${from}
        GROUP BY 1 ORDER BY 2 DESC, 1 NULLS LAST LIMIT ${TOP_N}`;
    return rows.map((row) => ({ key: row.key, count: Number(row.count) }));
}

export async function getUrlStats(
    userId: string,
    code: string,
    days: number,
    requestedTz: string,
): Promise<UrlStatsDto> {
    const url = await prisma.url.findFirst({
        where: { shortCode: code, userId, status: { not: "deleted" } }, // owner only: others get a 404
        select: { id: true },
    });
    appAssert(url, NOT_FOUND, "Link not found", AppErrorCode.NotFound);

    const tz = await resolveTimeZone(requestedTz); // e.g. "Asia/Calcutta" → "Asia/Kolkata"
    const cacheKey = `stats:v1:${code}:${days}:${tz}`;
    const cached = await cacheRedis.get(cacheKey).catch(() => null);
    if (cached) return JSON.parse(cached) as UrlStatsDto;

    // Day buckets in the VIEWER's time zone, empty days included (generate_series), so charts have no gaps
    const byDay = await prisma.$queryRaw<{ date: string; clicks: bigint; uniques: bigint }[]>`
        WITH days AS (
            SELECT generate_series(
                date_trunc('day', now() AT TIME ZONE ${tz}) - make_interval(days => ${days - 1}),
                date_trunc('day', now() AT TIME ZONE ${tz}),
                interval '1 day') AS day
        ), counts AS (
            SELECT date_trunc('day', occurred_at AT TIME ZONE ${tz}) AS day,
                   count(*) AS clicks, count(DISTINCT visitor) AS uniques
            FROM clicks
            WHERE url_id = ${url.id} AND occurred_at >= (SELECT min(day) FROM days) AT TIME ZONE ${tz}
            GROUP BY 1
        )
        SELECT to_char(days.day, 'YYYY-MM-DD') AS date,
               coalesce(counts.clicks, 0) AS clicks, coalesce(counts.uniques, 0) AS uniques
        FROM days LEFT JOIN counts USING (day) ORDER BY days.day`;

    const from = await prisma.$queryRaw<[{ from: Date }]>`
        SELECT (date_trunc('day', now() AT TIME ZONE ${tz}) - make_interval(days => ${days - 1})) AT TIME ZONE ${tz} AS "from"`;
    const since = from[0].from;
    const [referrers, browsers, os, devices, countries] = await Promise.all([
        topValues(url.id, since, "referrer_host"),
        topValues(url.id, since, "browser"),
        topValues(url.id, since, "os"),
        topValues(url.id, since, "device"),
        topValues(url.id, since, "country"),
    ]);

    const days_ = byDay.map((row) => ({
        date: row.date,
        clicks: Number(row.clicks),
        uniques: Number(row.uniques),
    }));
    const stats: UrlStatsDto = {
        shortCode: code,
        days,
        tz,
        totals: {
            clicks: days_.reduce((sum, day) => sum + day.clicks, 0),
            uniques: days_.reduce((sum, day) => sum + day.uniques, 0),
        },
        byDay: days_,
        referrers,
        browsers,
        os,
        devices,
        countries,
    };
    void cacheRedis.set(cacheKey, JSON.stringify(stats), "EX", STATS_TTL_SECONDS).catch(() => undefined);
    return stats;
}
