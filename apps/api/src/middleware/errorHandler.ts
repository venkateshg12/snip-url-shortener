import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppErrorCode } from "../constants/appErrorCode";
import {
    BAD_REQUEST,
    CONFLICT,
    INTERNAL_SERVER_ERROR,
    NOT_FOUND,
    PAYLOAD_TOO_LARGE,
} from "../constants/http";
import { fail } from "../utils/api";
import { clearAuthCookies, REFRESH_PATH } from "../utils/auth";
import { AppError, isPrismaError } from "../utils/errors";
import { logger } from "../utils/logger";

// body-parser's errors carry a `type`
const bodyParserError = (error: unknown): string | undefined =>
    typeof error === "object" && error !== null && "type" in error && typeof error.type === "string"
        ? error.type
        : undefined;

// The order of the checks matters: specific types first, the 500 last.
export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction) {
    // A failed refresh means the session is over: don't leave dead cookies in the browser
    if (req.originalUrl.split("?")[0] === REFRESH_PATH) clearAuthCookies(res);

    if (error instanceof ZodError) {
        const issues = error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
            code: AppErrorCode.ValidationError,
        }));
        return res.status(BAD_REQUEST).json(fail("Invalid request", AppErrorCode.ValidationError, issues));
    }
    if (error instanceof AppError) {
        return res
            .status(error.statusCode)
            .json(fail(error.message, error.errorCode ?? AppErrorCode.AppError));
    }
    if (isPrismaError(error, "P2002")) {
        return res.status(CONFLICT).json(fail("Already exists", AppErrorCode.Duplicate));
    }
    if (isPrismaError(error, "P2025")) {
        return res.status(NOT_FOUND).json(fail("Not found", AppErrorCode.NotFound));
    }
    switch (bodyParserError(error)) {
        case "entity.parse.failed":
            return res
                .status(BAD_REQUEST)
                .json(fail("The request body isn't valid JSON", AppErrorCode.InvalidJson));
        case "entity.too.large":
            return res
                .status(PAYLOAD_TOO_LARGE)
                .json(fail("The request body is too large", AppErrorCode.PayloadTooLarge));
    }

    logger.error({ err: error, reqId: req.id }, "unhandled error");
    return res
        .status(INTERNAL_SERVER_ERROR)
        .json(fail("Internal Server Error", AppErrorCode.InternalServerError));
}
