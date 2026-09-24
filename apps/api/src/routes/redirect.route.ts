import { Router } from "express";
import { missLimiter, redirectLimiter } from "../config/rateLimiter";
import { redirectErrorHandler, redirectHandler, redirectHome } from "../controllers/redirect.controller";

// Mounted LAST: `GET /:code` would otherwise swallow /api and /health.
export const redirectRouter = Router();

redirectRouter.get("/", redirectHome); // the bare short domain → the website
// In-memory limiters only: a Redis limiter here would double the hot path's network round trips
redirectRouter.get("/:code", missLimiter.guard, redirectLimiter, redirectHandler);
redirectRouter.use(redirectErrorHandler);
