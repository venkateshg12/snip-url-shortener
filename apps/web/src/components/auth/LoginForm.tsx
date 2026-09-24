"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema } from "@repo/types";
import { Button } from "@repo/ui/components/button";
import { Field } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { useLogin } from "@/hooks/auth/useLogin";
import { applyFieldErrors } from "@/lib/forms";
import { FormAlert } from "./FormAlert";
import { PasswordInput } from "./PasswordInput";

type Values = z.input<typeof loginSchema>;

export function LoginForm() {
    const form = useForm<Values, unknown, z.output<typeof loginSchema>>({
        resolver: zodResolver(loginSchema),
        mode: "onTouched",
        defaultValues: { email: "", password: "" },
    });
    const login = useLogin();
    const { errors } = form.formState;

    const onSubmit = form.handleSubmit((values) =>
        login.mutate(values, {
            onError: (error) => applyFieldErrors(error, form.setError, ["email", "password"]),
        }),
    );
    const formError = login.error && login.error.fieldErrors.length === 0 ? login.error.message : null;

    return (
        <form onSubmit={onSubmit} noValidate className="grid gap-5">
            <Field label="Email" error={errors.email?.message}>
                {(control) => (
                    <Input {...control} type="email" autoComplete="email" {...form.register("email")} />
                )}
            </Field>
            <Field label="Password" error={errors.password?.message}>
                {(control) => (
                    <PasswordInput
                        {...control}
                        autoComplete="current-password"
                        {...form.register("password")}
                    />
                )}
            </Field>
            <FormAlert message={formError} />
            <Button type="submit" size="lg" className="w-full" loading={login.isPending}>
                Log in
            </Button>
        </form>
    );
}
