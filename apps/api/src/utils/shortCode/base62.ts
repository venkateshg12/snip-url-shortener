export const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const CODE_LENGTH = 7;
/** The size of the 7-character code space: 62^7 = 3,521,614,606,208. */
export const CODE_SPACE = 62n ** BigInt(CODE_LENGTH);

export function encodeBase62(n: bigint, length = CODE_LENGTH): string {
    if (n < 0n) throw new RangeError("encodeBase62: negative input");
    let out = "";
    do {
        out = ALPHABET[Number(n % 62n)] + out;
        n /= 62n;
    } while (n > 0n);
    return out.padStart(length, ALPHABET[0]);
}

export function decodeBase62(code: string): bigint {
    let n = 0n;
    for (const char of code) {
        const digit = ALPHABET.indexOf(char);
        if (digit === -1) throw new RangeError(`decodeBase62: invalid character "${char}"`);
        n = n * 62n + BigInt(digit);
    }
    return n;
}
