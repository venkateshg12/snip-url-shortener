"use client";

import { CircleAlert } from "lucide-react";
import * as React from "react";
import { cn } from "../lib/utils";
import { Label } from "./label";

type ControlProps = { id: string; "aria-describedby"?: string; "aria-invalid"?: true };

type FieldProps = {
    label: React.ReactNode;
    /** Shown under the control; replaced by the error while invalid. */
    hint?: React.ReactNode;
    error?: string;
    /** Marks the field "Optional". Required fields aren't starred. */
    optional?: boolean;
    /** Right-aligned next to the label, e.g. a character count. */
    aside?: React.ReactNode;
    className?: string;
    /** A stable id for the control (e.g. to focus it from elsewhere). Never override `control.id` instead. */
    id?: string;
    children: (control: ControlProps) => React.ReactNode;
};

/** The only way to render a form control: label, hint/error and ARIA wiring in one place. */
export function Field({ label, hint, error, optional, aside, className, id: fixedId, children }: FieldProps) {
    const generatedId = React.useId();
    const id = fixedId ?? generatedId;
    const messageId = `${id}-message`;
    const message = error ?? hint;
    return (
        <div className={cn("grid gap-2", className)}>
            <div className="flex items-baseline justify-between gap-3">
                <Label htmlFor={id}>
                    {label}
                    {optional && <span className="ml-2 font-normal text-subtle-foreground">Optional</span>}
                </Label>
                {aside && <span className="text-sm text-subtle-foreground tabular-nums">{aside}</span>}
            </div>
            {children({
                id,
                "aria-describedby": message ? messageId : undefined,
                "aria-invalid": error ? true : undefined,
            })}
            {error ? (
                <p id={messageId} className="flex items-start gap-1.5 text-[15px] text-destructive">
                    <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    {error}
                </p>
            ) : (
                hint && (
                    <p id={messageId} className="text-[15px] text-subtle-foreground">
                        {hint}
                    </p>
                )
            )}
        </div>
    );
}
