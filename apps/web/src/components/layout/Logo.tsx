import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
    return (
        <Link
            href={href}
            className="inline-flex min-h-11 items-center font-serif text-heading-sm tracking-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
            snip
        </Link>
    );
}
