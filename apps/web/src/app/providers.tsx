"use client";

import { TooltipProvider } from "@repo/ui/components/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { AuthLoader } from "@/components/auth/AuthLoader";
import { Toaster } from "@/components/layout/Toaster";
import { makeQueryClient } from "@/lib/queryClient";
import { useRecentLinks } from "@/store/recentLinks.store";

// Dev-only, and loaded lazily so it never ships in the production bundle
const Devtools =
    process.env.NODE_ENV === "development"
        ? dynamic(() => import("@tanstack/react-query-devtools").then((m) => m.ReactQueryDevtools), {
              ssr: false,
          })
        : () => null;

export function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(makeQueryClient); // per browser tab, never shared across requests
    useEffect(() => {
        void useRecentLinks.persist.rehydrate(); // localStorage only exists in the browser
    }, []);
    return (
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <QueryClientProvider client={queryClient}>
                <TooltipProvider>
                    <AuthLoader>{children}</AuthLoader>
                    <Toaster />
                </TooltipProvider>
                <Devtools initialIsOpen={false} />
            </QueryClientProvider>
        </ThemeProvider>
    );
}
