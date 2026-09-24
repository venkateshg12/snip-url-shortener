import { useCallback, useEffect, useRef, useState } from "react";

/** Copies text; `copied` is true for 1.5s afterwards. Returns false when the clipboard is unavailable. */
export function useCopy(resetMs = 1500) {
    const [copied, setCopied] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
    useEffect(() => () => clearTimeout(timer.current), []);

    const copy = useCallback(
        async (text: string) => {
            try {
                await navigator.clipboard.writeText(text);
            } catch {
                return false;
            }
            setCopied(true);
            clearTimeout(timer.current);
            timer.current = setTimeout(() => setCopied(false), resetMs);
            return true;
        },
        [resetMs],
    );
    return { copied, copy };
}
