"use client";

import { cn } from "@repo/ui/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";
import { UserMenu } from "./UserMenu";

// One destination exists today (Links). A sidebar holding one item would be chrome with no job:
// the shell grows into the sidebar/rail/tab-bar design once Overview and Analytics have APIs.
const NAV = [{ href: "/dashboard", label: "Links" }];

export function AppHeader() {
    const pathname = usePathname();
    return (
        <header className="border-b">
            <div className="mx-auto flex h-16 max-w-page items-center justify-between gap-4 px-4 md:px-8">
                <div className="flex items-center gap-6">
                    <Logo href="/dashboard" />
                    <nav aria-label="Main">
                        {NAV.map((item) => {
                            const current =
                                pathname === item.href || pathname.startsWith(`${item.href}/links`);
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    aria-current={current ? "page" : undefined}
                                    className={cn(
                                        "inline-flex min-h-11 items-center rounded-full px-3 text-[15px] transition-colors duration-150",
                                        current
                                            ? "bg-accent font-480 text-foreground"
                                            : "text-muted-foreground hover:text-foreground",
                                    )}
                                >
                                    {item.label}
                                </Link>
                            );
                        })}
                    </nav>
                </div>
                <UserMenu />
            </div>
        </header>
    );
}
