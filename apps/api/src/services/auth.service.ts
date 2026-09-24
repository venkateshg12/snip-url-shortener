import { randomUUID } from "node:crypto";
import type { LoginInput, RegisterInput, UserDto } from "@repo/types";
import { prisma } from "../config/db";
import { AppErrorCode } from "../constants/appErrorCode";
import { CONFLICT, UNAUTHORIZED } from "../constants/http";
import type { User } from "../generated/prisma/client";
import {
    burnPasswordCheck,
    hashPassword,
    REFRESH_TOKEN_TTL_MS,
    signAccessToken,
    signRefreshToken,
    verifyPassword,
    verifyRefreshToken,
} from "../utils/auth";
import { AppError, appAssert, isPrismaError } from "../utils/errors";

/** A refresh racing another tab's refresh may present the just-replaced token for this long. */
const ROTATION_GRACE_MS = 30_000;

export const toUserDto = (user: Pick<User, "id" | "email" | "name" | "createdAt">): UserDto => ({
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt.toISOString(),
});

type ParsedRegister = { name: string; email: string; password: string };
type ParsedLogin = { email: string; password: string };
export type { LoginInput, RegisterInput };

async function startSession(userId: string, userAgent: string | undefined) {
    const jti = randomUUID();
    const session = await prisma.session.create({
        data: {
            userId,
            userAgent: userAgent?.slice(0, 512),
            refreshJti: jti,
            expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        },
    });
    return {
        accessToken: signAccessToken({ userId, sessionId: session.id }),
        refreshToken: signRefreshToken({ sessionId: session.id, jti }),
    };
}

export async function register(input: ParsedRegister, userAgent?: string) {
    try {
        const user = await prisma.user.create({
            data: { name: input.name, email: input.email, passwordHash: await hashPassword(input.password) },
        });
        return { user: toUserDto(user), ...(await startSession(user.id, userAgent)) };
    } catch (error) {
        if (isPrismaError(error, "P2002"))
            throw new AppError(
                CONFLICT,
                "An account with this email already exists",
                AppErrorCode.EmailTaken,
            );
        throw error;
    }
}

export async function login(input: ParsedLogin, userAgent?: string) {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    // Unknown email: still spend a bcrypt comparison, so timing doesn't reveal who has an account
    const valid = user
        ? await verifyPassword(input.password, user.passwordHash)
        : await burnPasswordCheck(input.password);
    appAssert(user && valid, UNAUTHORIZED, "Email or password is incorrect", AppErrorCode.InvalidCredentials);
    return { user: toUserDto(user), ...(await startSession(user.id, userAgent)) };
}

/**
 * Refresh with rotation and reuse detection: every refresh replaces the token's jti. Presenting a
 * replaced token means it was copied, so the whole session is revoked, except within a short grace
 * window, where it's almost certainly two tabs refreshing at once.
 */
export async function refresh(refreshToken: string) {
    const invalid = () =>
        new AppError(UNAUTHORIZED, "Session expired. Log in again.", AppErrorCode.InvalidRefreshToken);
    const { payload } = verifyRefreshToken(refreshToken);
    if (!payload) throw invalid();

    const session = await prisma.session.findUnique({ where: { id: payload.sessionId } });
    if (!session || session.expiresAt.getTime() <= Date.now()) throw invalid();

    const now = new Date();
    if (payload.jti === session.refreshJti) {
        const newJti = randomUUID();
        // Atomic: only one of two concurrent refreshes can move refreshJti away from this value
        const { count } = await prisma.session.updateMany({
            where: { id: session.id, refreshJti: payload.jti },
            data: {
                refreshJti: newJti,
                previousJti: payload.jti,
                rotatedAt: now,
                expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS), // sliding session
            },
        });
        if (count === 1) return tokensFor(session.userId, session.id, newJti);
        return refresh(refreshToken); // lost the race: re-read and take the grace path
    }

    const withinGrace =
        payload.jti === session.previousJti &&
        session.rotatedAt &&
        now.getTime() - session.rotatedAt.getTime() < ROTATION_GRACE_MS;
    if (withinGrace) return tokensFor(session.userId, session.id, session.refreshJti);

    // Reuse of an old refresh token: assume theft, end the session everywhere
    await prisma.session.deleteMany({ where: { id: session.id } });
    throw invalid();
}

const tokensFor = (userId: string, sessionId: string, jti: string) => ({
    accessToken: signAccessToken({ userId, sessionId }),
    refreshToken: signRefreshToken({ sessionId, jti }),
});

export async function logout(sessionId: string) {
    await prisma.session.deleteMany({ where: { id: sessionId } });
}

export async function getMe(userId: string): Promise<UserDto> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    appAssert(user, UNAUTHORIZED, "Account not found", AppErrorCode.InvalidAccessToken);
    return toUserDto(user);
}
