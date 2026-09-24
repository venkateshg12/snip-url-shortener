/** One entry in an error response. `path` is set for field-level validation errors. */
export type ApiError = { path?: string; message: string; code?: string };

/** Every API response, success or failure, has this shape. */
export type ApiEnvelope<T> = {
    status: "success" | "error";
    data: T | null;
    meta?: Record<string, unknown>;
    errors?: ApiError[];
};

export type PaginationMeta = { page: number; limit: number; total: number; hasMore: boolean };
