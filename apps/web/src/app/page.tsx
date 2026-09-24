import { Button } from "@repo/ui/components/button";
import { BarChart3, Link2, Megaphone, QrCode, SlidersHorizontal, Users } from "lucide-react";
import Link from "next/link";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { RecentLinks } from "@/components/urls/RecentLinks";
import { ShortenForm } from "@/components/urls/ShortenForm";

// A Server Component: only the header, the form and the recent links are client code.
const BENEFITS = [
    {
        tag: "Redirects",
        title: "Fast, even when things break",
        body: "Popular links answer from cache in milliseconds, and keep working if the cache goes down.",
    },
    {
        tag: "Analytics",
        title: "See every click",
        body: "Clicks and unique visitors per day, plus the sites, countries and devices they came from.",
    },
    {
        tag: "Control",
        title: "Yours to change",
        body: "Pick a readable alias, set an expiry, or switch a link off without deleting it.",
    },
];

const USE_CASES = [
    {
        icon: Megaphone,
        title: "Launch campaigns",
        body: "One link per channel, so you can see which one actually brought people in.",
    },
    {
        icon: QrCode,
        title: "Printed QR codes",
        body: "Change nothing on the poster: switch the link off or let it expire when the event ends.",
    },
    {
        icon: Users,
        title: "Sharing with a team",
        body: "Readable aliases people can type, instead of 200-character document URLs.",
    },
];

export default function Home() {
    return (
        <>
            <SiteHeader />
            <main id="main">
                <section className="mx-auto max-w-3xl px-4 pt-12 pb-16 text-center md:px-8 md:pt-20 md:pb-24">
                    <h1 className="text-heading xs:text-heading-lg lg:text-display">
                        Short links with a <em>long</em> memory
                    </h1>
                    <p className="mx-auto mt-5 mb-10 max-w-xl text-body-lg text-muted-foreground">
                        Shorten any link in one step. Share it anywhere, and see every click: where it came
                        from, on what device, and when.
                    </p>
                    <ShortenForm variant="hero" />
                    <RecentLinks />
                </section>

                <section aria-labelledby="benefits-title" className="bg-section py-16 md:py-section">
                    <div className="mx-auto max-w-page px-4 md:px-8">
                        <h2 id="benefits-title" className="text-center text-heading md:text-heading-lg">
                            Every click, <em>counted</em>
                        </h2>
                        <div className="mt-10 grid gap-6 md:mt-12 md:grid-cols-3">
                            {BENEFITS.map((b) => (
                                <article key={b.tag} className="rounded-card bg-card p-6">
                                    <p className="text-sm text-subtle-foreground">{b.tag}</p>
                                    <h3 className="mt-2 font-sans text-body-lg font-medium">{b.title}</h3>
                                    <p className="mt-2 text-muted-foreground">{b.body}</p>
                                </article>
                            ))}
                        </div>
                    </div>
                </section>

                <section
                    aria-labelledby="uses-title"
                    className="mx-auto max-w-page px-4 py-16 md:px-8 md:py-section"
                >
                    <h2 id="uses-title" className="text-heading">
                        Made for links people <em>actually</em> use
                    </h2>
                    <ul className="mt-10 grid gap-8 md:grid-cols-3">
                        {USE_CASES.map(({ icon: Icon, title, body }) => (
                            <li key={title} className="grid gap-2">
                                <Icon className="size-6 text-subtle-foreground" aria-hidden="true" />
                                <h3 className="font-sans text-body-lg font-medium">{title}</h3>
                                <p className="text-muted-foreground">{body}</p>
                            </li>
                        ))}
                    </ul>
                </section>

                <section aria-labelledby="cta-title" className="bg-section">
                    <div className="mx-auto flex max-w-page flex-col items-start gap-6 px-4 py-16 md:flex-row md:items-center md:justify-between md:px-8">
                        <div>
                            <h2 id="cta-title" className="text-heading-sm md:text-heading">
                                Keep your links in one place
                            </h2>
                            <p className="mt-2 flex items-center gap-2 text-muted-foreground">
                                <Link2 className="size-4" aria-hidden="true" /> Aliases{" "}
                                <SlidersHorizontal className="ml-2 size-4" aria-hidden="true" /> Expiry
                                <BarChart3 className="ml-2 size-4" aria-hidden="true" /> Analytics
                            </p>
                        </div>
                        <Button asChild size="lg">
                            <Link href="/register">Create free account</Link>
                        </Button>
                    </div>
                </section>
            </main>
            <SiteFooter />
        </>
    );
}
