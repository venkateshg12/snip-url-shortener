/** One recorded redirect, as captured on the hot path. Parsing happens in the worker. */
export type ClickEvent = {
    id: string; // UUIDv7: the idempotency key and the row's primary key
    urlId: string;
    ts: number;
    ua: string;
    referrer: string | null;
    country: string | null;
    visitor: string;
};

export type ClickBatchPayload = { events: ClickEvent[] };
