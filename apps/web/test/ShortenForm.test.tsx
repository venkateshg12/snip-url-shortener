import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ShortenForm } from "@/components/urls/ShortenForm";
import { API } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import { renderWithQuery } from "./utils";

const dto = {
    shortCode: "abc1234",
    shortUrl: "http://api.test/abc1234",
    longUrl: "https://example.com/page",
    isCustomAlias: false,
    status: "active",
    expiresAt: null,
    clickCount: 0,
    createdAt: new Date().toISOString(),
};

describe("ShortenForm", () => {
    let mock: MockAdapter;
    beforeEach(() => {
        mock = new MockAdapter(API);
        useAuthStore.setState({ status: "guest", user: null, guestReason: "anonymous" });
    });
    afterEach(() => mock.restore());

    it("validates on the client with a human message, and keeps the value", async () => {
        renderWithQuery(<ShortenForm />);
        const input = screen.getByLabelText("Destination URL");
        await userEvent.type(input, "not a url");
        await userEvent.click(screen.getByRole("button", { name: "Create short link" }));
        expect(await screen.findByText("Enter a full URL, like https://example.com")).toBeInTheDocument();
        expect(input).toHaveAttribute("aria-invalid", "true");
        expect(input).toHaveValue("not a url");
    });

    it("adds https:// to a scheme-less URL on blur", async () => {
        renderWithQuery(<ShortenForm />);
        const input = screen.getByLabelText("Destination URL");
        await userEvent.type(input, "example.com/page");
        await userEvent.tab();
        expect(input).toHaveValue("https://example.com/page");
    });

    it("shows the result with Copy focused", async () => {
        mock.onPost("/urls").reply(201, { status: "success", data: dto });
        renderWithQuery(<ShortenForm />);
        await userEvent.type(screen.getByLabelText("Destination URL"), "https://example.com/page");
        await userEvent.click(screen.getByRole("button", { name: "Create short link" }));
        expect(await screen.findByText("Your link is ready")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Copy api.test/abc1234" })).toHaveFocus();
    });

    it("a 400 with field errors lands on the right input", async () => {
        mock.onPost("/urls").reply(400, {
            status: "error",
            data: null,
            errors: [
                {
                    path: "url",
                    message: "That URL is already a short link from this service",
                    code: "VALIDATION_ERROR",
                },
            ],
        });
        renderWithQuery(<ShortenForm />);
        await userEvent.type(screen.getByLabelText("Destination URL"), "https://example.com/page");
        await userEvent.click(screen.getByRole("button", { name: "Create short link" }));
        expect(
            await screen.findByText("That URL is already a short link from this service"),
        ).toBeInTheDocument();
        expect(screen.getByLabelText("Destination URL")).toHaveAttribute("aria-invalid", "true");
    });

    it("a 409 on the alias shows inline, next to the alias", async () => {
        useAuthStore.setState({
            status: "authenticated",
            user: { id: "1", email: "a@b.c", name: "A", createdAt: "" },
            guestReason: null,
        });
        mock.onPost("/urls").reply(409, {
            status: "error",
            data: null,
            errors: [{ message: "That alias is already taken", code: "ALIAS_TAKEN" }],
        });
        renderWithQuery(<ShortenForm />);
        await userEvent.type(screen.getByLabelText("Destination URL"), "https://example.com/page");
        await userEvent.click(screen.getByRole("button", { name: /More options/ }));
        await userEvent.type(screen.getByLabelText(/Custom alias/), "launch");
        await userEvent.click(screen.getByRole("button", { name: "Create short link" }));
        const alias = screen.getByLabelText(/Custom alias/);
        await waitFor(() => expect(alias).toHaveAttribute("aria-invalid", "true"));
        expect(screen.getByText("That alias is already taken")).toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument(); // not a form-level banner
        expect(alias).toHaveValue("launch");
    });
});
