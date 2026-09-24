export const QUEUE_NAMES = { CLICKS: "clicks", MAINTENANCE: "maintenance" } as const;
export const JOB_NAMES = { CLICK_BATCH: "click-batch", PURGE: "purge" } as const;

export const CLICK_FLUSH_INTERVAL_MS = 1_000;
export const CLICK_FLUSH_SIZE = 500;
/** Beyond this the recorder drops clicks (counted) instead of growing without bound. */
export const CLICK_MAX_BUFFER = 10_000;

export const PURGE_EVERY_MS = 60 * 60 * 1000;
export const CLICK_RETENTION_DAYS = 180;
