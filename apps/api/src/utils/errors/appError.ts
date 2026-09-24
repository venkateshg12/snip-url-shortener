import type { AppErrorCode } from "../../constants/appErrorCode";
import type { HttpStatusCode } from "../../constants/http";

export class AppError extends Error {
    constructor(
        readonly statusCode: HttpStatusCode,
        message: string,
        readonly errorCode?: AppErrorCode,
    ) {
        super(message);
        this.name = "AppError";
    }
}
