import type { StatsBucket } from "@repo/types";
import { formatCount } from "@/lib/format";

type BreakdownListProps = {
    title: string;
    buckets: StatsBucket[];
    total: number;
    /** How to name `null` (e.g. "Direct" for referrers). */
    nullLabel: string;
    formatKey?: (key: string) => string;
    emptyMessage?: string;
};

/** A ranked bar list: the label and number carry the meaning, the bar only shows the share. */
export function BreakdownList({
    title,
    buckets,
    total,
    nullLabel,
    formatKey = (k) => k,
    emptyMessage = "No data for this range.",
}: BreakdownListProps) {
    // aria-labelledby splits on spaces, so the id must not contain any
    const titleId = `breakdown-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    return (
        <section className="rounded-card-sm border p-5" aria-labelledby={titleId}>
            <h3 id={titleId} className="font-sans text-[15px] font-480">
                {title}
            </h3>
            {buckets.length === 0 ? (
                <p className="mt-3 text-[15px] text-muted-foreground">{emptyMessage}</p>
            ) : (
                <ol className="mt-3 grid gap-1">
                    {buckets.map((bucket) => {
                        const share = total > 0 ? bucket.count / total : 0;
                        return (
                            <li
                                key={bucket.key ?? "__null"}
                                className="relative flex items-center justify-between gap-3 overflow-hidden rounded-sm px-3 py-2"
                            >
                                <span
                                    className="absolute inset-y-0 left-0 bg-chart-1/15"
                                    style={{ width: `${Math.max(share * 100, 1)}%` }}
                                    aria-hidden="true"
                                />
                                <span className="relative truncate text-[15px]">
                                    {bucket.key === null ? nullLabel : formatKey(bucket.key)}
                                </span>
                                <span className="relative shrink-0 text-[15px] tabular-nums text-muted-foreground">
                                    {formatCount(bucket.count)}{" "}
                                    <span className="text-subtle-foreground">
                                        · {Math.round(share * 100)}%
                                    </span>
                                </span>
                            </li>
                        );
                    })}
                </ol>
            )}
        </section>
    );
}
