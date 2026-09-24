const inflight = new Map<string, Promise<unknown>>();

/**
 * Concurrent callers for the same key share one load. With N instances that's at most N loads per
 * key; a distributed lock would make it 1, at the cost of a Redis round trip on every miss.
 */
export function singleFlight<T>(key: string, load: () => Promise<T>): Promise<T> {
    const existing = inflight.get(key) as Promise<T> | undefined;
    if (existing) return existing;
    const promise = load().finally(() => inflight.delete(key));
    inflight.set(key, promise);
    return promise;
}
