import { statsQuerySchema } from "@repo/types";
import { OK } from "../constants/http";
import { getUrlStats } from "../services/stats.service";
import { ok } from "../utils/api";
import { catchError } from "../utils/errors";

export const urlStatsHandler = catchError(async (req, res) => {
    const { days, tz } = statsQuerySchema.parse(req.query);
    res.status(OK).json(ok(await getUrlStats(req.userId!, String(req.params.code), days, tz)));
});
