"use client";

import { Button } from "@repo/ui/components/button";
import { DialogDescription, DialogHeader, DialogTitle } from "@repo/ui/components/dialog";
import { ResponsiveDialog } from "@repo/ui/components/responsive-dialog";
import { Skeleton } from "@repo/ui/components/skeleton";
import { Download } from "lucide-react";
import dynamic from "next/dynamic";
import { useRef } from "react";
import { displayUrl } from "@/lib/format";
import { CopyButton } from "./CopyButton";

// Loaded only when a QR dialog opens
const QRCodeSVG = dynamic(() => import("qrcode.react").then((m) => m.QRCodeSVG), {
    ssr: false,
    loading: () => <Skeleton className="size-56 rounded-image" />,
});

function download(filename: string, href: string) {
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    a.click();
}

export function QrCodeDialog({
    shortUrl,
    open,
    onOpenChange,
}: {
    shortUrl: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const tile = useRef<HTMLDivElement>(null);
    const name = displayUrl(shortUrl);
    const fileBase = `qr-${name.replace(/[^a-z0-9]+/gi, "-")}`;

    const svgMarkup = () => {
        const svg = tile.current?.querySelector("svg");
        return svg ? new XMLSerializer().serializeToString(svg) : null;
    };
    const downloadSvg = () => {
        const markup = svgMarkup();
        if (markup)
            download(`${fileBase}.svg`, URL.createObjectURL(new Blob([markup], { type: "image/svg+xml" })));
    };
    const downloadPng = () => {
        const markup = svgMarkup();
        if (!markup) return;
        const image = new Image();
        image.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = canvas.height = 1024; // print quality
            const ctx = canvas.getContext("2d")!;
            ctx.fillStyle = "#fff";
            ctx.fillRect(0, 0, 1024, 1024);
            ctx.drawImage(image, 64, 64, 896, 896);
            download(`${fileBase}.png`, canvas.toDataURL("image/png"));
        };
        image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
    };

    return (
        <ResponsiveDialog open={open} onOpenChange={onOpenChange} className="md:max-w-sm">
            <DialogHeader>
                <DialogTitle>QR code</DialogTitle>
                <DialogDescription>Scans open {name}.</DialogDescription>
            </DialogHeader>
            {/* Always dark-on-white, in both themes: scanners need the contrast */}
            <div
                ref={tile}
                className="mx-auto grid place-items-center rounded-image bg-white p-4 text-black animate-in fade-in-0 duration-150"
            >
                <QRCodeSVG value={shortUrl} size={224} marginSize={0} title={`QR code for ${name}`} />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" onClick={downloadPng}>
                    <Download /> PNG
                </Button>
                <Button variant="outline" onClick={downloadSvg}>
                    <Download /> SVG
                </Button>
            </div>
            <CopyButton
                text={shortUrl}
                label={`Copy ${name}`}
                variant="ghost"
                size="default"
                className="w-full"
            />
        </ResponsiveDialog>
    );
}
