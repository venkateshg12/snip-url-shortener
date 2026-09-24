import type { Metadata } from "next";
import { MessagePage } from "@/components/layout/MessagePage";

export const metadata: Metadata = { title: "Not found", robots: { index: false } };

// Also where the API sends unknown and disabled short links
export default function NotFound() {
    return (
        <MessagePage
            title="This link doesn't exist"
            body="It may have been mistyped, switched off by its owner, or deleted."
        />
    );
}
