import type { RequestHandler } from "express";
import { httpDuration } from "../utils/metrics/metrics";

/** Times every request; labels with the matched route template ("/api/urls/:code"), not the URL. */
export const metricsMiddleware: RequestHandler = (req, res, next) => {
    const end = httpDuration.startTimer();
    res.on("finish", () => {
        const route = req.route?.path ? `${req.baseUrl}${String(req.route.path)}` : "unmatched";
        end({ method: req.method, route, status_class: `${Math.floor(res.statusCode / 100)}xx` });
    });
    next();
};
