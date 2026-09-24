"use client";

import type { UrlDto } from "@repo/types";
import { Button } from "@repo/ui/components/button";
import { BarChart3, QrCode } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { displayUrl } from "@/lib/format";
import { CopyButton } from "./CopyButton";
import { QrCodeDialog } from "./QrCodeDialog";

/** Right after creating: the link, big, with Copy focused, because copying is the next thing people do. */
export function ShortLinkResult({ link, showAnalytics }: { link: UrlDto; showAnalytics: boolean }) {
    const [qrOpen, setQrOpen] = useState(false);
    const short = displayUrl(link.shortUrl);
    return (
        <section
            aria-labelledby="result-title"
            className="rounded-card-sm border bg-background p-5 text-left animate-in fade-in-0 slide-in-from-bottom-2 duration-200 ease-out-soft md:p-6"
        >
            <h2 id="result-title" className="font-sans text-sm text-muted-foreground" aria-live="polite">
                Your link is ready
            </h2>
            <p className="mt-1 -mx-1 w-fit animate-highlight rounded-sm px-1 text-body-lg font-480 break-all">
                {short}
            </p>
            <p className="mt-1 truncate text-[15px] text-muted-foreground" title={link.longUrl}>
                → {displayUrl(link.longUrl)}
            </p>
            <div className="mt-4 flex flex-col gap-2 xs:flex-row">
                <CopyButton text={link.shortUrl} label={`Copy ${short}`} variant="default" autoFocus />
                <Button variant="outline" size="sm" onClick={() => setQrOpen(true)}>
                    <QrCode /> QR code
                </Button>
                {showAnalytics && (
                    <Button asChild variant="ghost" size="sm">
                        <Link href={`/dashboard/links/${encodeURIComponent(link.shortCode)}`}>
                            <BarChart3 /> View analytics
                        </Link>
                    </Button>
                )}
            </div>
            <QrCodeDialog shortUrl={link.shortUrl} open={qrOpen} onOpenChange={setQrOpen} />
        </section>
    );
}
