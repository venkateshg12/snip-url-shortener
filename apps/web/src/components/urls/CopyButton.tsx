"use client";

import { Button } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { useCopy } from "@/hooks/useCopy";

type CopyButtonProps = {
    text: string;
    /** For screen readers, e.g. "Copy snip.to/abc". Visible label is "Copy" / "Copied". */
    label: string;
    iconOnly?: boolean;
    variant?: "default" | "outline" | "ghost" | "secondary";
    size?: "sm" | "default" | "icon" | "icon-sm";
    className?: string;
    autoFocus?: boolean;
};

export function CopyButton({
    text,
    label,
    iconOnly,
    variant = "outline",
    size = "sm",
    className,
    autoFocus,
}: CopyButtonProps) {
    const { copied, copy } = useCopy();
    const onClick = async () => {
        if (!(await copy(text))) toast.error("Couldn't copy automatically. Select the link and copy it.");
    };
    return (
        <>
            <Button
                type="button"
                variant={variant}
                size={iconOnly ? (size === "icon" ? "icon" : "icon-sm") : size}
                onClick={onClick}
                aria-label={label}
                autoFocus={autoFocus}
                className={cn(!iconOnly && "min-w-28", className)} // fixed width: "Copied" mustn't shift the layout
            >
                {copied ? <Check /> : <Copy />}
                {!iconOnly && <span>{copied ? "Copied" : "Copy"}</span>}
            </Button>
            <span className="sr-only" aria-live="polite">
                {copied ? "Link copied" : ""}
            </span>
        </>
    );
}
