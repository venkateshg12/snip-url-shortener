"use client";

import { Button } from "@repo/ui/components/button";
import { MessagePage } from "@/components/layout/MessagePage";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return (
        <MessagePage
            title="Something went wrong"
            body="This page hit an unexpected error. Try again."
            action={<Button onClick={reset}>Try again</Button>}
        />
    );
}
