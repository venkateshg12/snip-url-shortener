"use client";

import { X } from "lucide-react";
import { Dialog as D } from "radix-ui";
import type * as React from "react";
import { cn } from "../lib/utils";
import { Button } from "./button";

const Dialog = D.Root;
const DialogTrigger = D.Trigger;
const DialogClose = D.Close;

const overlay =
    "fixed inset-0 z-50 bg-foreground/20 animate-in fade-in-0 duration-250 data-[state=closed]:animate-out data-[state=closed]:fade-out-0";

/** Centred dialog (md and up). Below md, use ResponsiveDialog: it becomes a bottom sheet. */
function DialogContent({ className, children, ...props }: React.ComponentProps<typeof D.Content>) {
    return (
        <D.Portal>
            <D.Overlay className={overlay} />
            <D.Content
                className={cn(
                    "fixed top-1/2 left-1/2 z-50 grid w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-6",
                    "rounded-artifact bg-popover p-6 text-popover-foreground shadow-modal outline-none",
                    "animate-in fade-in-0 zoom-in-95 duration-250 ease-out-soft",
                    "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
                    className,
                )}
                {...props}
            >
                {children}
                <DialogCloseButton />
            </D.Content>
        </D.Portal>
    );
}

/** Bottom sheet: thumb-reachable on phones, never a full-screen dialog for a few fields. */
function SheetContent({ className, children, ...props }: React.ComponentProps<typeof D.Content>) {
    return (
        <D.Portal>
            <D.Overlay className={overlay} />
            <D.Content
                className={cn(
                    "fixed inset-x-0 bottom-0 z-50 grid max-h-[85dvh] gap-6 overflow-y-auto rounded-t-card bg-popover p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]",
                    "text-popover-foreground shadow-modal outline-none",
                    "animate-in slide-in-from-bottom duration-250 ease-out-soft data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom",
                    className,
                )}
                {...props}
            >
                <div className="mx-auto -mt-2 h-1 w-10 rounded-full bg-border" aria-hidden="true" />
                {children}
                <DialogCloseButton />
            </D.Content>
        </D.Portal>
    );
}

function DialogCloseButton() {
    return (
        <D.Close asChild>
            <Button variant="ghost" size="icon-sm" className="absolute top-3 right-3" aria-label="Close">
                <X />
            </Button>
        </D.Close>
    );
}

const DialogHeader = ({ className, ...props }: React.ComponentProps<"div">) => (
    <div className={cn("grid gap-1.5 pr-8", className)} {...props} />
);
const DialogFooter = ({ className, ...props }: React.ComponentProps<"div">) => (
    <div className={cn("flex flex-col-reverse gap-3 sm:flex-row sm:justify-end", className)} {...props} />
);
const DialogTitle = ({ className, ...props }: React.ComponentProps<typeof D.Title>) => (
    <D.Title className={cn("text-heading-sm font-480", className)} {...props} />
);
const DialogDescription = ({ className, ...props }: React.ComponentProps<typeof D.Description>) => (
    <D.Description className={cn("text-muted-foreground", className)} {...props} />
);

export {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    SheetContent,
};
