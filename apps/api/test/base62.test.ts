import { describe, expect, it } from "vitest";
import { CODE_SPACE, decodeBase62, encodeBase62 } from "../src/utils/shortCode";

describe("base62", () => {
    it.each([0n, 1n, 61n, 62n, 3843n, 3844n, CODE_SPACE - 1n])("round-trips %s", (n) => {
        const code = encodeBase62(n);
        expect(code).toHaveLength(7);
        expect(decodeBase62(code)).toBe(n);
    });

    it("pads and orders digits", () => {
        expect(encodeBase62(0n)).toBe("0000000");
        expect(encodeBase62(61n)).toBe("000000Z");
        expect(encodeBase62(62n)).toBe("0000010");
    });

    it("rejects negatives and foreign characters", () => {
        expect(() => encodeBase62(-1n)).toThrow(RangeError);
        expect(() => decodeBase62("ab-c")).toThrow(RangeError);
    });
});
