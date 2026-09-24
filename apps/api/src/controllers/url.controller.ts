import { createUrlSchema, listUrlsQuerySchema, updateUrlSchema } from "@repo/types";
import { CREATED, NO_CONTENT, OK } from "../constants/http";
import { createShortUrl } from "../services/url.service";
import { deleteUrl, getUrl, listUrls, updateUrl } from "../services/urlManagement.service";
import { ok } from "../utils/api";
import { catchError } from "../utils/errors";

export const createUrlHandler = catchError(async (req, res) => {
    const input = createUrlSchema.parse(req.body);
    const dto = await createShortUrl(input, { userId: req.userId ?? null });
    res.status(CREATED).json(ok(dto));
});

export const listUrlsHandler = catchError(async (req, res) => {
    const { page, limit } = listUrlsQuerySchema.parse(req.query);
    const { urls, meta } = await listUrls(req.userId!, page, limit);
    res.status(OK).json(ok(urls, meta));
});

export const getUrlHandler = catchError(async (req, res) => {
    res.status(OK).json(ok(await getUrl(req.userId!, String(req.params.code))));
});

export const updateUrlHandler = catchError(async (req, res) => {
    const patch = updateUrlSchema.parse(req.body);
    res.status(OK).json(ok(await updateUrl(req.userId!, String(req.params.code), patch)));
});

export const deleteUrlHandler = catchError(async (req, res) => {
    await deleteUrl(req.userId!, String(req.params.code));
    res.status(NO_CONTENT).end();
});
