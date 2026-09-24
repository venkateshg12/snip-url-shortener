"use client";

import type { UrlDto } from "@repo/types";
import { Button } from "@repo/ui/components/button";
import {
    DialogClose,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@repo/ui/components/dialog";
import { Field } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { ResponsiveDialog } from "@repo/ui/components/responsive-dialog";
import { useState } from "react";
import { toast } from "sonner";
import { useUpdateUrl } from "@/hooks/urls/useUpdateUrl";
import { displayUrl } from "@/lib/format";

/** "2026-10-01T09:30" in local time, for <input type="datetime-local">. */
const toLocalInput = (iso: string) => {
    const date = new Date(iso);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

export function EditLinkDialog({
    link,
    open,
    onOpenChange,
}: {
    link: UrlDto;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [value, setValue] = useState(link.expiresAt ? toLocalInput(link.expiresAt) : "");
    const [error, setError] = useState<string | undefined>();
    const update = useUpdateUrl();
    const short = displayUrl(link.shortUrl);

    const save = (expiresAt: string | null) => {
        if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
            setError("Pick a time in the future");
            return;
        }
        update.mutate(
            {
                code: link.shortCode,
                patch: { expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null },
            },
            {
                onSuccess: () => {
                    toast.success(
                        expiresAt
                            ? `${short} now expires ${new Date(expiresAt).toLocaleString()}`
                            : `${short} no longer expires`,
                    );
                    onOpenChange(false);
                },
                onError: (e) => setError(e.fieldErrors[0]?.message ?? e.message),
            },
        );
    };

    return (
        <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
            <DialogHeader>
                <DialogTitle>Change expiry</DialogTitle>
                <DialogDescription>
                    After this time, {short} leads to an &ldquo;expired&rdquo; page instead of its
                    destination.
                </DialogDescription>
            </DialogHeader>
            <form
                noValidate
                onSubmit={(e) => {
                    e.preventDefault();
                    save(value || null);
                }}
                className="grid gap-6"
            >
                <Field label="Expires" hint="Leave empty to keep the link working forever" error={error}>
                    {(control) => (
                        <Input
                            {...control}
                            type="datetime-local"
                            value={value}
                            onChange={(e) => {
                                setValue(e.target.value);
                                setError(undefined);
                            }}
                        />
                    )}
                </Field>
                <DialogFooter>
                    {link.expiresAt && (
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => save(null)}
                            disabled={update.isPending}
                            className="sm:mr-auto"
                        >
                            Remove expiry
                        </Button>
                    )}
                    <DialogClose asChild>
                        <Button type="button" variant="outline">
                            Cancel
                        </Button>
                    </DialogClose>
                    <Button type="submit" loading={update.isPending}>
                        Save
                    </Button>
                </DialogFooter>
            </form>
        </ResponsiveDialog>
    );
}
