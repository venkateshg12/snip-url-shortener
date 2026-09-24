"use client";

import { STATS_DAY_OPTIONS, type UrlDto, type UrlStatsDto } from "@repo/types";
import { Button } from "@repo/ui/components/button";
import { EmptyState } from "@repo/ui/components/empty-state";
import { ErrorState } from "@repo/ui/components/error-state";
import { SegmentedControl } from "@repo/ui/components/segmented-control";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import { BarChart3 } from "lucide-react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { CopyButton } from "@/components/urls/CopyButton";
import { useUrlStats } from "@/hooks/stats/useUrlStats";
import { displayUrl, formatCount } from "@/lib/format";
import { BreakdownList } from "./BreakdownList";

// Recharts is heavy and only needed here: load it on demand
const ClicksChart = dynamic(() => import("./ClicksChart"), {
    ssr: false,
    loading: () => <Skeleton className="h-65 w-full rounded-card-sm" />,
});

const RANGE_OPTIONS = STATS_DAY_OPTIONS.map((d) => ({
    value: String(d) as `${typeof d}`,
    label: `${d} days`,
}));
const regionNames =
    typeof Intl.DisplayNames === "function" ? new Intl.DisplayNames(undefined, { type: "region" }) : null;
const countryName = (code: string) => regionNames?.of(code) ?? code;

function chartSummary(stats: UrlStatsDto) {
    const peak = stats.byDay.reduce((best, day) => (day.clicks > best.clicks ? day : best), stats.byDay[0]!);
    return `${formatCount(stats.totals.clicks)} clicks over ${stats.days} days${peak.clicks > 0 ? `, peak ${formatCount(peak.clicks)} on ${peak.date}` : ""}.`;
}

