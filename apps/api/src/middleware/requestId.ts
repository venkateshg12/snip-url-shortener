import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

// Reuse the id nginx sets (phase 9) so one request has one id across hops; otherwise make one.
const SAFE_ID = /^[A-Za-z0-9._:-]{1,128}$/;

export const requestId: RequestHandler = (req, res, next) => {
    const incoming = req.get("x-request-id");
    req.id = incoming && SAFE_ID.test(incoming) ? incoming : randomUUID();
    res.set("X-Request-Id", String(req.id));
    next();
};
