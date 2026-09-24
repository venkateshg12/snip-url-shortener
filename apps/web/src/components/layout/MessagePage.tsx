import { Button } from "@repo/ui/components/button";
import Link from "next/link";
import { Logo } from "./Logo";

/** Expired, not found, crashed: one sentence of what happened and a way forward. */
export function MessagePage({
    title,
    body,
    action,
}: {
    title: string;
    body: string;
    action?: React.ReactNode;
}) {
    return (
        <div className="flex min-h-dvh flex-col px-4 py-6 md:px-8">
            <Logo />
            <main
                id="main"
                className="mx-auto flex max-w-xl flex-1 flex-col items-center justify-center py-16 text-center"
            >
                <h1 className="text-heading-sm md:text-heading">{title}</h1>
                <p className="mt-3 text-body-lg text-muted-foreground">{body}</p>
                <div className="mt-8">
                    {action ?? (
                        <Button asChild>
                            <Link href="/">Go to the homepage</Link>
                        </Button>
                    )}
                </div>
            </main>
        </div>
    );
}
