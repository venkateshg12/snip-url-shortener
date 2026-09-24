import type * as React from "react";
import { cn } from "../lib/utils";

function Table({ className, ...props }: React.ComponentProps<"table">) {
    return (
        <div className="relative w-full overflow-x-auto">
            <table className={cn("w-full caption-bottom text-[15px]", className)} {...props} />
        </div>
    );
}
const TableHeader = (props: React.ComponentProps<"thead">) => <thead {...props} />;
const TableBody = ({ className, ...props }: React.ComponentProps<"tbody">) => (
    <tbody className={cn("[&_tr]:border-t", className)} {...props} />
);
const TableRow = ({ className, ...props }: React.ComponentProps<"tr">) => (
    <tr className={cn("transition-colors duration-150 hover:bg-accent/50", className)} {...props} />
);
const TableHead = ({ className, ...props }: React.ComponentProps<"th">) => (
    <th
        className={cn(
            "h-10 px-3 text-left align-middle text-sm font-normal text-subtle-foreground",
            className,
        )}
        {...props}
    />
);
const TableCell = ({ className, ...props }: React.ComponentProps<"td">) => (
    <td className={cn("h-14 px-3 align-middle", className)} {...props} />
);

export { Table, TableBody, TableCell, TableHead, TableHeader, TableRow };
