import { CircleAlert } from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "./button";

type ErrorStateProps = {
    title?: string;
    message: string;
    onRetry?: () => void;
    retrying?: boolean;
    className?: string;
};

/** A query failed on first load: say what, in plain words, and offer the way forward. */
export function ErrorState({
    title = "Couldn't load this",
    message,
    onRetry,
    retrying,
    className,
}: ErrorStateProps) {
    return (
        <div role="alert" className={cn("flex flex-col items-center px-6 py-12 text-center", className)}>
            <CircleAlert className="mb-4 size-6 text-destructive" aria-hidden="true" />
            <h3 className="text-heading-sm font-480">{title}</h3>
            <p className="mt-2 max-w-md text-muted-foreground">{message}</p>
            {onRetry && (
                <Button variant="outline" className="mt-6" onClick={onRetry} loading={retrying}>
                    Try again
                </Button>
            )}
        </div>
    );
}
