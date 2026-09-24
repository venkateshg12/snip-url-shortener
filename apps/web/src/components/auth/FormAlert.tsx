import { CircleAlert } from "lucide-react";

/** A form-level failure (credentials, network, 5xx): announced, next to the submit button. */
export function FormAlert({ message }: { message: string | null }) {
    if (!message) return null;
    return (
        <p
            role="alert"
            className="flex items-start gap-2 rounded-input border border-destructive/40 px-4 py-3 text-[15px] text-destructive"
        >
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {message}
        </p>
    );
}
