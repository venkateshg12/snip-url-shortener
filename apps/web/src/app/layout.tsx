import "@repo/ui/globals.css";
import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import { Providers } from "./providers";

// Variable fonts: Inter renders the half-step weights (430/450/480) exactly.
// globals.css reads these two variables for font-sans and font-serif.
const sans = Inter({ subsets: ["latin"], variable: "--font-inter" });
const serif = Source_Serif_4({
    subsets: ["latin"],
    style: ["normal", "italic"],
    variable: "--font-source-serif",
});

export const metadata: Metadata = {
    title: { default: "snip · Short links with analytics", template: "%s · snip" },
    description: "Shorten any link in one step, share it anywhere, and see every click.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
    return (
        // next-themes sets class="dark" before hydration, so React must not warn about it
        <html lang="en" suppressHydrationWarning className={`${sans.variable} ${serif.variable}`}>
            <body>
                <a
                    href="#main"
                    className="sr-only z-50 rounded-full bg-primary px-5 py-3 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
                >
                    Skip to content
                </a>
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}
