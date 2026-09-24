"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ALIAS_MAX_LENGTH, createUrlSchema, type UrlDto } from "@repo/types";
import { Button } from "@repo/ui/components/button";
import { Field } from "@repo/ui/components/field";
import { Input, PrefixedInput } from "@repo/ui/components/input";
import { SegmentedControl } from "@repo/ui/components/segmented-control";
import { cn } from "@repo/ui/lib/utils";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";
import { FormAlert } from "@/components/auth/FormAlert";
import { useCreateShortUrl } from "@/hooks/urls/useCreateShortUrl";
import { applyFieldErrors } from "@/lib/forms";
import { SHORT_DOMAIN_PREFIX } from "@/lib/shortDomain";
import { useAuthStore } from "@/store/auth.store";
import { ShortLinkResult } from "./ShortLinkResult";

type Values = z.input<typeof createUrlSchema>;

const EXPIRY_CHOICES = [
    { value: "never", label: "Never" },
    { value: "1", label: "1 day" },
    { value: "7", label: "7 days" },
    { value: "30", label: "30 days" },
    { value: "custom", label: "Custom" },
] as const;
type ExpiryChoice = (typeof EXPIRY_CHOICES)[number]["value"];

/** "example.com/page" → "https://example.com/page": forgive the missing scheme instead of failing. */
const withScheme = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || /^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
    return /^[^\s/]+\.[^\s/]+/.test(trimmed) ? `https://${trimmed}` : trimmed;
};

const optionalString = (v: string) => (v.trim() === "" ? undefined : v);

export const URL_INPUT_ID = "shorten-url";

/** The product's core action. One field and one button; options only when they apply. */
export function ShortenForm({
    variant = "hero",
    onCreated,
}: {
    variant?: "hero" | "compact";
    onCreated?: (link: UrlDto) => void;
}) {
    const loggedIn = useAuthStore((s) => s.status === "authenticated");
    const [showOptions, setShowOptions] = useState(false);
    const [expiry, setExpiry] = useState<ExpiryChoice>("never");
    const [result, setResult] = useState<UrlDto | null>(null);
    const optionsId = useId();
    const create = useCreateShortUrl();

    const form = useForm<Values, unknown, z.output<typeof createUrlSchema>>({
        resolver: zodResolver(createUrlSchema),
        mode: "onTouched",
        defaultValues: { url: "", customAlias: undefined, expiresAt: undefined },
    });
    const { errors } = form.formState;
    const alias = useWatch({ control: form.control, name: "customAlias" }) ?? "";

    const pickExpiry = (choice: ExpiryChoice) => {
        setExpiry(choice);
        if (choice === "never" || choice === "custom") {
            form.setValue("expiresAt", undefined);
        } else {
            form.setValue("expiresAt", new Date(Date.now() + Number(choice) * 86_400_000).toISOString());
        }
    };

    const onSubmit = form.handleSubmit((values) =>
        create.mutate(
            { url: values.url, customAlias: values.customAlias, expiresAt: values.expiresAt?.toISOString() },
            {
                onSuccess: (link) => {
                    setResult(link);
                    form.reset();
                    setExpiry("never");
                    onCreated?.(link);
                },
                onError: (error) => {
                    // 409 belongs next to the alias, never in a toast. Values are kept either way.
                    if (error.code === "ALIAS_TAKEN" || error.code === "RESERVED_ALIAS") {
                        setShowOptions(true);
                        form.setError("customAlias", { message: error.message }, { shouldFocus: true });
                    } else {
                        applyFieldErrors(error, form.setError, ["url", "customAlias", "expiresAt"]);
                    }
                },
            },
        ),
    );

    const fieldErrorCodes = ["ALIAS_TAKEN", "RESERVED_ALIAS"];
    const formError =
        create.error &&
        create.error.fieldErrors.length === 0 &&
        !fieldErrorCodes.includes(create.error.code ?? "")
            ? create.error.message
            : null;
    const hero = variant === "hero";
    const optionsOpen = loggedIn && (showOptions || Boolean(alias) || expiry !== "never");

    return (
        <div className="grid grid-cols-1 gap-4">
            <form
                onSubmit={onSubmit}
                noValidate
                aria-label="Create short link"
                className="grid gap-4 text-left"
            >
                <Field label="Destination URL" id={URL_INPUT_ID} error={errors.url?.message}>
                    {(control) => (
                        <div className={cn("flex flex-col gap-3", hero ? "md:flex-row" : "sm:flex-row")}>
                            <Input
                                {...control}
                                type="url"
                                inputMode="url"
                                autoComplete="url"
                                placeholder="https://example.com/a-long-link"
                                className={cn(hero && "md:h-12")}
                                {...form.register("url", {
                                    onBlur: (e) => form.setValue("url", withScheme(e.target.value)),
                                })}
                            />
                            <Button
                                type="submit"
                                size={hero ? "lg" : "default"}
                                loading={create.isPending}
                                className="shrink-0"
                            >
                                Create short link
                            </Button>
                        </div>
                    )}
                </Field>

                {loggedIn ? (
                    <div className="grid gap-4">
                        <button
                            type="button"
                            aria-expanded={optionsOpen}
                            aria-controls={optionsId}
                            onClick={() => setShowOptions((v) => !v)}
                            className="inline-flex min-h-11 w-fit cursor-pointer items-center gap-1.5 text-[15px] text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        >
                            More options
                            <ChevronDown
                                className={cn(
                                    "size-4 transition-transform duration-150",
                                    optionsOpen && "rotate-180",
                                )}
                                aria-hidden="true"
                            />
                        </button>
                        <div id={optionsId} hidden={!optionsOpen} className="grid gap-5 md:grid-cols-2">
                            <Field
                                label="Custom alias"
                                optional
                                hint="Letters, numbers, - or _"
                                aside={alias ? `${alias.length}/${ALIAS_MAX_LENGTH}` : undefined}
                                error={errors.customAlias?.message}
                            >
                                {(control) => (
                                    <PrefixedInput
                                        {...control}
                                        prefix={SHORT_DOMAIN_PREFIX}
                                        maxLength={ALIAS_MAX_LENGTH}
                                        autoCapitalize="none"
                                        spellCheck={false}
                                        {...form.register("customAlias", { setValueAs: optionalString })}
                                    />
                                )}
                            </Field>
                            <Field label="Expires" optional error={errors.expiresAt?.message}>
                                {(control) => (
                                    <div className="grid gap-3">
                                        <SegmentedControl
                                            label="Expires"
                                            value={expiry}
                                            onValueChange={pickExpiry}
                                            options={EXPIRY_CHOICES}
                                            className="w-fit max-w-full overflow-x-auto"
                                        />
                                        {expiry === "custom" && (
                                            <Input
                                                {...control}
                                                type="datetime-local"
                                                aria-label="Expiry date and time"
                                                {...form.register("expiresAt", {
                                                    setValueAs: optionalString,
                                                })}
                                            />
                                        )}
                                    </div>
                                )}
                            </Field>
                        </div>
                    </div>
                ) : (
                    <p className="text-[15px] text-muted-foreground">
                        <Link href="/login" className="text-foreground underline underline-offset-4">
                            Log in
                        </Link>{" "}
                        to choose an alias, set an expiry and see analytics.
                    </p>
                )}
                <FormAlert message={formError} />
            </form>
            {result && <ShortLinkResult key={result.shortCode} link={result} showAnalytics={loggedIn} />}
        </div>
    );
}
