import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { LoginInput } from "@repo/types";
import { useRouter, useSearchParams } from "next/navigation";
import { login } from "@/api/auth";
import type { ApiError } from "@/lib/errors";
import { queryKeys } from "@/lib/queryKeys";
import { safeNext } from "@/lib/safeNext";
import { useAuthStore } from "@/store/auth.store";

export function useLogin() {
    const queryClient = useQueryClient();
    const router = useRouter();
    const next = safeNext(useSearchParams().get("next"));
    return useMutation<Awaited<ReturnType<typeof login>>, ApiError, LoginInput>({
        mutationFn: login,
        onSuccess: (user) => {
            useAuthStore.getState().setUser(user);
            queryClient.setQueryData(queryKeys.me, user);
            router.replace(next);
        },
    });
}
