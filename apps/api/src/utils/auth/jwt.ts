import jwt, { type SignOptions } from "jsonwebtoken";
import { JWT_REFRESH_SECRET, JWT_SECRET } from "../../constants/env";

export type AccessTokenPayload = { userId: string; sessionId: string };
export type RefreshTokenPayload = { sessionId: string; jti: string };

export const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const access: SignOptions = { expiresIn: ACCESS_TOKEN_TTL_MS / 1000, audience: "api" };
const refresh: SignOptions = { expiresIn: REFRESH_TOKEN_TTL_MS / 1000, audience: "refresh" };

export const signAccessToken = (payload: AccessTokenPayload) => jwt.sign(payload, JWT_SECRET, access);
// The jti claim identifies this refresh token: rotation replaces it on every refresh
export const signRefreshToken = ({ sessionId, jti }: RefreshTokenPayload) =>
    jwt.sign({ sessionId }, JWT_REFRESH_SECRET, { ...refresh, jwtid: jti });

type Verified<T> = { payload: T; error?: never } | { payload?: never; error: string };

export function verifyAccessToken(token: string): Verified<AccessTokenPayload> {
    try {
        const { userId, sessionId } = jwt.verify(token, JWT_SECRET, {
            audience: "api",
        }) as AccessTokenPayload;
        return { payload: { userId, sessionId } };
    } catch (error) {
        return { error: (error as Error).message };
    }
}

export function verifyRefreshToken(token: string): Verified<RefreshTokenPayload> {
    try {
        const { sessionId, jti } = jwt.verify(token, JWT_REFRESH_SECRET, {
            audience: "refresh",
        }) as RefreshTokenPayload;
        if (!jti) return { error: "missing jti" };
        return { payload: { sessionId, jti } };
    } catch (error) {
        return { error: (error as Error).message };
    }
}
