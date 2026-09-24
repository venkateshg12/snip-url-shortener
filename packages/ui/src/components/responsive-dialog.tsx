"use client";

import type * as React from "react";
import { useMediaQuery } from "../hooks/use-media-query";
import { Dialog, DialogContent, SheetContent } from "./dialog";

/** A dialog from md (768px) up, a bottom sheet below. Same props, same accessibility. */
export function ResponsiveDialog({
    open,
    onOpenChange,
    children,
    className,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
    className?: string;
}) {
    const desktop = useMediaQuery("(min-width: 768px)");
    const Content = desktop ? DialogContent : SheetContent;
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <Content className={className}>{children}</Content>
        </Dialog>
    );
}
