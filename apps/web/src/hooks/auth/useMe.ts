import { useQuery } from "@tanstack/react-query";
import { getMe } from "@/api/auth";
import { queryKeys } from "@/lib/queryKeys";

/** Who's logged in. A 401 just means "guest", so no retries. AuthLoader syncs it into the store. */
export const useMe = () =>
    useQuery({ queryKey: queryKeys.me, queryFn: getMe, retry: false, staleTime: Infinity });
