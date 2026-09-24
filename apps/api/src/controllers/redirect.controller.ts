import type { NextFunction, Request, Response } from "express";
import { missLimiter } from "../config/rateLimiter";
import { WEB_URL } from "../constants/env";
import { clickRecorder } from "../jobs/producers";
import { SERVICE_UNAVAILABLE } from "../constants/http";
import { resolveShortCode } from "../services/redirect.service";
import { catchError } from "../utils/errors";
import { logger } from "../utils/logger";
import { isValidShortCode } from "../utils/shortCode";

export const redirectHome = (_req: Request, res: Response) => res.redirect(302, WEB_URL);

export const redirectHandler = catchError(async (req, res) => {
    const code = String(req.params.code);
    if (!isValidShortCode(code)) {
        void missLimiter.record(req);
        return res.redirect(302, `${WEB_URL}/not-found`); // no DB work for junk
    }

    const result = await resolveShortCode(code);
    switch (result.kind) {
        case "not_found":
            void missLimiter.record(req); // enumeration produces misses; real visitors almost never do
            return res.redirect(302, `${WEB_URL}/not-found`);
        case "expired":
            return res.redirect(302, `${WEB_URL}/expired`);
        case "found":
            clickRecorder.record(result.urlId, req); // synchronous, in memory: the redirect never waits on analytics
            // 302 + no-store: every click reaches us (counted), and disabling a link works at once
            res.set("Cache-Control", "no-store");
            return res.redirect(302, result.longUrl);
    }
});

/** Someone clicked a link: answer with a page, not the API's JSON envelope. */
export function redirectErrorHandler(error: unknown, req: Request, res: Response, _next: NextFunction) {
    logger.error({ err: error, reqId: req.id }, "redirect failed");
    res.status(SERVICE_UNAVAILABLE)
        .set("Retry-After", "5")
        .type("html")
        .send(
            '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
                "<title>Temporarily unavailable</title>" +
                '<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1rem;line-height:1.5">' +
                "<h1>Temporarily unavailable</h1><p>This link couldn't be opened just now. Try again in a few seconds.</p></body></html>",
        );
}
