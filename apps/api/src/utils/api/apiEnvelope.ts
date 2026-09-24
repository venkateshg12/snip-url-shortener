import type { ApiEnvelope, ApiError } from "@repo/types";

export function ok<T>(data: T, meta?: Record<string, unknown>): ApiEnvelope<T> {
    return meta ? { status: "success", data, meta } : { status: "success", data };
}

export function fail(message: string, code?: string, errors?: ApiError[]): ApiEnvelope<null> {
    return { status: "error", data: null, errors: errors ?? [{ message, code }] };
}
