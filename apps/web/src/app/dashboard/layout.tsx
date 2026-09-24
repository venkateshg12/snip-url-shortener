import type { Metadata } from "next";
import { DashboardShell } from "@/components/layout/DashboardShell";

export const metadata: Metadata = { robots: { index: false } };

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
    return <DashboardShell>{children}</DashboardShell>;
}
