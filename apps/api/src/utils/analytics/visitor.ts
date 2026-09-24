import { createHmac } from "node:crypto";
import { VISITOR_HASH_SECRET } from "../../constants/env";

/**
 * A per-day pseudonym for a visitor: HMAC(secret, UTC date + IP). It can't be reversed into the IP
 * (the secret defeats brute-forcing the IPv4 space) and can't be linked across days, so it supports
 * "unique visitors per day" and nothing more. Raw IPs are never stored.
 */
export function hashVisitor(ip: string, now = new Date()): string {
    const day = now.toISOString().slice(0, 10);
    return createHmac("sha256", VISITOR_HASH_SECRET).update(`${day}|${ip}`).digest("hex");
}
