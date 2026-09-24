import type { CookieOptions, Response } from "express";
import { COOKIE_DOMAIN, NODE_ENV } from "../../constants/env";
import { ACCESS_TOKEN_TTL_MS, REFRESH_TOKEN_TTL_MS } from "./jwt";

export const ACCESS_COOKIE = "accessToken";
export const REFRESH_COOKIE = "refreshToken";
/** The refresh endpoint. */
export const REFRESH_PATH = "/api/auth/refresh";
/**
 * The refresh cookie is scoped to the auth endpoints only: refresh needs it, and logout uses it to
 * end the session even when the 15-minute access token has already expired.
 */
export const REFRESH_COOKIE_PATH = "/api/auth";

// Lax (not Strict): web and API are different ports locally and different subdomains in production.
// Lax + a strict CORS allowlist + JSON-only bodies covers CSRF here (see phase 6).
const base = (): CookieOptions => ({
    httpOnly: true,
    sameSite: "lax",
    secure: NODE_ENV === "production",
    ...(COOKIE_DOMAIN && { domain: COOKIE_DOMAIN }),
});

export function setAuthCookies(res: Response, tokens: { accessToken: string; refreshToken?: string }) {
    res.cookie(ACCESS_COOKIE, tokens.accessToken, { ...base(), path: "/", maxAge: ACCESS_TOKEN_TTL_MS });
    if (tokens.refreshToken) {
        res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
            ...base(),
            path: REFRESH_COOKIE_PATH,
            maxAge: REFRESH_TOKEN_TTL_MS,
        });
    }
    return res;
}

export function clearAuthCookies(res: Response) {
    res.clearCookie(ACCESS_COOKIE, { ...base(), path: "/" });
    res.clearCookie(REFRESH_COOKIE, { ...base(), path: REFRESH_COOKIE_PATH });
    return res;
}
