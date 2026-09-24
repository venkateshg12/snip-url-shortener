"use client";

import { Button } from "@repo/ui/components/button";
import Link from "next/link";
import { useAuthStore } from "@/store/auth.store";
import { Logo } from "./Logo";
import { UserMenu } from "./UserMenu";

/** Marketing header: one primary action. Logged in, it becomes "Your links" + the account menu. */
export function SiteHeader() {
    const status = useAuthStore((s) => s.status);
    return (
        <header className="mx-auto flex h-18 max-w-page items-center justify-between gap-4 px-4 md:px-8">
            <Logo />
            <nav aria-label="Account" className="flex items-center gap-2">
                {status === "authenticated" ? (
                    <>
                        <Button asChild variant="ghost" size="sm">
                            <Link href="/dashboard">Your links</Link>
                        </Button>
                        <UserMenu />
                    </>
                ) : (
                    // Reserve the space while the session loads, so nothing jumps
                    <div className={status === "loading" ? "invisible flex gap-2" : "flex gap-2"}>
                        <Button asChild variant="ghost" size="sm">
                            <Link href="/login">Log in</Link>
                        </Button>
                        <Button asChild size="sm">
                            <Link href="/register">Get started</Link>
                        </Button>
                    </div>
                )}
            </nav>
        </header>
    );
}
