import type { PaginationMeta } from "@repo/types";
import { Button } from "@repo/ui/components/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatCount } from "@/lib/format";

export function Pagination({
    meta,
    onPageChange,
}: {
    meta: PaginationMeta;
    onPageChange: (page: number) => void;
}) {
    if (meta.total <= meta.limit) return null;
    const from = (meta.page - 1) * meta.limit + 1;
    const to = Math.min(meta.page * meta.limit, meta.total);
    return (
        <nav aria-label="Pagination" className="flex items-center justify-between gap-4 pt-4">
            <p className="text-[15px] text-muted-foreground tabular-nums">
                {formatCount(from)}–{formatCount(to)} of {formatCount(meta.total)}
            </p>
            <div className="flex gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    disabled={meta.page <= 1}
                    onClick={() => onPageChange(meta.page - 1)}
                >
                    <ChevronLeft /> Previous
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={!meta.hasMore}
                    onClick={() => onPageChange(meta.page + 1)}
                >
                    Next <ChevronRight />
                </Button>
            </div>
        </nav>
    );
}
