import type { Metadata } from "next";
import { MessagePage } from "@/components/layout/MessagePage";

export const metadata: Metadata = { title: "Link expired", robots: { index: false } };

export default function ExpiredPage() {
    return (
        <MessagePage
            title="This link has expired"
            body="Whoever shared it set it to stop working after a while. Ask them for a new one."
        />
    );
}
