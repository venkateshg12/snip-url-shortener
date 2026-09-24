import { describe, expect, it } from "vitest";
import { SHORTCODE_KEYS } from "../src/constants/env";
import { CODE_SPACE, generateShortCode, permute, reverseDigits } from "../src/utils/shortCode";

const gcd = (a: bigint, b: bigint): bigint => (b === 0n ? a : gcd(b, a % b));

describe("permutation", () => {
    it("uses multipliers coprime with 62^7", () => {
        const [p1, , p2] = SHORTCODE_KEYS;
        expect(gcd(p1, CODE_SPACE)).toBe(1n);
        expect(gcd(p2, CODE_SPACE)).toBe(1n);
    });

    it("reverseDigits is its own inverse", () => {
        for (const x of [0n, 1n, 62n, 123456789n, CODE_SPACE - 1n])
            expect(reverseDigits(reverseDigits(x))).toBe(x);
    });

    it("the first 1,000,000 ids give 1,000,000 distinct 7-character codes", () => {
        const seen = new Set<string>();
        for (let id = 1n; id <= 1_000_000n; id++) seen.add(generateShortCode(id));
        expect(seen.size).toBe(1_000_000);
        for (const code of [...seen].slice(0, 1000)) expect(code).toMatch(/^[0-9a-zA-Z]{7}$/);
    }, 60_000);

    it("consecutive ids don't produce visibly sequential codes", () => {
        const codes = [1n, 2n, 3n, 4n].map(generateShortCode);
        const sharedPrefix = codes.every((c) => c.slice(0, 3) === codes[0]!.slice(0, 3));
        expect(sharedPrefix).toBe(false);
    });

    it("rejects ids outside the code space", () => {
        expect(() => permute(CODE_SPACE, SHORTCODE_KEYS)).toThrow(RangeError);
    });

});
