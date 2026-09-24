/** Only same-site paths: "?next=https://evil.example" must not become an open redirect. */
export function safeNext(next: string | null, fallback = "/dashboard"): string {
    if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
    return next;
}
