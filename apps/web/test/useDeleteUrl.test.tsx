import type { UrlDto } from "@repo/types";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import MockAdapter from "axios-mock-adapter";
import { afterEach, describe, expect, it } from "vitest";
import { useDeleteUrl } from "@/hooks/urls/useDeleteUrl";
import { API } from "@/lib/api";
import { makeQueryClient } from "@/lib/queryClient";
import { queryKeys } from "@/lib/queryKeys";

const link = (code: string): UrlDto => ({
    shortCode: code,
    shortUrl: `http://api.test/${code}`,
    longUrl: "https://example.com",
    isCustomAlias: false,
    status: "active",
    expiresAt: null,
    clickCount: 0,
    createdAt: "",
});

describe("useDeleteUrl", () => {
    const mock = new MockAdapter(API);
    afterEach(() => mock.reset());

    it("removes the row immediately, and restores it when the request fails", async () => {
        const client = makeQueryClient();
        const key = queryKeys.urls.list(1, 20);
        client.setQueryData(key, {
            urls: [link("keep"), link("gone")],
            meta: { page: 1, limit: 20, total: 2, hasMore: false },
        });
        let release!: () => void;
        mock.onDelete("/urls/gone").reply(
            () => new Promise((resolve) => (release = () => resolve([500, {}]))),
        );

        const { result } = renderHook(() => useDeleteUrl(), {
            wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
        });
        act(() => result.current.mutate("gone"));

        const codes = () => client.getQueryData<{ urls: UrlDto[] }>(key)?.urls.map((u) => u.shortCode);
        await waitFor(() => expect(codes()).toEqual(["keep"])); // optimistic
        release();
        await waitFor(() => expect(codes()).toEqual(["keep", "gone"])); // rolled back
    });
});
