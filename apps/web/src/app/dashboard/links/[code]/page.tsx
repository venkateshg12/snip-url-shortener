import type { Metadata } from "next";
import { Suspense } from "react";
import { LinkDetail } from "@/components/urls/LinkDetail";

export const metadata: Metadata = { title: "Link analytics" };

// Data is client-fetched (the session cookie belongs to the API), so the page is a thin server shell
export default function LinkPage() {
    return (
        <Suspense>
            <LinkDetail />
        </Suspense>
    );
}
