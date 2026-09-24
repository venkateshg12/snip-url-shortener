import { SHORTCODE_KEYS } from "../../constants/env";
import { encodeBase62 } from "./base62";
import { permute } from "./permute";

export * from "./base62";
export * from "./permute";
export * from "./validate";

/** id (from the block allocator) → a 7-character code that looks random but can't collide. */
export const generateShortCode = (id: bigint) => encodeBase62(permute(id, SHORTCODE_KEYS));
