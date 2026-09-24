import { Router } from "express";
import { loginLimiter, registerLimiter } from "../config/rateLimiter";
import {
    loginHandler,
    logoutHandler,
    meHandler,
    refreshHandler,
    registerHandler,
} from "../controllers/auth.controller";
import { authenticate, tryAuth } from "../middleware/authenticate";

export const authRouter = Router();

authRouter.post("/register", registerLimiter, registerHandler);
authRouter.post("/login", loginLimiter, loginHandler);
authRouter.get("/refresh", refreshHandler);
// Logout must work with an expired access token too, so it never rejects
authRouter.post("/logout", tryAuth, logoutHandler);
authRouter.get("/me", authenticate, meHandler);
