"use client";

import { displayUrl, formatRelative } from "@/lib/format";
import { useRecentLinks } from "@/store/recentLinks.store";
import { CopyButton } from "./CopyButton";

/** A guest's recent links, stored in this browser only. Nothing to show → nothing rendered. */
export function RecentLinks() {
    const links = useRecentLinks((s) => s.links);
    if (links.length === 0) return null;
    return (
        <section aria-labelledby="recent-title" className="mt-10 text-left">
            <h2 id="recent-title" className="font-sans text-sm text-muted-foreground">
                Your recent links <span className="text-subtle-foreground">· saved in this browser</span>
            </h2>
            <ul className="mt-2 divide-y">
                {links.map((link) => (
                    <li key={link.shortCode} className="flex items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                            <p className="truncate font-480">{displayUrl(link.shortUrl)}</p>
                            <p className="truncate text-sm text-muted-foreground">
                                {displayUrl(link.longUrl)} · {formatRelative(link.createdAt)}
                            </p>
                        </div>
                        <CopyButton
                            text={link.shortUrl}
                            label={`Copy ${displayUrl(link.shortUrl)}`}
                            iconOnly
                            size="icon"
                            variant="ghost"
                        />
                    </li>
                ))}
            </ul>
        </section>
    );
}
