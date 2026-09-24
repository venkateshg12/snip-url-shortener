import { randomBytes } from "node:crypto";

// Prints a fresh SHORTCODE_KEYS value. Changing keys on a live system changes every future code
// (existing codes keep working: they're stored), so pick once per environment.
const M = 62n ** 7n;
const random = (): bigint => BigInt(`0x${randomBytes(8).toString("hex")}`) % M;

function multiplier(): bigint {
    for (;;) {
        const p = M / 2n + (random() % (M / 2n)); // in [M/2, M): large multipliers spread digits well
        if (p % 2n === 1n && p % 31n !== 0n) return p;
    }
}

console.log(`SHORTCODE_KEYS=${[multiplier(), random(), multiplier(), random()].join(",")}`);
