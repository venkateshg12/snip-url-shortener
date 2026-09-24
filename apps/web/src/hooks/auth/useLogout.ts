import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { logout } from "@/api/auth";
import { useAuthStore } from "@/store/auth.store";

export function useLogout() {
    const queryClient = useQueryClient();
    const router = useRouter();
    return useMutation({
        mutationFn: logout,
        // Log out locally even if the request fails: the user asked to leave
        onSettled: () => {
            useAuthStore.getState().setGuest("logout"); // ProtectedRoute won't redirect to /login for this
            queryClient.clear();
            router.replace("/");
        },
    });
}
