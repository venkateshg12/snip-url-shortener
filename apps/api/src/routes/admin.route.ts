import { timingSafeEqual } from "node:crypto";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import type { RequestHandler, Router } from "express";
import { BULL_BOARD_PASSWORD, BULL_BOARD_USER, NODE_ENV } from "../constants/env";
import { clickQueue } from "../jobs/queues/click.queue";
import { maintenanceQueue } from "../jobs/queues/maintenance.queue";

const BASE_PATH = "/admin/queues";

const same = (a: string, b: string) =>
    a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

const basicAuth =
    (user: string, password: string): RequestHandler =>
    (req, res, next) => {
        const [scheme, encoded] = (req.get("authorization") ?? "").split(" ");
        const [u = "", p = ""] = Buffer.from(encoded ?? "", "base64")
            .toString()
            .split(":");
        if (scheme === "Basic" && same(u, user) && same(p, password)) return next();
        res.set("WWW-Authenticate", 'Basic realm="queues"').status(401).end();
    };

/** Bull Board: development only, behind basic auth, and only when both credentials are set. */
export function adminRouter(): { path: string; router: Router; guard: RequestHandler } | null {
    if (NODE_ENV === "production" || !BULL_BOARD_USER || !BULL_BOARD_PASSWORD) return null;
    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath(BASE_PATH);
    createBullBoard({
        queues: [new BullMQAdapter(clickQueue), new BullMQAdapter(maintenanceQueue)],
        serverAdapter,
    });
    return {
        path: BASE_PATH,
        router: serverAdapter.getRouter() as Router,
        guard: basicAuth(BULL_BOARD_USER, BULL_BOARD_PASSWORD),
    };
}
