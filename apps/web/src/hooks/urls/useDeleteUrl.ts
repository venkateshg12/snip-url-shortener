import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { PaginationMeta, UrlDto } from "@repo/types";
import { toast } from "sonner";
import { deleteUrl } from "@/api/urls";
import type { ApiError } from "@/lib/errors";
import { queryKeys } from "@/lib/queryKeys";

type ListPage = { urls: UrlDto[]; meta: PaginationMeta };

/** Optimistic: the row disappears at once, and comes back (with a toast) if the request fails. */
export function useDeleteUrl() {
    const queryClient = useQueryClient();
    return useMutation<void, ApiError, string, { snapshot: [readonly unknown[], ListPage | undefined][] }>({
        mutationFn: deleteUrl,
        onMutate: async (code) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.urls.lists });
            const snapshot = queryClient.getQueriesData<ListPage>({ queryKey: queryKeys.urls.lists });
            queryClient.setQueriesData<ListPage>(
                { queryKey: queryKeys.urls.lists },
                (page) =>
                    page && {
                        urls: page.urls.filter((u) => u.shortCode !== code),
                        meta: { ...page.meta, total: page.meta.total - 1 },
                    },
            );
            return { snapshot };
        },
        onError: (error, _code, context) => {
            for (const [key, page] of context?.snapshot ?? []) queryClient.setQueryData(key, page);
            toast.error(`Couldn't delete the link. ${error.message}`);
        },
        onSuccess: () => toast.success("Link deleted"),
        onSettled: (_data, _error, code) => {
            queryClient.removeQueries({ queryKey: queryKeys.urls.detail(code) });
            void queryClient.invalidateQueries({ queryKey: queryKeys.urls.lists });
        },
    });
}
