import type { UrlDto } from "@repo/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getUrl } from "@/api/urls";
import { queryKeys } from "@/lib/queryKeys";

/** Starts from the row already in a cached list page, so the header renders instantly. */
export function useUrl(code: string) {
    const queryClient = useQueryClient();
    return useQuery({
        queryKey: queryKeys.urls.detail(code),
        queryFn: () => getUrl(code),
        placeholderData: () =>
            queryClient
                .getQueriesData<{ urls: UrlDto[] }>({ queryKey: queryKeys.urls.lists })
                .flatMap(([, page]) => page?.urls ?? [])
                .find((url) => url.shortCode === code),
    });
}
