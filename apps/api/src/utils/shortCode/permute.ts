import { CODE_LENGTH, CODE_SPACE as M } from "./base62";

export type PermutationKeys = readonly [p1: bigint, c1: bigint, p2: bigint, c2: bigint];

// x ↦ (x·p + c) mod M is a bijection on [0, M) whenever gcd(p, M) = 1 (M = 2^7 · 31^7).
const affine = (x: bigint, p: bigint, c: bigint) => (x * p + c) % M;

/** Reverses the 7 base-62 digits of x: also a bijection on [0, M). */
export function reverseDigits(x: bigint): bigint {
    let r = 0n;
    for (let i = 0; i < CODE_LENGTH; i++) {
        r = r * 62n + (x % 62n);
        x /= 62n;
    }
    return r;
}

/**
 * affine → reverse digits → affine. A composition of bijections is a bijection, so distinct ids
 * always give distinct values below 62^7, and therefore distinct 7-character codes.
 */
export function permute(id: bigint, [p1, c1, p2, c2]: PermutationKeys): bigint {
    if (id < 0n || id >= M) throw new RangeError("permute: id outside the code space");
    return affine(reverseDigits(affine(id, p1, c1)), p2, c2);
}
