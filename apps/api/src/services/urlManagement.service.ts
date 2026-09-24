import type { PaginationMeta, UrlDto } from "@repo/types";
import { prisma } from "../config/db";
import { AppErrorCode } from "../constants/appErrorCode";
import { NOT_FOUND } from "../constants/http";
import { invalidateUrl } from "../utils/cache";
import { appAssert } from "../utils/errors";
import { toUrlDto } from "./url.service";

const PURGE_GRACE_MS = 30 * 86_400_000;
const notFound = () => appAssert(false, NOT_FOUND, "Link not found", AppErrorCode.NotFound);

// Every query is scoped by BOTH shortCode and userId. Someone else's link is a 404, not a 403:
// a 403 would confirm the link exists.
const owned = (userId: string, shortCode: string) => ({
    shortCode,
    userId,
    status: { not: "deleted" as const },
});

export async function listUrls(
    userId: string,
    page: number,
    limit: number,
): Promise<{ urls: UrlDto[]; meta: PaginationMeta }> {
    const where = { userId, status: { not: "deleted" as const } };
    // One transaction, so the page and the total describe the same moment
    const [rows, total] = await prisma.$transaction([
        prisma.url.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
        prisma.url.count({ where }),
    ]);
    return { urls: rows.map(toUrlDto), meta: { page, limit, total, hasMore: page * limit < total } };
}

export async function getUrl(userId: string, code: string): Promise<UrlDto> {
    const url = await prisma.url.findFirst({ where: owned(userId, code) });
    if (!url) notFound();
    return toUrlDto(url!);
}

export async function updateUrl(
    userId: string,
    code: string,
    patch: { expiresAt?: Date | null; status?: "active" | "disabled" },
): Promise<UrlDto> {
    const data: { status?: "active" | "disabled"; expiresAt?: Date | null; purgeAt?: Date | null } = {};
    if (patch.status) data.status = patch.status;
    if (patch.expiresAt !== undefined) {
        data.expiresAt = patch.expiresAt;
        data.purgeAt = patch.expiresAt && new Date(patch.expiresAt.getTime() + PURGE_GRACE_MS);
    }
    // The ownership check is part of the write: one statement, no read-then-write race
    const { count } = await prisma.url.updateMany({ where: owned(userId, code), data });
    if (count !== 1) notFound();
    await invalidateUrl(code); // where the code points (or whether it works) just changed
    return getUrl(userId, code);
}

/**
 * Soft delete: the row stays 30 days (the purge job removes it), so a deleted custom alias can't be
 * claimed straight away by someone hijacking old printed links.
 */
export async function deleteUrl(userId: string, code: string): Promise<void> {
    const now = new Date();
    const { count } = await prisma.url.updateMany({
        where: owned(userId, code),
        data: { status: "deleted", expiresAt: now, purgeAt: new Date(now.getTime() + PURGE_GRACE_MS) },
    });
    if (count !== 1) notFound();
    await invalidateUrl(code);
}
