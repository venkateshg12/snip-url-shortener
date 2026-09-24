"use client";

import { Skeleton } from "@repo/ui/components/skeleton";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppHeader } from "./AppHeader";

export function DashboardSkeleton() {
    return (
        <div role="status" aria-label="Loading" className="mx-auto grid max-w-page gap-6 px-4 py-8 md:px-8">
            <Skeleton className="h-10 w-56" />
            <Skeleton className="h-11 w-full rounded-input" />
            <Skeleton className="h-64 w-full rounded-card-sm" />
        </div>
    );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
    return (
        <ProtectedRoute fallback={<DashboardSkeleton />}>
            <AppHeader />
            <main id="main" className="mx-auto max-w-page px-4 py-6 md:px-8 md:py-10">
                {children}
            </main>
        </ProtectedRoute>
    );
}
