import pino from "pino";
import { LOG_LEVEL, NODE_ENV } from "../constants/env";

export const logger = pino({
    level: NODE_ENV === "test" ? "silent" : LOG_LEVEL,
    base: { service: "api" },
    // Never log credentials: auth cookies arrive in phase 6
    redact: {
        paths: ["req.headers.cookie", "req.headers.authorization", 'res.headers["set-cookie"]'],
        censor: "[redacted]",
    },
});
