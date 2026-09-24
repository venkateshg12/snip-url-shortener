import type * as React from "react";
import { cn } from "../lib/utils";

/** Shape it like the content it replaces, so nothing shifts when data arrives. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div aria-hidden="true" className={cn("animate-pulse rounded-sm bg-muted", className)} {...props} />
    );
}

export { Skeleton };
