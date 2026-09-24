import type * as React from "react";
import { focusRing } from "../lib/focus";
import { cn } from "../lib/utils";

// 16px text: iOS zooms the page when focusing anything smaller.
export const inputClasses = cn(
    "h-11 w-full min-w-0 rounded-input border border-input bg-background px-4 text-base text-foreground",
    "transition-colors duration-150 ease-out-soft hover:border-foreground/30",
    "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
    "aria-invalid:border-destructive",
    focusRing,
);

function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
    return <input type={type} data-slot="input" className={cn(inputClasses, className)} {...props} />;
}

/** An input with a fixed segment in front of it, e.g. the `snip.to/` before an alias. */
function PrefixedInput({ prefix, className, ...props }: React.ComponentProps<"input"> & { prefix: string }) {
    return (
        <div
            className={cn(
                "flex h-11 w-full items-center rounded-input border border-input bg-background text-base",
                "transition-colors duration-150 hover:border-foreground/30 has-aria-invalid:border-destructive",
                "has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-ring",
                className,
            )}
        >
            <span className="pl-4 text-muted-foreground select-none" aria-hidden="true">
                {prefix}
            </span>
            <input
                className="h-full min-w-0 flex-1 bg-transparent pr-4 text-foreground outline-none"
                {...props}
            />
        </div>
    );
}

export { Input, PrefixedInput };
