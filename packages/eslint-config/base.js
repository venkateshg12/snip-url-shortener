import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import onlyWarn from "eslint-plugin-only-warn";
import turboPlugin from "eslint-plugin-turbo";
import tseslint from "typescript-eslint";

/**
 * Shared ESLint config: every package extends this.
 * `only-warn` turns errors into warnings; packages run with --max-warnings 0, so CI still fails.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export const config = [
    js.configs.recommended,
    eslintConfigPrettier,
    ...tseslint.configs.recommended,
    {
        plugins: { turbo: turboPlugin },
        rules: { "turbo/no-undeclared-env-vars": "warn" },
    },
    {
        rules: {
            "@typescript-eslint/no-unused-vars": [
                "error",
                { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
            ],
        },
    },
    { plugins: { onlyWarn } },
    { ignores: ["dist/**", "coverage/**"] },
];
