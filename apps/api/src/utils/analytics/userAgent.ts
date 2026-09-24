import Bowser from "bowser";

// Link previews and crawlers fetch every shared link; counting them would inflate every chart
const BOT_PATTERN =
    /bot|crawler|spider|preview|facebookexternalhit|slack|whatsapp|discord|telegram|curl|wget|python-requests|headless/i;

export const isBot = (userAgent: string) => userAgent === "" || BOT_PATTERN.test(userAgent);

export type ParsedAgent = { browser: string | null; os: string | null; device: string | null };

export function parseUserAgent(userAgent: string): ParsedAgent {
    const result = Bowser.parse(userAgent);
    return {
        browser: result.browser.name?.slice(0, 64) ?? null,
        os: result.os.name?.slice(0, 64) ?? null,
        device: result.platform.type?.slice(0, 16) ?? null, // desktop | mobile | tablet | tv
    };
}

/** Only the host of the referrer is stored: paths and queries can contain personal data. */
export function referrerHost(referrer: string | null): string | null {
    if (!referrer) return null;
    try {
        return (
            new URL(referrer).hostname
                .toLowerCase()
                .replace(/^www\./, "")
                .slice(0, 255) || null
        );
    } catch {
        return null;
    }
}
