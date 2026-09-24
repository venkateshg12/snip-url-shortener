import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { RegisterInput } from "@repo/types";
import { useRouter, useSearchParams } from "next/navigation";
import { register } from "@/api/auth";
import type { ApiError } from "@/lib/errors";
import { queryKeys } from "@/lib/queryKeys";
import { safeNext } from "@/lib/safeNext";
import { useAuthStore } from "@/store/auth.store";

export function useRegister() {
    const queryClient = useQueryClient();
    const router = useRouter();
    const next = safeNext(useSearchParams().get("next"));
    return useMutation<Awaited<ReturnType<typeof register>>, ApiError, RegisterInput>({
        mutationFn: register,
        onSuccess: (user) => {
            useAuthStore.getState().setUser(user);
            queryClient.setQueryData(queryKeys.me, user);
            router.replace(next);
        },
    });
}