export function StatsPanel({ link }: { link: UrlDto }) {
    const params = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const requested = Number(params.get("days"));
    const days = (STATS_DAY_OPTIONS as readonly number[]).includes(requested) ? requested : 30;
    const {
        data: stats,
        isPending,
        isError,
        error,
        refetch,
        isRefetching,
        isPlaceholderData,
    } = useUrlStats(link.shortCode, days);
    const [asTable, setAsTable] = useState(false);

    const setDays = (value: string) => router.replace(`${pathname}?days=${value}`, { scroll: false });

    return (
        <section aria-labelledby="stats-title" className="grid grid-cols-1 gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="stats-title" className="font-sans text-heading-sm font-480">
                    Performance
                </h2>
                <SegmentedControl
                    label="Date range"
                    value={String(days)}
                    onValueChange={setDays}
                    options={RANGE_OPTIONS}
                />
            </div>

            {isPending ? (
                <StatsSkeleton />
            ) : isError ? (
                <ErrorState
                    title="Couldn't load analytics"
                    message={error.message}
                    onRetry={() => void refetch()}
                    retrying={isRefetching}
                />
            ) : stats.totals.clicks === 0 && days === 90 && !isPlaceholderData ? (
                <EmptyState
                    icon={<BarChart3 />}
                    title="No clicks yet"
                    description="Share your link to start seeing where visitors come from, what they use and when they click."
                    action={
                        <CopyButton
                            text={link.shortUrl}
                            label={`Copy ${displayUrl(link.shortUrl)}`}
                            variant="default"
                        />
                    }
                    className="rounded-card-sm border"
                />
            ) : (
                <div
                    aria-busy={isPlaceholderData || undefined}
                    className={cn(
                        "grid grid-cols-1 gap-6 transition-opacity duration-150",
                        isPlaceholderData && "opacity-60",
                    )}
                >
                    <dl className="grid grid-cols-1 gap-4 xs:grid-cols-2">
                        <Kpi label={`Clicks · ${days} days`} value={stats.totals.clicks} />
                        <Kpi
                            label={`Unique visitors · ${days} days`}
                            value={stats.totals.uniques}
                            hint="Counted per day"
                        />
                    </dl>

                    <div className="min-w-0 rounded-card-sm border p-4 md:p-5">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                            <div className="flex gap-4" aria-hidden="true">
                                <span className="inline-flex items-center gap-2">
                                    <span className="h-0.5 w-4 bg-chart-1" /> Clicks
                                </span>
                                <span className="inline-flex items-center gap-2">
                                    <span className="w-4 border-t-2 border-dashed border-chart-2" /> Unique
                                    visitors
                                </span>
                            </div>
                            <Button
                                variant="link"
                                size="sm"
                                onClick={() => setAsTable((v) => !v)}
                                aria-pressed={asTable}
                            >
                                {asTable ? "View as chart" : "View as table"}
                            </Button>
                        </div>
                        {asTable ? (
                            <DailyTable stats={stats} />
                        ) : (
                            <figure aria-label={chartSummary(stats)} role="img">
                                <ClicksChart byDay={stats.byDay} />
                            </figure>
                        )}
                        <p className="mt-2 text-sm text-subtle-foreground">
                            Days in {stats.tz.replaceAll("_", " ")} time
                        </p>
                        {stats.totals.clicks === 0 && (
                            <p className="mt-2 text-[15px] text-muted-foreground">
                                No clicks in the last {days} days. Try a longer range.
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <BreakdownList
                            title="Referrers"
                            buckets={stats.referrers}
                            total={stats.totals.clicks}
                            nullLabel="Direct or unknown"
                        />
                        <BreakdownList
                            title="Countries"
                            buckets={stats.countries.filter((b) => b.key !== null)}
                            total={stats.totals.clicks}
                            nullLabel="Unknown"
                            formatKey={countryName}
                            emptyMessage="Country data isn't available for this deployment."
                        />
                        <BreakdownList
                            title="Devices"
                            buckets={stats.devices}
                            total={stats.totals.clicks}
                            nullLabel="Unknown"
                            formatKey={(k) => k[0]!.toUpperCase() + k.slice(1)}
                        />
                        <BreakdownList
                            title="Browsers"
                            buckets={stats.browsers}
                            total={stats.totals.clicks}
                            nullLabel="Unknown"
                        />
                        <BreakdownList
                            title="Operating systems"
                            buckets={stats.os}
                            total={stats.totals.clicks}
                            nullLabel="Unknown"
                        />
                    </div>
                </div>
            )}
        </section>
    );
}

function Kpi({ label, value, hint }: { label: string; value: number; hint?: string }) {
    return (
        <div className="rounded-card-sm border p-5">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-heading-sm font-480 tabular-nums">{formatCount(value)}</dd>
            {hint && <dd className="mt-1 text-sm text-subtle-foreground">{hint}</dd>}
        </div>
    );
}

function DailyTable({ stats }: { stats: UrlStatsDto }) {
    return (
        <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-[15px]">
                <caption className="sr-only">Clicks and unique visitors per day</caption>
                <thead>
                    <tr className="text-left text-sm text-subtle-foreground">
                        <th className="py-2 font-normal">Day</th>
                        <th className="py-2 text-right font-normal">Clicks</th>
                        <th className="py-2 text-right font-normal">Unique visitors</th>
                    </tr>
                </thead>
                <tbody className="[&_tr]:border-t">
                    {[...stats.byDay].reverse().map((day) => (
                        <tr key={day.date}>
                            <td className="py-2">{day.date}</td>
                            <td className="py-2 text-right tabular-nums">{formatCount(day.clicks)}</td>
                            <td className="py-2 text-right tabular-nums">{formatCount(day.uniques)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function StatsSkeleton() {
    return (
        <div role="status" aria-label="Loading analytics" className="grid gap-6">
            <div className="grid grid-cols-1 gap-4 xs:grid-cols-2">
                <Skeleton className="h-24 rounded-card-sm" />
                <Skeleton className="h-24 rounded-card-sm" />
            </div>
            <Skeleton className="h-72 rounded-card-sm" />
            <div className="grid gap-4 md:grid-cols-2">
                <Skeleton className="h-48 rounded-card-sm" />
                <Skeleton className="h-48 rounded-card-sm" />
            </div>
        </div>
    );
}
