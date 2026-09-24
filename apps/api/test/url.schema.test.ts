import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../src/config/db";
import { nextId } from "../src/services/idAllocator.service";
import { generateShortCode } from "../src/utils/shortCode";
import { isPrismaError } from "../src/utils/errors";
import { truncate } from "./helpers/db";

const newUrl = async (overrides: Partial<{ shortCode: string; longUrl: string }> = {}) => {
    const id = await nextId();
    return { id, shortCode: generateShortCode(id), longUrl: "https://example.com/a", ...overrides };
};

describe("urls table", () => {
    beforeEach(() => truncate("urls"));

    it("a duplicate short_code throws P2002", async () => {
        await prisma.url.create({ data: await newUrl({ shortCode: "taken" }) });
        const error = await prisma.url
            .create({ data: await newUrl({ shortCode: "taken" }) })
            .catch((e: unknown) => e);
        expect(isPrismaError(error, "P2002")).toBe(true);
    });

    it("CHECK constraints hold even for raw SQL", async () => {
        await expect(
            prisma.$executeRaw`INSERT INTO urls (id, short_code, long_url, updated_at) VALUES (1, 'a b', 'https://x.test', now())`,
        ).rejects.toThrow(/urls_short_code_format/);
        await expect(
            prisma.$executeRaw`INSERT INTO urls (id, short_code, long_url, updated_at) VALUES (2, 'abc', 'javascript:alert(1)', now())`,
        ).rejects.toThrow(/urls_long_url_scheme/);
        await expect(
            prisma.$executeRaw`INSERT INTO urls (id, short_code, long_url, expires_at, purge_at, updated_at)
                               VALUES (3, 'abcd', 'https://x.test', now(), now() - interval '1 day', now())`,
        ).rejects.toThrow(/urls_purge_after_expiry/);
    });

    it("the redirect lookup uses the unique index", async () => {
        const rows = await Promise.all(Array.from({ length: 5000 }, () => newUrl()));
        await prisma.url.createMany({
            data: rows.map((r, i) => ({ ...r, longUrl: `https://example.com/${i}` })),
        });
        await prisma.$executeRaw`ANALYZE urls`;
        const target = rows[1234]!.shortCode;
        const [{ "QUERY PLAN": plan }] = await prisma.$queryRaw<
            [{ "QUERY PLAN": { Plan: Record<string, unknown> }[] }]
        >`
            EXPLAIN (ANALYZE, FORMAT JSON) SELECT long_url, expires_at, status FROM urls WHERE short_code = ${target}`;
        expect(plan[0]!.Plan).toMatchObject({
            "Node Type": "Index Scan",
            "Index Name": "urls_short_code_key",
            "Actual Rows": 1,
        });
    });
});
