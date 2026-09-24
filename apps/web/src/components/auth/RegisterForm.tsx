"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { PASSWORD_MIN_LENGTH, registerSchema } from "@repo/types";
import { Button } from "@repo/ui/components/button";
import { Field } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { useRegister } from "@/hooks/auth/useRegister";
import { applyFieldErrors } from "@/lib/forms";
import { FormAlert } from "./FormAlert";
import { PasswordInput } from "./PasswordInput";

type Values = z.input<typeof registerSchema>;

export function RegisterForm() {
    const form = useForm<Values, unknown, z.output<typeof registerSchema>>({
        resolver: zodResolver(registerSchema),
        mode: "onTouched",
        defaultValues: { name: "", email: "", password: "" },
    });
    const registerUser = useRegister();
    const { errors } = form.formState;

    const onSubmit = form.handleSubmit((values) =>
        registerUser.mutate(values, {
            onError: (error) => {
                if (error.code === "EMAIL_TAKEN")
                    form.setError("email", { message: error.message }, { shouldFocus: true });
                else applyFieldErrors(error, form.setError, ["name", "email", "password"]);
            },
        }),
    );
    const err = registerUser.error;
    const formError = err && err.fieldErrors.length === 0 && err.code !== "EMAIL_TAKEN" ? err.message : null;

    return (
        <form onSubmit={onSubmit} noValidate className="grid gap-5">
            <Field label="Name" error={errors.name?.message}>
                {(control) => <Input {...control} autoComplete="name" {...form.register("name")} />}
            </Field>
            <Field label="Email" error={errors.email?.message}>
                {(control) => (
                    <Input {...control} type="email" autoComplete="email" {...form.register("email")} />
                )}
            </Field>
            <Field
                label="Password"
                hint={`At least ${PASSWORD_MIN_LENGTH} characters`}
                error={errors.password?.message}
            >
                {(control) => (
                    <PasswordInput {...control} autoComplete="new-password" {...form.register("password")} />
                )}
            </Field>
            <FormAlert message={formError} />
            <Button type="submit" size="lg" className="w-full" loading={registerUser.isPending}>
                Create account
            </Button>
        </form>
    );
}
