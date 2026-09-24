import type { Request, RequestHandler } from "express";
import { prisma } from "../config/db";
import { AppErrorCode } from "../constants/appErrorCode";
import { UNAUTHORIZED } from "../constants/http";
import { ACCESS_COOKIE, verifyAccessToken } from "../utils/auth";
import { appAssert, catchError } from "../utils/errors";

/**
 * Verifies the access cookie AND that its session still exists, so logout and revocation take
 * effect immediately rather than when the 15-minute token expires. (One primary-key lookup, and
 * only on API routes: the redirect path never authenticates.)
 */
async function resolveUser(req: Request, token: string) {
    const { payload, error } = verifyAccessToken(token);
    appAssert(
        payload,
        UNAUTHORIZED,
        error === "jwt expired" ? "Token expired" : "Invalid token",
        AppErrorCode.InvalidAccessToken,
    );
    const session = await prisma.session.findUnique({
        where: { id: payload.sessionId },
        select: { userId: true, expiresAt: true },
    });
    appAssert(
        session && session.userId === payload.userId && session.expiresAt.getTime() > Date.now(),
        UNAUTHORIZED,
        "Session ended",
        AppErrorCode.InvalidAccessToken,
    );
    req.userId = payload.userId;
    req.sessionId = payload.sessionId;
}

/** Required: no valid session → 401. */
export const authenticate: RequestHandler = catchError(async (req, _res, next) => {
    const token = req.cookies?.[ACCESS_COOKIE] as string | undefined;
    appAssert(token, UNAUTHORIZED, "Not authorized", AppErrorCode.InvalidAccessToken);
    await resolveUser(req, token);
    next();
});

/**
 * Optional: no cookie → anonymous. But a cookie that's present and expired is a 401, NOT anonymous:
 * otherwise an expired session would silently create an anonymous link. The web client refreshes
 * and retries.
 */
export const optionalAuth: RequestHandler = catchError(async (req, _res, next) => {
    const token = req.cookies?.[ACCESS_COOKIE] as string | undefined;
    if (token) await resolveUser(req, token);
    next();
});

/** Best effort: sets req.userId when the access cookie is valid, ignores it otherwise (logout). */
export const tryAuth: RequestHandler = async (req, _res, next) => {
    const token = req.cookies?.[ACCESS_COOKIE] as string | undefined;
    if (token) await resolveUser(req, token).catch(() => undefined);
    next();
};
