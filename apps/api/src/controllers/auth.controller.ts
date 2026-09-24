import { loginSchema, registerSchema } from "@repo/types";
import { CREATED, OK } from "../constants/http";
import * as auth from "../services/auth.service";
import { ok } from "../utils/api";
import { clearAuthCookies, REFRESH_COOKIE, setAuthCookies, verifyRefreshToken } from "../utils/auth";
import { AppError, catchError } from "../utils/errors";
import { AppErrorCode } from "../constants/appErrorCode";
import { UNAUTHORIZED } from "../constants/http";

export const registerHandler = catchError(async (req, res) => {
    const input = registerSchema.parse(req.body);
    const { user, accessToken, refreshToken } = await auth.register(input, req.get("user-agent"));
    setAuthCookies(res, { accessToken, refreshToken }).status(CREATED).json(ok({ user }));
});

export const loginHandler = catchError(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const { user, accessToken, refreshToken } = await auth.login(input, req.get("user-agent"));
    setAuthCookies(res, { accessToken, refreshToken }).status(OK).json(ok({ user }));
});

export const refreshHandler = catchError(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!token)
        throw new AppError(UNAUTHORIZED, "Session expired. Log in again.", AppErrorCode.InvalidRefreshToken);
    const tokens = await auth.refresh(token);
    setAuthCookies(res, tokens)
        .status(OK)
        .json(ok({ refreshed: true }));
});

export const logoutHandler = catchError(async (req, res) => {
    // Log out even with an expired access token: the refresh cookie (scoped to /api/auth) identifies the session too
    if (req.sessionId) await auth.logout(req.sessionId);
    const refreshToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    const { payload } = refreshToken ? verifyRefreshToken(refreshToken) : {};
    if (payload) await auth.logout(payload.sessionId);
    clearAuthCookies(res)
        .status(OK)
        .json(ok({ loggedOut: true }));
});

export const meHandler = catchError(async (req, res) => {
    res.status(OK).json(ok({ user: await auth.getMe(req.userId!) }));
});
