import type { UrlStatsDto } from "@repo/types";
import { API, unwrap } from "@/lib/api";

export const getUrlStats = async (code: string, days: number, tz: string) =>
    (await unwrap<UrlStatsDto>(API.get(`/urls/${encodeURIComponent(code)}/stats`, { params: { days, tz } })))
        .data;
