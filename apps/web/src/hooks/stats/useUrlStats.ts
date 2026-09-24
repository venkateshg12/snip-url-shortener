import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getUrlStats } from "@/api/stats";
import { queryKeys } from "@/lib/queryKeys";

const viewerTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Days are bucketed in the viewer's time zone. The old range stays visible while a new one loads. */
export function useUrlStats(code: string, days: number) {
    const tz = viewerTimeZone();
    return useQuery({
        queryKey: queryKeys.urls.stats(code, days, tz),
        queryFn: () => getUrlStats(code, days, tz),
        staleTime: 60_000,
        placeholderData: keepPreviousData,
    });
}
