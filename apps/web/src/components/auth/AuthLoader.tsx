"use client";

import { useEffect } from "react";
import { useMe } from "@/hooks/auth/useMe";
import { useAuthStore } from "@/store/auth.store";

/** Runs /auth/me once and turns the answer into the session state everything else reads. */
export function AuthLoader({ children }: { children: React.ReactNode }) {
    const { data, isError, isSuccess } = useMe();
    useEffect(() => {
        if (isSuccess && data) useAuthStore.getState().setUser(data);
        else if (isError) useAuthStore.getState().setGuest();
    }, [data, isError, isSuccess]);
    return children;
}
