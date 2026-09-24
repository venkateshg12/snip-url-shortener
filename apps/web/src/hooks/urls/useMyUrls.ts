import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { listMyUrls } from "@/api/urls";
import { queryKeys } from "@/lib/queryKeys";

/** Keeps the previous page on screen (dimmed) while the next one loads: no blank table. */
export const useMyUrls = (page: number, limit = 20) =>
    useQuery({
        queryKey: queryKeys.urls.list(page, limit),
        queryFn: () => listMyUrls(page, limit),
        placeholderData: keepPreviousData,
    });
