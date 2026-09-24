import { prisma } from "../../config/db";
import { isBot, parseUserAgent, referrerHost } from "../../utils/analytics/userAgent";
import type { ClickEvent } from "../interfaces";

export const processorStats = { inserted: 0, duplicates: 0, bots: 0 };

/**
 * One statement per batch: insert the clicks, and bump each link's counter by the number of rows
 * ACTUALLY inserted. BullMQ may run a job twice (a worker dies after the commit, before the ack);
 * the second run's inserts all conflict on id, `inserted` is empty, and no counter moves. So an
 * at-least-once queue gives an exactly-once effect.
 */
export async function processClickBatch(events: ClickEvent[]): Promise<{ inserted: number; bots: number }> {
    const humans = events.filter((event) => !isBot(event.ua));
    const bots = events.length - humans.length;
    processorStats.bots += bots;
    if (humans.length === 0) return { inserted: 0, bots };

    const rows = humans.map((event) => ({
        ...event,
        ...parseUserAgent(event.ua),
        referrerHost: referrerHost(event.referrer),
    }));
    const col = <K extends keyof (typeof rows)[number]>(key: K) => rows.map((row) => row[key]);

    const [{ inserted }] = await prisma.$queryRaw<[{ inserted: number }]>`
        WITH inserted AS (
            INSERT INTO clicks (id, url_id, occurred_at, referrer_host, browser, os, device, country, visitor)
            SELECT t.id, t.url_id, t.occurred_at, t.referrer_host, t.browser, t.os, t.device, t.country, t.visitor
            FROM unnest(
                ${col("id")}::uuid[], ${col("urlId")}::bigint[],
                ${rows.map((row) => new Date(row.ts).toISOString())}::timestamptz[],
                ${col("referrerHost")}::text[], ${col("browser")}::text[], ${col("os")}::text[],
                ${col("device")}::text[], ${col("country")}::text[], ${col("visitor")}::text[]
            ) AS t(id, url_id, occurred_at, referrer_host, browser, os, device, country, visitor)
            WHERE EXISTS (SELECT 1 FROM urls u WHERE u.id = t.url_id) -- the link may be gone since the click
            ON CONFLICT (id) DO NOTHING
            RETURNING url_id, occurred_at
        ), per_url AS (
            SELECT url_id, count(*) AS n, max(occurred_at) AS last FROM inserted GROUP BY url_id
        ), updated AS (
            UPDATE urls u
            SET click_count = u.click_count + p.n,
                last_clicked_at = GREATEST(u.last_clicked_at, p.last) -- GREATEST ignores NULL
            FROM per_url p WHERE u.id = p.url_id
            RETURNING 1
        )
        SELECT (SELECT count(*) FROM inserted)::int AS inserted`;

    processorStats.inserted += inserted;
    processorStats.duplicates += humans.length - inserted;
    return { inserted, bots };
}
