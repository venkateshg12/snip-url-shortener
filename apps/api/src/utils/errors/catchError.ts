import type { NextFunction, Request, Response } from "express";

type AsyncController = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

// Express 5 already forwards rejected promises; this keeps parity with the Mongo backend and makes
// the intent explicit in every controller.
export const catchError =
    (controller: AsyncController): AsyncController =>
    async (req, res, next) => {
        try {
            await controller(req, res, next);
        } catch (error) {
            next(error);
        }
    };
