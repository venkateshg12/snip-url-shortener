"use client";

import { DropdownMenu as Menu } from "radix-ui";
import type * as React from "react";
import { cn } from "../lib/utils";

const DropdownMenu = Menu.Root;
const DropdownMenuTrigger = Menu.Trigger;

function DropdownMenuContent({
    className,
    sideOffset = 6,
    align = "end",
    ...props
}: React.ComponentProps<typeof Menu.Content>) {
    return (
        <Menu.Portal>
            <Menu.Content
                sideOffset={sideOffset}
                align={align}
                className={cn(
                    "z-50 min-w-48 rounded-card-sm bg-popover p-1.5 text-popover-foreground shadow-popover",
                    "animate-in fade-in-0 zoom-in-95 duration-150 ease-out-soft",
                    "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
                    className,
                )}
                {...props}
            />
        </Menu.Portal>
    );
}

function DropdownMenuItem({
    className,
    variant = "default",
    ...props
}: React.ComponentProps<typeof Menu.Item> & { variant?: "default" | "destructive" }) {
    return (
        <Menu.Item
            className={cn(
                "flex h-10 cursor-pointer items-center gap-2.5 rounded-sm px-3 text-[15px] outline-none select-none pointer-coarse:h-11",
                "focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                "[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
                variant === "destructive" && "text-destructive [&_svg]:text-destructive",
                className,
            )}
            {...props}
        />
    );
}

const DropdownMenuSeparator = ({ className, ...props }: React.ComponentProps<typeof Menu.Separator>) => (
    <Menu.Separator className={cn("-mx-1.5 my-1.5 h-px bg-border", className)} {...props} />
);
const DropdownMenuLabel = ({ className, ...props }: React.ComponentProps<typeof Menu.Label>) => (
    <Menu.Label className={cn("px-3 py-2 text-sm text-muted-foreground", className)} {...props} />
);

export {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
};
