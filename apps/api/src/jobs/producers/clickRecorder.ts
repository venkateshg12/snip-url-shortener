import type { Request } from "express";
import { CLICK_FLUSH_INTERVAL_MS, CLICK_FLUSH_SIZE, CLICK_MAX_BUFFER } from "../../constants/queue";
import { hashVisitor } from "../../utils/analytics/visitor";
import { logger } from "../../utils/logger";
import { clicksDropped, clicksRecorded } from "../../utils/metrics/metrics";
import { uuidv7 } from "../../utils/uuidv7";
import type { ClickEvent } from "../interfaces";

type Options = {
    enqueue: (events: ClickEvent[]) => Promise<unknown>;
    flushSize?: number;
    maxBuffer?: number;
    intervalMs?: number;
};

const COUNTRY = /^[A-Z]{2}$/;

/**
 * Buffers clicks in memory and hands them to the queue in batches: one Redis write per ~1s or 500
 * clicks instead of one per redirect. record() is synchronous and does no I/O, so the redirect
 * never waits on analytics. The trade-off: a crash (not a graceful stop) loses ≤ ~1s of clicks.
 */
export class ClickRecorder {
    readonly stats = { recorded: 0, dropped: 0, batches: 0 };
    private buffer: ClickEvent[] = [];
    private timer: NodeJS.Timeout | null = null;
    private readonly flushSize: number;
    private readonly maxBuffer: number;
    private readonly intervalMs: number;

    constructor(private readonly options: Options) {
        this.flushSize = options.flushSize ?? CLICK_FLUSH_SIZE;
        this.maxBuffer = options.maxBuffer ?? CLICK_MAX_BUFFER;
        this.intervalMs = options.intervalMs ?? CLICK_FLUSH_INTERVAL_MS;
    }

    record(urlId: string, req: Request) {
        if (this.buffer.length >= this.maxBuffer) {
            this.stats.dropped++; // bounded memory: shed load rather than grow
            clicksDropped.inc();
            return;
        }
        const country = req.get("cf-ipcountry")?.toUpperCase(); // only when behind Cloudflare
        this.buffer.push({
            id: uuidv7(),
            urlId,
            ts: Date.now(),
            ua: req.get("user-agent") ?? "",
            referrer: req.get("referer") ?? null,
            country: country && COUNTRY.test(country) && country !== "XX" ? country : null,
            visitor: hashVisitor(req.ip ?? "unknown"),
        });
        this.stats.recorded++;
        clicksRecorded.inc();
        if (this.buffer.length >= this.flushSize) void this.flush();
    }

    async flush() {
        const batch = this.buffer.splice(0);
        if (batch.length === 0) return;
        try {
            await this.options.enqueue(batch);
            this.stats.batches++;
        } catch (error) {
            this.stats.dropped += batch.length; // queue unavailable: analytics degrade, redirects don't
            clicksDropped.inc(batch.length);
            logger.warn({ err: (error as Error).message, dropped: batch.length }, "click batch dropped");
        }
    }

    start() {
        this.timer ??= setInterval(() => void this.flush(), this.intervalMs).unref();
    }

    /** Graceful shutdown: stop the timer and flush what's left, so deploys lose nothing. */
    async stop() {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
        await this.flush();
    }
}
