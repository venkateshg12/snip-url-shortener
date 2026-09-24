"use client";

import { RadioGroup } from "radix-ui";
import { focusRing } from "../lib/focus";
import { cn } from "../lib/utils";

type Option<T extends string> = { value: T; label: string };

/** A choice between a few values (e.g. 7 · 30 · 90 days): radio semantics, pill look. */
export function SegmentedControl<T extends string>({
    value,
    onValueChange,
    options,
    label,
    className,
}: {
    value: T;
    onValueChange: (value: T) => void;
    options: readonly Option<T>[];
    label: string;
    className?: string;
}) {
    return (
        <RadioGroup.Root
            aria-label={label}
            value={value}
            onValueChange={(v) => onValueChange(v as T)}
            orientation="horizontal"
            className={cn("inline-flex rounded-full bg-muted p-1", className)}
        >
            {options.map((option) => (
                <RadioGroup.Item
                    key={option.value}
                    value={option.value}
                    className={cn(
                        "h-8 min-w-12 cursor-pointer rounded-full px-3 text-[15px] text-muted-foreground transition-colors duration-150 pointer-coarse:h-11",
                        "data-[state=checked]:bg-background data-[state=checked]:text-foreground data-[state=checked]:shadow-popover",
                        focusRing,
                    )}
                >
                    {option.label}
                </RadioGroup.Item>
            ))}
        </RadioGroup.Root>
    );
}
