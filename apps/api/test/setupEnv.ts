import { testDatabaseUrl } from "./testEnv";

// Runs in each worker before any test file imports src/, so env.ts sees the test settings.
process.env.DATABASE_URL = testDatabaseUrl();
process.env.NODE_ENV = "test";
// Real-looking hosts: URL validation (rightly) rejects bare "localhost" as a link target
process.env.SHORT_BASE_URL = "http://sho.rt.test";
process.env.WEB_URL = "http://app.sho.rt.test";
// A dedicated Redis database index for tests, flushed by resetState()
process.env.REDIS_CACHE_URL = "redis://localhost:6380/1";
process.env.REDIS_QUEUE_URL = "redis://localhost:6379/1";
// bcrypt at cost 4 in tests: the security comes from the production cost, not from slow tests
process.env.BCRYPT_ROUNDS = "4";
// Bursts of 50 concurrent requests on a busy dev machine can exceed 50ms; tests assert behaviour, not latency
process.env.CACHE_COMMAND_TIMEOUT_MS = "1000";
