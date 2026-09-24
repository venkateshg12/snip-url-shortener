import { AxiosError, type AxiosResponse } from "axios";
import { describe, expect, it } from "vitest";
import { ApiError, toApiError } from "@/lib/errors";

const withResponse = (status: number, data: unknown) =>
    new AxiosError("request failed", "ERR", undefined, undefined, { status, data } as AxiosResponse);

describe("toApiError", () => {
    it("no response → a network ApiError with human copy", () => {
        const error = toApiError(new AxiosError("Network Error", "ERR_NETWORK"));
        expect(error).toBeInstanceOf(ApiError);
        expect(error).toMatchObject({
            status: 0,
            code: "NETWORK_ERROR",
            message: "Can't reach the server. Check your connection.",
        });
    });

    it("an envelope error → its message and code", () => {
        const error = toApiError(
            withResponse(409, {
                status: "error",
                data: null,
                errors: [{ message: "That alias is already taken", code: "ALIAS_TAKEN" }],
            }),
        );
        expect(error).toMatchObject({
            status: 409,
            message: "That alias is already taken",
            code: "ALIAS_TAKEN",
            fieldErrors: [],
        });
    });

    it("field errors are collected from every error with a path", () => {
        const error = toApiError(
            withResponse(400, {
                status: "error",
                data: null,
                errors: [
                    { path: "url", message: "Enter a full URL", code: "VALIDATION_ERROR" },
                    { path: "customAlias", message: "Use 3–32 letters", code: "VALIDATION_ERROR" },
                ],
            }),
        );
        expect(error.fieldErrors).toEqual([
            { path: "url", message: "Enter a full URL" },
            { path: "customAlias", message: "Use 3–32 letters" },
        ]);
    });

    it("5xx messages are never shown raw", () => {
        const error = toApiError(
            withResponse(500, {
                status: "error",
                data: null,
                errors: [{ message: "db exploded at line 42" }],
            }),
        );
        expect(error.message).toBe("Something went wrong. Try again.");
    });
});
