"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { safeNext } from "@/lib/safeNext";
import { useAuthStore } from "@/store/auth.store";

/** Login and register pages: someone already logged in goes on to where they were heading. */
export function PublicOnly({ children }: { children: React.ReactNode }) {
    const status = useAuthStore((s) => s.status);
    const router = useRouter();
    const next = safeNext(useSearchParams().get("next"));
    useEffect(() => {
        if (status === "authenticated") router.replace(next);
    }, [status, router, next]);
    return children;
}
