import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateUrlInput, UrlDto } from "@repo/types";
import { createShortUrl } from "@/api/urls";
import type { ApiError } from "@/lib/errors";
import { queryKeys } from "@/lib/queryKeys";
import { useAuthStore } from "@/store/auth.store";
import { useRecentLinks } from "@/store/recentLinks.store";

export function useCreateShortUrl() {
    const queryClient = useQueryClient();
    return useMutation<UrlDto, ApiError, CreateUrlInput>({
        mutationFn: createShortUrl,
        onSuccess: (dto) => {
            if (useAuthStore.getState().status === "authenticated") {
                void queryClient.invalidateQueries({ queryKey: queryKeys.urls.lists });
            } else {
                useRecentLinks.getState().add(dto);
            }
        },
    });
}
