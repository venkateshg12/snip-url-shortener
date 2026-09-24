"use client";

import type { UrlDto } from "@repo/types";
import { Button } from "@repo/ui/components/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { BarChart3, CalendarClock, Copy, MoreHorizontal, Power, QrCode, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useUpdateUrl } from "@/hooks/urls/useUpdateUrl";
import { useCopy } from "@/hooks/useCopy";
import { displayUrl } from "@/lib/format";
import { DeleteLinkDialog } from "./DeleteLinkDialog";
import { EditLinkDialog } from "./EditLinkDialog";
import { QrCodeDialog } from "./QrCodeDialog";

/** Every per-link action in one menu: the same component in the table and on mobile cards. */
export function LinkActions({
    link,
    showAnalytics = true,
    afterDelete,
}: {
    link: UrlDto;
    showAnalytics?: boolean;
    afterDelete?: string;
}) {
    const [dialog, setDialog] = useState<"qr" | "edit" | "delete" | null>(null);
    const router = useRouter();
    const update = useUpdateUrl();
    const { copy } = useCopy();
    const short = displayUrl(link.shortUrl);
    const enabled = link.status === "active";

    const toggle = () =>
        update.mutate(
            { code: link.shortCode, patch: { status: enabled ? "disabled" : "active" } },
            {
                onSuccess: () =>
                    toast.success(
                        enabled
                            ? `${short} is off. It now leads to "not found".`
                            : `${short} is working again.`,
                    ),
            },
        );

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${short}`}>
                        <MoreHorizontal />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuItem
                        onSelect={() =>
                            void copy(link.shortUrl).then((ok) =>
                                toast[ok ? "success" : "error"](ok ? "Link copied" : "Couldn't copy"),
                            )
                        }
                    >
                        <Copy /> Copy link
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setDialog("qr")}>
                        <QrCode /> QR code
                    </DropdownMenuItem>
                    {showAnalytics && (
                        <DropdownMenuItem
                            onSelect={() =>
                                router.push(`/dashboard/links/${encodeURIComponent(link.shortCode)}`)
                            }
                        >
                            <BarChart3 /> View analytics
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setDialog("edit")}>
                        <CalendarClock /> Change expiry
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={toggle} disabled={update.isPending}>
                        <Power /> {enabled ? "Disable link" : "Enable link"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => setDialog("delete")}>
                        <Trash2 /> Delete
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <QrCodeDialog
                shortUrl={link.shortUrl}
                open={dialog === "qr"}
                onOpenChange={(o) => setDialog(o ? "qr" : null)}
            />
            <EditLinkDialog
                link={link}
                open={dialog === "edit"}
                onOpenChange={(o) => setDialog(o ? "edit" : null)}
            />
            <DeleteLinkDialog
                link={link}
                redirectTo={afterDelete}
                open={dialog === "delete"}
                onOpenChange={(o) => setDialog(o ? "delete" : null)}
            />
        </>
    );
}
