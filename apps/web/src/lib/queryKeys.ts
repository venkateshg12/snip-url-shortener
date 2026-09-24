/** Key factories, so invalidation can't typo. */
export const queryKeys = {
    me: ["me"] as const,
    urls: {
        all: ["urls"] as const,
        lists: ["urls", "list"] as const,
        list: (page: number, limit: number) => ["urls", "list", { page, limit }] as const,
        detail: (code: string) => ["urls", "detail", code] as const,
        stats: (code: string, days: number, tz: string) => ["urls", "stats", code, { days, tz }] as const,
    },
};
