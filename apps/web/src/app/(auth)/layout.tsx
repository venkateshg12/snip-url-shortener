import { Suspense } from "react";
import { PublicOnly } from "@/components/auth/PublicOnly";
import { Logo } from "@/components/layout/Logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
    return (
        <div className="flex min-h-dvh flex-col px-4 py-6">
            <div className="mx-auto w-full max-w-sm">
                <Logo />
            </div>
            <main id="main" className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
                {/* useSearchParams (for ?next=) needs a Suspense boundary */}
                <Suspense>
                    <PublicOnly>{children}</PublicOnly>
                </Suspense>
            </main>
        </div>
    );
}
