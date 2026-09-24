import { z } from "zod";

// bcrypt only reads the first 72 bytes of a password; longer ones would be silently truncated
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address").max(254));

export const registerSchema = z.object({
    name: z.string().trim().min(1, "Enter your name").max(100, "Names can be at most 100 characters"),
    email,
    password: z
        .string()
        .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
        .max(PASSWORD_MAX_LENGTH, `Use at most ${PASSWORD_MAX_LENGTH} characters`),
});
export type RegisterInput = z.input<typeof registerSchema>;

export const loginSchema = z.object({
    email,
    password: z.string().min(1, "Enter your password").max(PASSWORD_MAX_LENGTH),
});
export type LoginInput = z.input<typeof loginSchema>;

export type UserDto = { id: string; email: string; name: string; createdAt: string };
