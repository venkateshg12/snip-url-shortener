import type { UserDto } from "@repo/types";
import { create } from "zustand";

/** Why we're a guest: a deliberate logout must not bounce the user to the login page. */
export type GuestReason = "anonymous" | "logout";

type AuthState =
    | { status: "loading"; user: null; guestReason: null }
    | { status: "authenticated"; user: UserDto; guestReason: null }
    | { status: "guest"; user: null; guestReason: GuestReason };

type AuthActions = { setUser: (user: UserDto) => void; setGuest: (reason?: GuestReason) => void };

/** Session state only. Server data (links, stats) lives in TanStack Query, never here. */
export const useAuthStore = create<AuthState & AuthActions>()((set) => ({
    status: "loading",
    user: null,
    guestReason: null,
    setUser: (user) => set({ status: "authenticated", user, guestReason: null }),
    setGuest: (reason = "anonymous") => set({ status: "guest", user: null, guestReason: reason }),
}));
