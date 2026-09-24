import type { CreateUrlInput, PaginationMeta, UpdateUrlInput, UrlDto } from "@repo/types";
import { API, unwrap } from "@/lib/api";

export const createShortUrl = async (input: CreateUrlInput) =>
    (await unwrap<UrlDto>(API.post("/urls", input))).data;

export async function listMyUrls(page: number, limit: number) {
    const { data, meta } = await unwrap<UrlDto[]>(API.get("/urls", { params: { page, limit } }));
    return { urls: data, meta: meta as PaginationMeta };
}

export const getUrl = async (code: string) =>
    (await unwrap<UrlDto>(API.get(`/urls/${encodeURIComponent(code)}`))).data;
export const updateUrl = async (code: string, patch: UpdateUrlInput) =>
    (await unwrap<UrlDto>(API.patch(`/urls/${encodeURIComponent(code)}`, patch))).data;
export const deleteUrl = async (code: string) => {
    await API.delete(`/urls/${encodeURIComponent(code)}`);
};
