import { RESERVED_CODES } from "../../constants/reservedCodes";

/** Anything the redirect will look up; everything else is rejected before touching Redis or Postgres. */
export const SHORT_CODE_PATTERN = /^[A-Za-z0-9_-]{3,32}$/;

export const isValidShortCode = (code: string) => SHORT_CODE_PATTERN.test(code);
export const isReserved = (alias: string) => RESERVED_CODES.has(alias.toLowerCase());
