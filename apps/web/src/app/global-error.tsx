"use client";

// Replaces the root layout when it crashes, so it can't rely on providers or the design system.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return (
        <html lang="en">
            <body
                style={{
                    fontFamily: "system-ui, sans-serif",
                    maxWidth: "32rem",
                    margin: "15vh auto",
                    padding: "0 1rem",
                    lineHeight: 1.5,
                }}
            >
                <h1>Something went wrong</h1>
                <p>The app hit an unexpected error.</p>
                <button
                    onClick={reset}
                    style={{
                        padding: "0.75rem 1.25rem",
                        borderRadius: 9999,
                        border: "1px solid",
                        background: "transparent",
                        cursor: "pointer",
                    }}
                >
                    Try again
                </button>
            </body>
        </html>
    );
}
