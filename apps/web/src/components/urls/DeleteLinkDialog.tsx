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
import { ResponsiveDialog } from "@repo/ui/components/responsive-dialog";
import { useRouter } from "next/navigation";
import { useDeleteUrl } from "@/hooks/urls/useDeleteUrl";
import { displayUrl } from "@/lib/format";

export function DeleteLinkDialog({
    link,
    open,
    onOpenChange,
    redirectTo,
}: {
    link: UrlDto;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Where to go afterwards (e.g. back to the list from the detail page). */
    redirectTo?: string;
}) {
    const remove = useDeleteUrl();
    const router = useRouter();
    const short = displayUrl(link.shortUrl);
    const confirm = () => {
        remove.mutate(link.shortCode); // optimistic: the row is already gone
        onOpenChange(false);
        if (redirectTo) router.push(redirectTo);
    };
    return (
        <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
            <DialogHeader>
                <DialogTitle>Delete {short}?</DialogTitle>
                <DialogDescription>
                    It stops redirecting immediately, and its analytics are deleted. This can&apos;t be
                    undone.
                </DialogDescription>
            </DialogHeader>
            <DialogFooter>
                <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button variant="destructive" onClick={confirm}>
                    Delete link
                </Button>
            </DialogFooter>
        </ResponsiveDialog>
    );
}
