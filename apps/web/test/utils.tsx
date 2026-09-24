import { QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { makeQueryClient } from "@/lib/queryClient";

export function renderWithQuery(ui: React.ReactElement) {
    const client = makeQueryClient();
    return { client, ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>) };
}
