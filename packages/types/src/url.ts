import { z } from "zod";

/** Shared by the API (validation) and the web form (zodResolver), so they never disagree. */
export const URL_MAX_LENGTH = 2048;
export const ALIAS_PATTERN = /^[A-Za-z0-9_-]{3,32}$/;
export const ALIAS_MAX_LENGTH = 32;

export const createUrlSchema = z.object({
    url: z
        .string()
        .trim()
        .min(1, "Enter a URL to shorten")
        .max(URL_MAX_LENGTH, `URLs can be at most ${URL_MAX_LENGTH} characters`)
        .pipe(z.httpUrl("Enter a full URL, like https://example.com")),
    customAlias: z.string().trim().regex(ALIAS_PATTERN, "Use 3–32 letters, numbers, - or _").optional(),
    expiresAt: z.coerce
        .date("Enter a valid date")
        .refine((date) => date.getTime() > Date.now(), "Pick a time in the future")
        .optional(),
});
export type CreateUrlInput = z.input<typeof createUrlSchema>;

export type UrlStatus = "active" | "disabled";

export type UrlDto = {
    shortCode: string;
    shortUrl: string;
    longUrl: string;
    isCustomAlias: boolean;
    status: UrlStatus;
    expiresAt: string | null;
    clickCount: number;
    createdAt: string;
};

/** PATCH /api/urls/:code: change the expiry (null removes it) or switch the link on/off. */
export const updateUrlSchema = z
    .object({
        expiresAt: z.coerce
            .date("Enter a valid date")
            .refine((date) => date.getTime() > Date.now(), "Pick a time in the future")
            .nullable()
            .optional(),
        status: z.enum(["active", "disabled"]).optional(),
    })
    .refine((patch) => patch.expiresAt !== undefined || patch.status !== undefined, "Nothing to update");
export type UpdateUrlInput = z.input<typeof updateUrlSchema>;

export const LIST_LIMIT_MAX = 100;
export const listUrlsQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(LIST_LIMIT_MAX).default(20),
});
