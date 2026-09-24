import type { UrlDto } from "@repo/types";
import { prisma } from "../config/db";
import { AppErrorCode } from "../constants/appErrorCode";
import { SHORT_BASE_URL } from "../constants/env";
import { BAD_REQUEST, CONFLICT, INTERNAL_SERVER_ERROR, UNAUTHORIZED } from "../constants/http";
import type { Prisma, Url } from "../generated/prisma/client";
import { ttlFor, urlCache } from "../utils/cache";
import { AppError, appAssert, isPrismaError } from "../utils/errors";
import { generateShortCode, isReserved } from "../utils/shortCode";
import { normalizeTargetUrl } from "../utils/url/normalize";
import { nextId } from "./idAllocator.service";
import { toCached } from "./redirect.service";

const DAY_MS = 86_400_000;
const ANONYMOUS_MAX_LIFETIME_MS = 30 * DAY_MS;
const PURGE_GRACE_MS = 30 * DAY_MS;
const GENERATION_ATTEMPTS = 3;

type ParsedCreateInput = { url: string; customAlias?: string; expiresAt?: Date };
type NewUrlFields = Omit<Prisma.UrlUncheckedCreateInput, "id" | "shortCode">;

export const toUrlDto = (url: Url): UrlDto => ({
    shortCode: url.shortCode,
    shortUrl: `${SHORT_BASE_URL}/${url.shortCode}`,
    longUrl: url.longUrl,
    isCustomAlias: url.isCustomAlias,
    status: url.status === "deleted" ? "disabled" : url.status, // deleted links are never listed; defensive
    expiresAt: url.expiresAt?.toISOString() ?? null,
    clickCount: Number(url.clickCount), // bigint → number: safe far beyond any real count
    createdAt: url.createdAt.toISOString(),
});

/** Anonymous links live at most 30 days (clamped, not an error); users choose freely. */
function resolveExpiry(requested: Date | undefined, userId: string | null): Date | null {
    if (userId) return requested ?? null;
    const cap = new Date(Date.now() + ANONYMOUS_MAX_LIFETIME_MS);
    return requested && requested < cap ? requested : cap;
}

/** Generated codes can't collide with each other, but an alias can take a future code: retry. */
async function insertWithGeneratedCode(fields: NewUrlFields): Promise<Url> {
    for (let attempt = 0; attempt < GENERATION_ATTEMPTS; attempt++) {
        const id = await nextId();
        try {
            return await prisma.url.create({ data: { ...fields, id, shortCode: generateShortCode(id) } });
        } catch (error) {
            if (!isPrismaError(error, "P2002")) throw error;
        }
    }
    throw new AppError(
        INTERNAL_SERVER_ERROR,
        "Couldn't generate a short code",
        AppErrorCode.CodeGenerationFailed,
    );
}

export async function createShortUrl(
    input: ParsedCreateInput,
    ctx: { userId: string | null },
): Promise<UrlDto> {
    const longUrl = normalizeTargetUrl(input.url);
    const expiresAt = resolveExpiry(input.expiresAt, ctx.userId);
    const fields: NewUrlFields = {
        longUrl,
        userId: ctx.userId,
        expiresAt,
        purgeAt: expiresAt && new Date(expiresAt.getTime() + PURGE_GRACE_MS),
    };

    let url: Url;
    if (input.customAlias) {
        appAssert(ctx.userId, UNAUTHORIZED, "Log in to choose a custom alias", AppErrorCode.LoginRequired);
        appAssert(
            !isReserved(input.customAlias),
            BAD_REQUEST,
            "That alias is reserved",
            AppErrorCode.ReservedAlias,
        );
        try {
            url = await prisma.url.create({
                data: { ...fields, id: await nextId(), shortCode: input.customAlias, isCustomAlias: true },
            });
        } catch (error) {
            if (isPrismaError(error, "P2002")) {
                throw new AppError(CONFLICT, "That alias is already taken", AppErrorCode.AliasTaken);
            }
            throw error;
        }
    } else {
        url = await insertWithGeneratedCode(fields);
    }
    // Write-through: overwrites a negative entry left by someone probing this code a moment ago
    const cached = toCached(url);
    void urlCache.set(url.shortCode, cached, ttlFor(cached.e));
    return toUrlDto(url);
}
