import type { UrlDto } from "@repo/types";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

const MAX_RECENT = 10;

type RecentLinksState = { links: UrlDto[]; add: (link: UrlDto) => void; clear: () => void };

/** A guest's last links, kept in this browser only. Logged-in users have the dashboard. */
export const useRecentLinks = create<RecentLinksState>()(
    persist(
        (set) => ({
            links: [],
            add: (link) =>
                set((state) => ({
                    links: [link, ...state.links.filter((l) => l.shortCode !== link.shortCode)].slice(
                        0,
                        MAX_RECENT,
                    ),
                })),
            clear: () => set({ links: [] }),
        }),
        { name: "recent-links", storage: createJSONStorage(() => localStorage), skipHydration: true },
    ),
);
