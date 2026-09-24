"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuthStore } from "@/store/auth.store";

/** Guests go to /login?next=<here>; while the session is unknown, render the fallback (a skeleton). */
export function ProtectedRoute({
    children,
    fallback,
}: {
    children: React.ReactNode;
    fallback: React.ReactNode;
}) {
    const status = useAuthStore((s) => s.status);
    const guestReason = useAuthStore((s) => s.guestReason);
    const router = useRouter();
    const pathname = usePathname();
    useEffect(() => {
        // After a deliberate logout, useLogout is already taking the user home
        if (status === "guest" && guestReason !== "logout")
            router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }, [status, guestReason, router, pathname]);
    return status === "authenticated" ? children : fallback;
}
