"use client";

import { Button } from "@repo/ui/components/button";
import { inputClasses } from "@repo/ui/components/input";
import { cn } from "@repo/ui/lib/utils";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

export function PasswordInput({ className, ...props }: React.ComponentProps<"input">) {
    const [visible, setVisible] = useState(false);
    return (
        <div className="relative">
            <input
                type={visible ? "text" : "password"}
                className={cn(inputClasses, "pr-14", className)}
                {...props}
            />
            <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute top-1/2 right-1 -translate-y-1/2"
                aria-label={visible ? "Hide password" : "Show password"}
                aria-pressed={visible}
                onClick={() => setVisible((v) => !v)}
            >
                {visible ? <EyeOff /> : <Eye />}
            </Button>
        </div>
    );
}
