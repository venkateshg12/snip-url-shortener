import type { Metadata } from "next";
import { Suspense } from "react";
import { LinksList } from "@/components/urls/LinksList";
import { ShortenForm } from "@/components/urls/ShortenForm";

export const metadata: Metadata = { title: "Your links" };

/** Primary action (create) → the list → per-row actions. */
export default function DashboardPage() {
    return (
        <div className="grid grid-cols-1 gap-10">
            <div>
                <h1 className="text-heading-sm md:text-heading">Your links</h1>
                <p className="mt-1 text-muted-foreground">Create, share and manage your short links.</p>
            </div>
            <ShortenForm variant="compact" />
            <section aria-label="Links">
                {/* the page number lives in the URL (useSearchParams needs a Suspense boundary) */}
                <Suspense>
                    <LinksList />
                </Suspense>
            </section>
        </div>
    );
}
