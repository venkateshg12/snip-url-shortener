import type { Request, Response } from "express";
import { AppErrorCode } from "../constants/appErrorCode";
import { NOT_FOUND } from "../constants/http";
import { fail } from "../utils/api";

export function notFound(req: Request, res: Response) {
    res.status(NOT_FOUND).json(
        fail(`Route not Found: ${req.method} ${req.originalUrl}`, AppErrorCode.RouteNotFound),
    );
}
