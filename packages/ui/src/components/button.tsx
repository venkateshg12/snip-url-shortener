import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";
import { focusRing } from "../lib/focus";
import { cn } from "../lib/utils";
import { Spinner } from "./spinner";

// Pills always. Small sizes grow to 44px on touch screens (pointer-coarse).
const buttonVariants = cva(
    [
        "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full font-sans whitespace-nowrap select-none",
        "transition-[background-color,color,opacity] duration-150 ease-out-soft",
        "disabled:pointer-events-none disabled:opacity-50 aria-disabled:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
        focusRing,
    ],
    {
        variants: {
            variant: {
                default: "bg-primary text-primary-foreground hover:opacity-90",
                outline: "border border-foreground bg-transparent text-foreground hover:bg-accent",
                secondary: "bg-secondary text-secondary-foreground hover:bg-accent",
                ghost: "bg-transparent text-foreground hover:bg-accent",
                destructive: "bg-destructive text-destructive-foreground hover:opacity-90",
                link: "h-auto rounded-none px-0 text-foreground underline-offset-4 hover:underline",
            },
            size: {
                sm: "h-9 px-4 text-[15px] pointer-coarse:h-11 [&_svg:not([class*='size-'])]:size-4",
                default: "h-11 px-5 text-base",
                lg: "h-12 px-6 text-base",
                icon: "size-11",
                "icon-sm": "size-9 pointer-coarse:size-11 [&_svg:not([class*='size-'])]:size-4",
            },
        },
        compoundVariants: [{ variant: "link", className: "h-auto px-0" }],
        defaultVariants: { variant: "default", size: "default" },
    },
);

type ButtonProps = React.ComponentProps<"button"> &
    VariantProps<typeof buttonVariants> & {
        asChild?: boolean;
        /** Keeps the label and width, swaps the leading icon for a spinner, and disables the button. */
        loading?: boolean;
    };

function Button({
    className,
    variant,
    size,
    asChild = false,
    loading = false,
    disabled,
    children,
    ...props
}: ButtonProps) {
    if (asChild) {
        return (
            <Slot.Root
                data-slot="button"
                className={cn(buttonVariants({ variant, size }), className)}
                {...props}
            >
                {children}
            </Slot.Root>
        );
    }
    return (
        <button
            data-slot="button"
            className={cn(buttonVariants({ variant, size }), className)}
            disabled={disabled || loading}
            aria-busy={loading || undefined}
            {...props}
        >
            {loading && <Spinner className="size-4" />}
            {children}
        </button>
    );
}

export { Button, buttonVariants };
