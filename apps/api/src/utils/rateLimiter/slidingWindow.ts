/**
 * Sliding-window counter: estimate = previous × (1 − elapsed fraction of current) + current.
 * Two integers per key, and no double burst at the window boundary (unlike a fixed window).
 */
export function windowPosition(now: number, windowMs: number) {
    const index = Math.floor(now / windowMs);
    const elapsed = (now % windowMs) / windowMs;
    return { index, elapsed, windowEnd: (index + 1) * windowMs };
}

export const estimate = (previous: number, current: number, elapsed: number) =>
    previous * (1 - elapsed) + current;

/**
 * KEYS[1] current window, KEYS[2] previous window, KEYS[3] block key: all under one {hash tag},
 * so the script touches a single Redis Cluster slot. Key names are never built inside Lua.
 * ARGV: limit, window ms, elapsed fraction (0..1), block ms (0 = no block).
 * Returns { allowed (0|1), current count, block pttl ms (or -1), previous count }.
 */
export const SLIDING_WINDOW_LUA = `
local blocked = redis.call("PTTL", KEYS[3])
if blocked > 0 then
  return {0, 0, blocked, 0}
end
local current  = tonumber(redis.call("GET", KEYS[1]) or "0")
local previous = tonumber(redis.call("GET", KEYS[2]) or "0")
local weight   = 1 - tonumber(ARGV[3])
if previous * weight + current >= tonumber(ARGV[1]) then
  local blockMs = tonumber(ARGV[4])
  if blockMs > 0 then
    redis.call("SET", KEYS[3], "1", "PX", blockMs)
    return {0, current, blockMs, previous}
  end
  return {0, current, -1, previous}
end
current = redis.call("INCR", KEYS[1])
if current == 1 then redis.call("PEXPIRE", KEYS[1], tonumber(ARGV[2]) * 2) end
return {1, current, -1, previous}
`;
