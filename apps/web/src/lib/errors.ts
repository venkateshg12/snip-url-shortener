import type { ApiEnvelope } from "@repo/types";
import { isAxiosError } from "axios";

export type FieldError = { path: string; message: string };

/** The only error type the app handles: every failure becomes one of these. */
export class ApiError extends Error {
    constructor(
        readonly status: number,
        message: string,
        readonly code?: string,
        readonly fieldErrors: FieldError[] = [],
    ) {
        super(message);
        this.name = "ApiError";
    }
}

const NETWORK_MESSAGE = "Can't reach the server. Check your connection.";
const SERVER_MESSAGE = "Something went wrong. Try again.";

export function toApiError(error: unknown): ApiError {
    if (error instanceof ApiError) return error;
    if (isAxiosError(error)) {
        if (!error.response) return new ApiError(0, NETWORK_MESSAGE, "NETWORK_ERROR");
        const { status, data } = error.response;
        const envelope = data as Partial<ApiEnvelope<unknown>> | undefined;
        const errors = envelope?.errors ?? [];
        const fieldErrors = errors
            .filter((e): e is FieldError => typeof e.path === "string" && e.path !== "")
            .map(({ path, message }) => ({ path, message }));
        // 5xx messages are never shown raw: they're for logs, not people
        const message = status >= 500 ? SERVER_MESSAGE : (errors[0]?.message ?? SERVER_MESSAGE);
        return new ApiError(status, message, errors[0]?.code, fieldErrors);
    }
    return new ApiError(0, SERVER_MESSAGE);
}
