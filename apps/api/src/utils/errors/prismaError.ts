import { Prisma } from "../../generated/prisma/client";

/** P2002 = unique constraint violated, P2025 = the record to update/delete wasn't found. */
export type PrismaErrorCode = "P2002" | "P2025";

export function isPrismaError(
    error: unknown,
    code: PrismaErrorCode,
): error is Prisma.PrismaClientKnownRequestError {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}
