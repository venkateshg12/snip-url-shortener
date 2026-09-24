import type { UrlDto } from "@repo/types";
import { Badge } from "@repo/ui/components/badge";
import { isExpired } from "@/lib/format";

export function StatusBadge({ url }: { url: Pick<UrlDto, "status" | "expiresAt"> }) {
    if (isExpired(url.expiresAt)) return <Badge variant="expired">Expired</Badge>;
    if (url.status === "disabled") return <Badge variant="paused">Disabled</Badge>;
    return <Badge variant="active">Active</Badge>;
}
