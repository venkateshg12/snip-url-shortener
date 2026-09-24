"use client";

import { Button } from "@repo/ui/components/button";
import { EmptyState } from "@repo/ui/components/empty-state";
import { ErrorState } from "@repo/ui/components/error-state";
import { Skeleton } from "@repo/ui/components/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui/components/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/components/tooltip";
import { cn } from "@repo/ui/lib/utils";
import { Link2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMyUrls } from "@/hooks/urls/useMyUrls";
import { displayUrl, formatCount, formatDate, formatRelative } from "@/lib/format";
import { CopyButton } from "./CopyButton";
import { LinkActions } from "./LinkActions";
import { Pagination } from "./Pagination";
import { URL_INPUT_ID } from "./ShortenForm";
import { StatusBadge } from "./StatusBadge";

const detailHref = (code: string) => `/dashboard/links/${encodeURIComponent(code)}`;

/** The user's links: a table from md, a card list below, with every state designed. */
export function LinksList() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const { data, isPending, isError, error, refetch, isRefetching, isPlaceholderData } = useMyUrls(page);

    const goTo = (next: number) =>
        router.push(next === 1 ? pathname : `${pathname}?page=${next}`, { scroll: false });

    if (isPending) return <LinksSkeleton />;
    if (isError)
        return (
            <ErrorState
                title="Couldn't load your links"
                message={error.message}
                onRetry={() => void refetch()}
                retrying={isRefetching}
            />
        );
    if (data.urls.length === 0 && page === 1) {
        return (
            <EmptyState
                icon={<Link2 />}
                title="No links yet"
                description="Create your first short link above. It'll appear here with its clicks, and you can change or switch it off any time."
                action={
                    <Button variant="outline" onClick={() => document.getElementById(URL_INPUT_ID)?.focus()}>
                        Create your first link
                    </Button>
                }
            />
        );
    }

    return (
        <div
            aria-busy={isPlaceholderData || undefined}
            className={cn("transition-opacity duration-150", isPlaceholderData && "opacity-60")}
        >
            {/* md and up: a real table */}
            <div className="hidden md:block">
                <Table>
                    <caption className="sr-only">Your links</caption>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead>Short link</TableHead>
                            <TableHead>Destination</TableHead>
                            <TableHead className="text-right">Clicks</TableHead>
                            <TableHead className="hidden lg:table-cell">Created</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>
                                <span className="sr-only">Actions</span>
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.urls.map((link) => (
                            <TableRow key={link.shortCode}>
                                <TableCell>
                                    <div className="flex items-center gap-1">
                                        <Link
                                            href={detailHref(link.shortCode)}
                                            className="inline-flex min-h-11 items-center font-480 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                                        >
                                            {displayUrl(link.shortUrl)}
                                        </Link>
                                        <CopyButton
                                            text={link.shortUrl}
                                            label={`Copy ${displayUrl(link.shortUrl)}`}
                                            iconOnly
                                            variant="ghost"
                                        />
                                    </div>
                                </TableCell>
                                <TableCell className="max-w-72">
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span
                                                className="block truncate text-muted-foreground"
                                                tabIndex={0}
                                            >
                                                {displayUrl(link.longUrl)}
                                            </span>
                                        </TooltipTrigger>
                                        <TooltipContent className="break-all">{link.longUrl}</TooltipContent>
                                    </Tooltip>
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {formatCount(link.clickCount)}
                                </TableCell>
                                <TableCell className="hidden text-muted-foreground lg:table-cell">
                                    <time dateTime={link.createdAt} title={formatDate(link.createdAt)}>
                                        {formatRelative(link.createdAt)}
                                    </time>
                                </TableCell>
                                <TableCell>
                                    <StatusBadge url={link} />
                                </TableCell>
                                <TableCell className="w-12 text-right">
                                    <LinkActions link={link} />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* Below md: cards, no sideways scrolling */}
            <ul className="divide-y md:hidden">
                {data.urls.map((link) => (
                    <li key={link.shortCode} className="py-4">
                        <div className="flex items-center justify-between gap-2">
                            <Link
                                href={detailHref(link.shortCode)}
                                className="flex min-h-11 min-w-0 items-center font-480"
                            >
                                <span className="truncate">{displayUrl(link.shortUrl)}</span>
                            </Link>
                            <div className="flex shrink-0 items-center">
                                <CopyButton
                                    text={link.shortUrl}
                                    label={`Copy ${displayUrl(link.shortUrl)}`}
                                    iconOnly
                                    size="icon"
                                    variant="ghost"
                                />
                                <LinkActions link={link} />
                            </div>
                        </div>
                        <p className="truncate text-[15px] text-muted-foreground">
                            {displayUrl(link.longUrl)}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                            <span className="tabular-nums">
                                {formatCount(link.clickCount)} {link.clickCount === 1 ? "click" : "clicks"}
                            </span>
                            <StatusBadge url={link} />
                            <time dateTime={link.createdAt}>{formatRelative(link.createdAt)}</time>
                        </div>
                    </li>
                ))}
            </ul>

            <Pagination meta={data.meta} onPageChange={goTo} />
        </div>
    );
}

function LinksSkeleton() {
    return (
        <div aria-label="Loading your links" role="status" className="grid gap-0 divide-y">
            {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="flex items-center gap-6 py-5">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="hidden h-4 flex-1 md:block" />
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-6 w-20 rounded-full" />
                </div>
            ))}
        </div>
    );
}
