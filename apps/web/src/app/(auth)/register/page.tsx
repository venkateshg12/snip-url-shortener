import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "@/components/auth/RegisterForm";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
    return (
        <>
            <h1 className="text-heading-sm md:text-heading">Create your account</h1>
            <p className="mt-2 mb-8 text-muted-foreground">
                Keep your links in one place, with custom aliases and click analytics.
            </p>
            <RegisterForm />
            <p className="mt-6 text-[15px] text-muted-foreground">
                Already have an account?{" "}
                <Link href="/login" className="text-foreground underline underline-offset-4">
                    Log in
                </Link>
            </p>
        </>
    );
}
