import { API_URL } from "@/constants/env";

/** "localhost:4000/" in development, "snip.to/" in production: the prefix shown before an alias. */
export const SHORT_DOMAIN_PREFIX = `${new URL(API_URL).host}/`;
