"use client";

import { Button } from "@repo/ui/components/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { LogOut, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useLogout } from "@/hooks/auth/useLogout";
import { useAuthStore } from "@/store/auth.store";

const initials = (name: string) =>
    name
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("");

export function UserMenu() {
    const user = useAuthStore((s) => s.user);
    const { setTheme } = useTheme();
    const logout = useLogout();
    if (!user) return null;
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={`Account menu for ${user.name}`}>
                    <span
                        className="grid size-9 place-items-center rounded-full bg-muted text-sm font-medium"
                        aria-hidden="true"
                    >
                        {initials(user.name)}
                    </span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuLabel>
                    <span className="block font-480 text-foreground">{user.name}</span>
                    <span className="block truncate">{user.email}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setTheme("light")}>
                    <Sun /> Light theme
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setTheme("dark")}>
                    <Moon /> Dark theme
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setTheme("system")}>
                    <Monitor /> Match system
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => logout.mutate()}>
                    <LogOut /> Log out
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
