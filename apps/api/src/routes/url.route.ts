import { Router } from "express";
import { createLimiter } from "../config/rateLimiter";
import {
    createUrlHandler,
    deleteUrlHandler,
    getUrlHandler,
    listUrlsHandler,
    updateUrlHandler,
} from "../controllers/url.controller";
import { urlStatsHandler } from "../controllers/stats.controller";
import { authenticate, optionalAuth } from "../middleware/authenticate";

export const urlRouter = Router();

// optionalAuth first, so the limiter's key and limit can depend on who's asking
urlRouter.post("/", optionalAuth, createLimiter, createUrlHandler);
urlRouter.get("/", authenticate, listUrlsHandler);
urlRouter.get("/:code", authenticate, getUrlHandler);
urlRouter.get("/:code/stats", authenticate, urlStatsHandler);
urlRouter.patch("/:code", authenticate, updateUrlHandler);
urlRouter.delete("/:code", authenticate, deleteUrlHandler);
