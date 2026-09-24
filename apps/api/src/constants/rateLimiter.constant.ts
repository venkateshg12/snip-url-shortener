export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;

export const RATE_LIMIT_PREFIXES = {
    create: "create",
    login: "login",
    register: "register",
    api: "api",
    redirect: "redirect",
    miss: "miss",
} as const;

// The same names as the Mongo backend's HTTP_HEADERS
export const HTTP_HEADERS = {
    RATELIMIT_LIMIT: "X-RateLimit-Limit",
    RATELIMIT_REMAINING: "X-RateLimit-Remaining",
    RATELIMIT_RESET: "X-RateLimit-Reset",
    RETRY_AFTER: "Retry-After",
} as const;
