"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

/** Toasts in the design system: popover surface, no richColors (they'd break the palette). */
export function Toaster() {
    const { resolvedTheme } = useTheme();
    return (
        <Sonner
            theme={resolvedTheme === "dark" ? "dark" : "light"}
            position="bottom-center"
            toastOptions={{
                classNames: {
                    toast: "!rounded-card-sm !border-border !bg-popover !text-popover-foreground !shadow-popover !font-sans",
                    description: "!text-muted-foreground",
                },
            }}
        />
    );
}
