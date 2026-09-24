import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { apiLimiter } from "./config/rateLimiter";
import { CORS_ORIGINS, TRUST_PROXY } from "./constants/env";
import { errorHandler } from "./middleware/errorHandler";
import { notFound } from "./middleware/notFound";
import { metricsMiddleware } from "./middleware/metrics";
import { requestId } from "./middleware/requestId";
import { adminRouter } from "./routes/admin.route";
import { authRouter } from "./routes/auth.route";
import { healthRouter } from "./routes/health.route";
import { redirectRouter } from "./routes/redirect.route";
import { urlRouter } from "./routes/url.route";
import { logger } from "./utils/logger";

/** Builds the Express app without listening, so tests can use it directly. */
export function createApp() {
    const app = express();
    app.disable("x-powered-by");
    app.set("trust proxy", TRUST_PROXY);
    app.use(requestId);
    app.use(metricsMiddleware);
    app.use(
        pinoHttp({
            logger,
            genReqId: (req) => req.id,
            autoLogging: { ignore: (req) => req.url?.startsWith("/health") ?? false },
        }),
    );
    app.use(healthRouter); // /health/*: before everything else

    // Only the JSON API pays for body parsing, CORS and cookies; the redirect route never does.
    const api = express.Router();
    api.use(
        apiLimiter, // first: a flood is rejected before any parsing
        helmet(),
        cors({ origin: CORS_ORIGINS, credentials: true }),
        express.json({ limit: "10kb" }),
        cookieParser(),
    );
    api.use("/auth", authRouter);
    api.use("/urls", urlRouter);
    app.use("/api", api);

    const admin = adminRouter(); // dev-only Bull Board
    if (admin) app.use(admin.path, admin.guard, admin.router);

    app.use(redirectRouter); // GET /:code, mounted LAST
    app.use(notFound);
    app.use(errorHandler);
    return app;
}
