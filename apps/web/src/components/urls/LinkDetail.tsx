"use client";

import { Button } from "@repo/ui/components/button";
import { ErrorState } from "@repo/ui/components/error-state";
import { Skeleton } from "@repo/ui/components/skeleton";
import { ArrowLeft, ExternalLink, QrCode } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { StatsPanel } from "@/components/stats/StatsPanel";
import { useUrl } from "@/hooks/urls/useUrl";
import { displayUrl, formatDate, formatDateTime } from "@/lib/format";
import { CopyButton } from "./CopyButton";
import { LinkActions } from "./LinkActions";
import { QrCodeDialog } from "./QrCodeDialog";
import { StatusBadge } from "./StatusBadge";

/** Hierarchy: the link itself + copy → how it's performing → where clicks come from → manage. */
export function LinkDetail() {
    const code = decodeURIComponent(String(useParams<{ code: string }>().code));
    const { data: link, isPending, isError, error, refetch, isRefetching } = useUrl(code);
    const [qrOpen, setQrOpen] = useState(false);
    const heading = useRef<HTMLHeadingElement>(null);

    useEffect(() => {
        if (link) document.title = `${displayUrl(link.shortUrl)} · snip`;
    }, [link]);
    // A route change lands focus on the page's heading (screen readers announce the new page)
    const focused = useRef(false);
    useEffect(() => {
        if (link && !focused.current) {
            heading.current?.focus();
            focused.current = true;
        }
    }, [link]);

    return (
        <div className="grid grid-cols-1 gap-10">
            <Link
                href="/dashboard"
                className="inline-flex min-h-11 w-fit items-center gap-2 text-[15px] text-muted-foreground hover:text-foreground"
            >
                <ArrowLeft className="size-4" aria-hidden="true" /> Links
            </Link>
            {isPending ? (
                <div role="status" aria-label="Loading link" className="grid gap-3">
                    <Skeleton className="h-10 w-72" />
                    <Skeleton className="h-5 w-96 max-w-full" />
                </div>
            ) : isError ? (
                <ErrorState
                    title={error.status === 404 ? "Link not found" : "Couldn't load this link"}
                    message={
                        error.status === 404
                            ? "It may have been deleted, or it belongs to another account."
                            : error.message
                    }
                    onRetry={error.status === 404 ? undefined : () => void refetch()}
                    retrying={isRefetching}
                />
            ) : (
                <>
                    <header className="grid grid-cols-1 gap-4">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="min-w-0">
                                <h1
                                    ref={heading}
                                    tabIndex={-1}
                                    className="font-sans text-heading-sm font-480 break-all outline-none md:text-heading"
                                >
                                    {displayUrl(link.shortUrl)}
                                </h1>
                                <a
                                    href={link.longUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex min-h-11 max-w-full items-center gap-1.5 text-muted-foreground hover:text-foreground"
                                >
                                    <span className="truncate">{displayUrl(link.longUrl)}</span>
                                    <ExternalLink className="size-4 shrink-0" aria-hidden="true" />
                                    <span className="sr-only">(opens in a new tab)</span>
                                </a>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[15px] text-muted-foreground">
                            <StatusBadge url={link} />
                            <span>Created {formatDate(link.createdAt)}</span>
                            <span>
                                {link.expiresAt
                                    ? `Expires ${formatDateTime(link.expiresAt)}`
                                    : "Never expires"}
                            </span>
                        </div>
                        <div className="flex flex-col gap-2 xs:flex-row">
                            <CopyButton
                                text={link.shortUrl}
                                label={`Copy ${displayUrl(link.shortUrl)}`}
                                variant="default"
                                size="default"
                            />
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    className="flex-1 xs:flex-none"
                                    onClick={() => setQrOpen(true)}
                                >
                                    <QrCode /> QR code
                                </Button>
                                <LinkActions link={link} showAnalytics={false} afterDelete="/dashboard" />
                            </div>
                        </div>
                        <QrCodeDialog shortUrl={link.shortUrl} open={qrOpen} onOpenChange={setQrOpen} />
                    </header>
                    <StatsPanel link={link} />
                </>
            )}
        </div>
    );
}
