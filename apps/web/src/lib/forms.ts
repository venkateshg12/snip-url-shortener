import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import type { ApiError } from "./errors";

/** Puts the API's 400 field errors on the matching inputs. Returns true if any matched. */
export function applyFieldErrors<T extends FieldValues>(
    error: ApiError,
    setError: UseFormSetError<T>,
    fields: readonly Path<T>[],
) {
    let applied = false;
    for (const fieldError of error.fieldErrors) {
        const field = fields.find((f) => f === fieldError.path);
        if (field) {
            setError(field, { type: "server", message: fieldError.message }, { shouldFocus: !applied });
            applied = true;
        }
    }
    return applied;
}
