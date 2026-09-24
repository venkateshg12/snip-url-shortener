import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
    return (
        <>
            <h1 className="text-heading-sm md:text-heading">Welcome back</h1>
            <p className="mt-2 mb-8 text-muted-foreground">
                Log in to manage your links and see who&apos;s clicking.
            </p>
            <LoginForm />
            <p className="mt-6 text-[15px] text-muted-foreground">
                New here?{" "}
                <Link href="/register" className="text-foreground underline underline-offset-4">
                    Create an account
                </Link>
            </p>
        </>
    );
}
