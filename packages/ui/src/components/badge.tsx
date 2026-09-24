import { cva, type VariantProps } from "class-variance-authority";
import { Clock } from "lucide-react";
import type * as React from "react";
import { cn } from "../lib/utils";

const badgeVariants = cva(
    "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-sm whitespace-nowrap",
    {
        variants: {
            variant: {
                active: "bg-muted text-foreground",
                paused: "border border-border text-muted-foreground",
                expired: "border border-border text-muted-foreground",
                neutral: "bg-muted text-muted-foreground",
                highlight: "bg-highlight text-highlight-foreground",
            },
        },
        defaultVariants: { variant: "neutral" },
    },
);

/** Status is never colour alone: each state has its own word AND its own shape. */
function StatusMark({ variant }: { variant: VariantProps<typeof badgeVariants>["variant"] }) {
    if (variant === "active")
        return <span className="size-2 rounded-full bg-foreground" aria-hidden="true" />;
    if (variant === "paused")
        return <span className="size-2 rounded-full border-[1.5px] border-current" aria-hidden="true" />;
    if (variant === "expired") return <Clock className="size-3.5" aria-hidden="true" />;
    return null;
}

function Badge({
    className,
    variant,
    children,
    ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
    return (
        <span className={cn(badgeVariants({ variant }), className)} {...props}>
            <StatusMark variant={variant} />
            {children}
        </span>
    );
}

export { Badge, badgeVariants };
