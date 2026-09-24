import { z } from "zod";

// NEXT_PUBLIC_* values are inlined at build time, so each must be read by its literal name.
const schema = z.object({
    NEXT_PUBLIC_API_URL: z.url("NEXT_PUBLIC_API_URL must be the API's base URL, e.g. http://localhost:4000"),
});

export const env = schema.parse({ NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL });
export const API_URL = env.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
