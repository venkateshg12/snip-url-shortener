import dotenv from "dotenv";

// .env fills in whatever the environment doesn't already set (tests set DATABASE_URL first).
dotenv.config({ quiet: true });

const getEnv = (key: string, defaultValue?: string) => {
    const value = process.env[key] || defaultValue;

    if (value === undefined) {
        throw new Error(`Missing environment variable ${key}`);
    }

    return value;
};

/** A whole number within [min, max]; anything else stops the boot, naming the variable. */
const getNumberEnv = (key: string, defaultValue: number, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) => {
    const raw = getEnv(key, String(defaultValue));
    const value = Number(raw);

    if (!Number.isInteger(value) || value < min || value > max) {
        throw new Error(`Environment variable ${key} must be a whole number between ${min} and ${max} (got "${raw}")`);
    }

    return value;
};

/** "true"/"false" (also "1"/"0"); anything else stops the boot. */
const getBooleanEnv = (key: string, defaultValue: boolean) => {
    const raw = getEnv(key, String(defaultValue)).toLowerCase();

    if (!["true", "false", "1", "0"].includes(raw)) {
        throw new Error(`Environment variable ${key} must be "true" or "false" (got "${raw}")`);
    }

    return raw === "true" || raw === "1";
};

/** A URL whose scheme is one of `protocols`. */
const getUrlEnv = (key: string, protocols: string[], defaultValue?: string) => {
    const raw = getEnv(key, defaultValue);
    let url: URL;
    try {
        url = new URL(raw);
    } catch {
        throw new Error(`Environment variable ${key} must be a URL (got "${raw}")`);
    }

    if (!protocols.includes(url.protocol.replace(":", ""))) {
        throw new Error(`Environment variable ${key} must start with ${protocols.map((p) => `${p}://`).join(" or ")}`);
    }

    return raw;
};

const oneOf = <T extends string>(key: string, allowed: readonly T[], defaultValue: T): T => {
    const value = getEnv(key, defaultValue);

    if (!allowed.includes(value as T)) {
        throw new Error(`Environment variable ${key} must be one of ${allowed.join(", ")} (got "${value}")`);
    }

    return value as T;
};

// ---- Runtime --------------------------------------------------------------------------------------

export const NODE_ENV = oneOf("NODE_ENV", ["development", "test", "production"] as const, "development");
export const PORT = getNumberEnv("PORT", 4000, { max: 65535 });
export const LOG_LEVEL = oneOf("LOG_LEVEL", ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const, "info");

// ---- Database -------------------------------------------------------------------------------------

export const DATABASE_URL = getUrlEnv("DATABASE_URL", ["postgres", "postgresql"]);
// Connections per process: (API instances + workers) × this must stay under Postgres' max_connections
export const DB_POOL_MAX = getNumberEnv("DB_POOL_MAX", 10);

// ---- HTTP -----------------------------------------------------------------------------------------

// Browser origins allowed to call the JSON API with cookies (comma-separated)
export const CORS_ORIGINS = getEnv("CORS_ORIGINS", "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

/*
  Express "trust proxy": a hop count ("2") or names/CIDRs ("loopback, uniquelocal"). It decides what
  req.ip is, and the rate limiter keys on req.ip, so a wrong value lets one client exhaust everyone's
  limit (or spoof its IP with X-Forwarded-For).
 */
const TRUSTED_PROXIES = getEnv("TRUSTED_PROXIES", "loopback");
export const TRUST_PROXY: number | string = /^\d+$/.test(TRUSTED_PROXIES) ? Number(TRUSTED_PROXIES) : TRUSTED_PROXIES;

// Short links are served from here (the API itself, or a proxy in front of it)
export const SHORT_BASE_URL = getUrlEnv("SHORT_BASE_URL", ["http", "https"], "http://localhost:4000");
// The website: unknown and expired links redirect here
export const WEB_URL = getUrlEnv("WEB_URL", ["http", "https"], "http://localhost:3000");

// ---- Short codes ----------------------------------------------------------------------------------

/*
  The four permutation keys "P1,C1,P2,C2". Codes are affine maps x ↦ (x·P + C) mod 62⁷, which are
  one-to-one only when P shares no factor with 62⁷ = 2⁷ · 31⁷: P must be odd and not a multiple of 31.
  Any other value would make codes collide, so the boot refuses it.
  Generate with: pnpm --filter api gen:shortcode-keys
 */
const CODE_SPACE = 62n ** 7n;

export function parseShortcodeKeys(raw: string): readonly [bigint, bigint, bigint, bigint] {
    if (!/^\d+,\d+,\d+,\d+$/.test(raw)) {
        throw new Error("SHORTCODE_KEYS must be four integers: P1,C1,P2,C2");
    }
    const keys = raw.split(",").map(BigInt) as [bigint, bigint, bigint, bigint];

    if (!keys.every((key) => key > 0n && key < CODE_SPACE)) {
        throw new Error("SHORTCODE_KEYS: every key must be between 1 and 62^7 - 1");
    }
    if (![keys[0], keys[2]].every((p) => p % 2n === 1n && p % 31n !== 0n)) {
        throw new Error("SHORTCODE_KEYS: P1 and P2 must be odd and not multiples of 31");
    }

    return keys;
}

export const SHORTCODE_KEYS = parseShortcodeKeys(getEnv("SHORTCODE_KEYS"));

// ---- Redis ----------------------------------------------------------------------------------------

// Two instances with opposite eviction policies (see docker-compose.yml): the cache must be allowed to
// evict, which the queue / rate-limit instance must not.
export const REDIS_CACHE_URL = getUrlEnv("REDIS_CACHE_URL", ["redis", "rediss"], "redis://localhost:6380");
export const REDIS_QUEUE_URL = getUrlEnv("REDIS_QUEUE_URL", ["redis", "rediss"], "redis://localhost:6379");
// Emergency off-switch: "false" serves every redirect straight from Postgres
export const CACHE_ENABLED = getBooleanEnv("CACHE_ENABLED", true);
// A Redis slower than this is useless for redirects: the command fails and the breaker counts it
export const CACHE_COMMAND_TIMEOUT_MS = getNumberEnv("CACHE_COMMAND_TIMEOUT_MS", 50);

// ---- Auth -----------------------------------------------------------------------------------------

export const JWT_SECRET = getEnv("JWT_SECRET");
export const JWT_REFRESH_SECRET = getEnv("JWT_REFRESH_SECRET");
// Keys the daily visitor hash: without a secret, a hash could be reversed by hashing every IPv4
export const VISITOR_HASH_SECRET = getEnv("VISITOR_HASH_SECRET");

/*
  HMAC secrets are only as strong as their entropy: a short or guessable one can be brute-forced
  offline from any single token, after which anyone can mint tokens for any user. The two JWT
  secrets must also differ, or a refresh token would verify as an access token.
 */
const MIN_SECRET_LENGTH = 32;

for (const [name, value] of [
    ["JWT_SECRET", JWT_SECRET],
    ["JWT_REFRESH_SECRET", JWT_REFRESH_SECRET],
    ["VISITOR_HASH_SECRET", VISITOR_HASH_SECRET],
] as const) {
    if (value.length < MIN_SECRET_LENGTH) {
        throw new Error(
            `${name} must be at least ${MIN_SECRET_LENGTH} characters (generate with: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))")`,
        );
    }
}

if (JWT_SECRET === JWT_REFRESH_SECRET) {
    throw new Error("JWT_SECRET and JWT_REFRESH_SECRET must be different values");
}

export const BCRYPT_ROUNDS = getNumberEnv("BCRYPT_ROUNDS", 12, { min: 4, max: 15 });
// Set in production when web and API share a parent domain (app.example.com / example.com)
export const COOKIE_DOMAIN = getEnv("COOKIE_DOMAIN", "") || undefined;

// ---- Operations -----------------------------------------------------------------------------------

// Prometheus /metrics, on a port nginx never exposes (the worker uses METRICS_PORT + 1)
export const METRICS_PORT = getNumberEnv("METRICS_PORT", 9100, { max: 65534 });

// The BullMQ dashboard shows job payloads. It stays off unless both are set, is Basic-auth
// protected, and never runs in production.
export const BULL_BOARD_USER = getEnv("BULL_BOARD_USER", "") || undefined;
export const BULL_BOARD_PASSWORD = getEnv("BULL_BOARD_PASSWORD", "") || undefined;
