import bcrypt from "bcrypt";
import { BCRYPT_ROUNDS } from "../../constants/env";

export const hashPassword = (password: string) => bcrypt.hash(password, BCRYPT_ROUNDS);

export const verifyPassword = (password: string, hash: string) =>
    bcrypt.compare(password, hash).catch(() => false);

// A real hash of nothing in particular, for unknown emails: comparing against it takes as long as a
// real check, so response times don't reveal which emails are registered.
const dummyHash = bcrypt.hash("not-a-real-password", BCRYPT_ROUNDS);
export const burnPasswordCheck = async (password: string) => {
    await bcrypt.compare(password, await dummyHash);
    return false as const;
};
