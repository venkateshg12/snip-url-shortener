import { AppErrorCode } from "../../constants/appErrorCode";
import { BAD_REQUEST } from "../../constants/http";
import { SHORT_BASE_URL, WEB_URL } from "../../constants/env";
import { AppError } from "../errors";

// Hosts this service answers on: shortening them would create loops and chains of short links.
const OWN_HOSTS = new Set([new URL(SHORT_BASE_URL).hostname, new URL(WEB_URL).hostname]);

/** Canonicalises the target (lowercase scheme and host, punycode) and rejects our own domains. */
export function normalizeTargetUrl(raw: string): string {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    if (OWN_HOSTS.has(host) || [...OWN_HOSTS].some((own) => host.endsWith(`.${own}`))) {
        throw new AppError(
            BAD_REQUEST,
            "That URL is already a short link from this service",
            AppErrorCode.InvalidTarget,
        );
    }
    return url.href;
}
