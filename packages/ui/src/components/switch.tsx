"use client";

import { Switch as SwitchPrimitive } from "radix-ui";
import type * as React from "react";
import { focusRing } from "../lib/focus";
import { cn } from "../lib/utils";

function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
    return (
        <SwitchPrimitive.Root
            className={cn(
                "peer inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors duration-150",
                "bg-input data-[state=checked]:bg-primary disabled:cursor-not-allowed disabled:opacity-50",
                // a 44px touch target around a 24px control
                "relative after:absolute after:-inset-2.5 after:content-['']",
                focusRing,
                className,
            )}
            {...props}
        >
            <SwitchPrimitive.Thumb className="pointer-events-none block size-5 translate-x-0.5 rounded-full bg-background shadow-sm transition-transform duration-150 ease-out-soft data-[state=checked]:translate-x-[18px]" />
        </SwitchPrimitive.Root>
    );
}

export { Switch };
