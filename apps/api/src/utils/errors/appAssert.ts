import type { AppErrorCode } from "../../constants/appErrorCode";
import type { HttpStatusCode } from "../../constants/http";
import { AppError } from "./appError";

/** Throws an AppError when `condition` is falsy; narrows `condition` afterwards. */
export const appAssert: (
    condition: unknown,
    status: HttpStatusCode,
    message: string,
    code?: AppErrorCode,
) => asserts condition = (condition, status, message, code) => {
    if (!condition) throw new AppError(status, message, code);
};
