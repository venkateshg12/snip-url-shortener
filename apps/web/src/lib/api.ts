import type { ApiEnvelope } from "@repo/types";
import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { API_URL } from "@/constants/env";
import { useAuthStore } from "@/store/auth.store";
import { toApiError } from "./errors";

/** The one HTTP client. Cookies carry the session, so every request sends credentials. */
export const API = axios.create({ baseURL: `${API_URL}/api`, withCredentials: true });

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

// Every concurrent 401 waits on the same refresh instead of each starting one
let refreshing: Promise<void> | null = null;

API.interceptors.response.use(undefined, async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    const isAuthRoute = original?.url?.startsWith("/auth/");
    if (error.response?.status === 401 && original && !original._retry && !isAuthRoute) {
        original._retry = true;
        try {
            refreshing ??= API.get("/auth/refresh")
                .then(() => undefined)
                .finally(() => {
                    refreshing = null;
                });
            await refreshing;
            return API(original); // replay the original request with the new cookie
        } catch {
            useAuthStore.getState().setGuest(); // refresh failed → logged out
        }
    }
    return Promise.reject(toApiError(error)); // callers always get an ApiError
});

/** Unwraps the envelope: `data` for callers, `meta` when a list needs it. */
export async function unwrap<T>(
    request: Promise<{ data: ApiEnvelope<T> }>,
): Promise<{ data: T; meta?: Record<string, unknown> }> {
    const { data } = await request;
    return { data: data.data as T, meta: data.meta };
}
