"use client";

import { SegmentedControl } from "@repo/ui/components/segmented-control";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

const OPTIONS = [
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
    { value: "system", label: "System" },
] as const;
type ThemeChoice = (typeof OPTIONS)[number]["value"];

const noop = () => () => {};
/** The server can't know the theme: render only on the client, so hydration never mismatches. */
const useMounted = () =>
    useSyncExternalStore(
        noop,
        () => true,
        () => false,
    );

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const mounted = useMounted();
    if (!mounted) return <div className="h-10 w-52" aria-hidden="true" />; // reserve the space: no layout shift
    return (
        <SegmentedControl
            label="Theme"
            value={(theme ?? "system") as ThemeChoice}
            onValueChange={setTheme}
            options={OPTIONS}
        />
    );
}
