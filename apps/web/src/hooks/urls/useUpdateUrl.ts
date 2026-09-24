import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UpdateUrlInput, UrlDto } from "@repo/types";
import { toast } from "sonner";
import { updateUrl } from "@/api/urls";
import type { ApiError } from "@/lib/errors";
import { queryKeys } from "@/lib/queryKeys";

export function useUpdateUrl() {
    const queryClient = useQueryClient();
    return useMutation<UrlDto, ApiError, { code: string; patch: UpdateUrlInput }>({
        mutationFn: ({ code, patch }) => updateUrl(code, patch),
        onSuccess: (dto) => {
            queryClient.setQueryData(queryKeys.urls.detail(dto.shortCode), dto);
            void queryClient.invalidateQueries({ queryKey: queryKeys.urls.lists });
        },
        onError: (error) => toast.error(error.message),
    });
}
