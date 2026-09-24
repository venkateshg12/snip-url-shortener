import { isIPv6 } from "node:net";
import type { Request } from "express";

/**
 * The client's IP as rate-limit key. Uses req.ip only: it's correct once `trust proxy` is set
 * (phase 9). Never read X-Forwarded-For directly: anyone can send one.
 * IPv6 is bucketed by /64, because a single client controls a whole /64.
 */
export function extractClientIp(req: Request): string {
    const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
    if (ip.startsWith("::ffff:")) return ip.slice(7); // IPv4-mapped IPv6
    return isIPv6(ip) ? ipv6Prefix64(ip) : ip;
}

export function ipv6Prefix64(ip: string): string {
    const [head = "", tail = ""] = ip.split("::");
    const headParts = head ? head.split(":") : [];
    const tailParts = tail ? tail.split(":") : [];
    const missing = 8 - headParts.length - tailParts.length;
    const full = [...headParts, ...Array<string>(ip.includes("::") ? missing : 0).fill("0"), ...tailParts];
    return `${full
        .slice(0, 4)
        .map((part) => part.toLowerCase().replace(/^0+(?=.)/, ""))
        .join(":")}::/64`;
}
