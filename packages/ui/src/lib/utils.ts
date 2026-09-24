import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge only knows Tailwind's default scale. Without this, it reads custom utilities
// like `text-display` as colours and drops them when merged with `text-foreground`.
// Keep in sync with the @theme block in styles/globals.css.
const twMerge = extendTailwindMerge({
    extend: {
        theme: {
            text: [
                "caption",
                "body",
                "body-lg",
                "subheading",
                "heading-sm",
                "heading",
                "heading-lg",
                "display",
            ],
            "font-weight": ["430", "450", "480"],
            radius: ["image", "input", "card-sm", "artifact", "card"],
            shadow: ["popover", "modal", "artifact"],
            breakpoint: ["xs"],
            ease: ["out-soft"],
        },
    },
});

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}
