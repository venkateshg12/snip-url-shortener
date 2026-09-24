import { ThemeToggle } from "./ThemeToggle";

export function SiteFooter() {
    return (
        <footer className="border-t">
            <div className="mx-auto flex max-w-page flex-col gap-6 px-4 py-10 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between md:px-8">
                <p>
                    <span className="font-serif text-base text-foreground">snip</span> · short links with
                    analytics
                </p>
                <ThemeToggle />
            </div>
        </footer>
    );
}
