const numberFormat = new Intl.NumberFormat();
export const formatCount = (n: number) => numberFormat.format(n);

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000_000],
    ["month", 2_592_000_000],
    ["week", 604_800_000],
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
];

/** "3 min ago", "yesterday", "in 5 days". */
export function formatRelative(iso: string, now = Date.now()): string {
    const diff = new Date(iso).getTime() - now;
    for (const [unit, ms] of UNITS) {
        if (Math.abs(diff) >= ms) return relative.format(Math.round(diff / ms), unit);
    }
    return "just now";
}

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
const dateTimeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
export const formatDate = (iso: string) => dateFormat.format(new Date(iso));
export const formatDateTime = (iso: string) => dateTimeFormat.format(new Date(iso));

/** "https://www.example.com/a/b?c" → "example.com/a/b?c", for compact display only. */
export const displayUrl = (url: string) => url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

export const isExpired = (expiresAt: string | null, now = Date.now()) =>
    expiresAt !== null && new Date(expiresAt).getTime() <= now;
