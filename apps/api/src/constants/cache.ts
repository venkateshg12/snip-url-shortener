/** `v1`: bump to change the value format without flushing everything. */
export const URL_KEY_PREFIX = "url:v1:";
export const NEGATIVE_VALUE = "__none__";

export const URL_TTL_SECONDS = 24 * 60 * 60;
export const URL_TTL_JITTER = 0.1; // ±10%, so entries loaded together don't expire together
export const NEGATIVE_TTL_SECONDS = 60; // short: the code might be created a minute later

export const BREAKER = { failureThreshold: 5, windowMs: 10_000, openMs: 30_000 } as const;

/** The second DEL of the delayed double delete (see invalidateUrl). */
export const DOUBLE_DELETE_DELAY_MS = 2_000;
