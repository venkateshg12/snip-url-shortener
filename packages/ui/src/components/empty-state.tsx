import type * as React from "react";
import { cn } from "../lib/utils";

type EmptyStateProps = {
    icon?: React.ReactNode;
    title: string;
    /** What's missing and why it matters, in one line. */
    description: React.ReactNode;
    /** What to do next: the action itself, right here. */
    action?: React.ReactNode;
    className?: string;
};

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
    return (
        <div className={cn("flex flex-col items-center px-6 py-12 text-center", className)}>
            {icon && <div className="mb-4 text-subtle-foreground [&_svg]:size-6">{icon}</div>}
            <h3 className="text-heading-sm font-480">{title}</h3>
            <p className="mt-2 max-w-md text-body text-muted-foreground">{description}</p>
            {action && <div className="mt-6">{action}</div>}
        </div>
    );
}
