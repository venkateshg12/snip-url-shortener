import { QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ApiError } from "./errors";

/**
 * A factory, not a module singleton: client components also render on the server, where a shared
 * client would leak cache between users' requests. Providers creates one per browser tab.
 */
export const makeQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 30_000,
                refetchOnWindowFocus: false,
                retry: (count, err) => (err as ApiError).status >= 500 && count < 2, // never retry 4xx
            },
            mutations: { retry: false },
        },
        queryCache: new QueryCache({
            // A background refetch failed while data is on screen: keep the data, say so once
            onError: (err, query) => {
                if (query.state.data !== undefined) toast.error((err as ApiError).message);
            },
        }),
    });

// Every query/mutation error is an ApiError (lib/api.ts guarantees it): tell TanStack Query's types
declare module "@tanstack/react-query" {
    interface Register {
        defaultError: ApiError;
    }
}
