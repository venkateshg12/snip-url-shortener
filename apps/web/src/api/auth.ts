import type { LoginInput, RegisterInput, UserDto } from "@repo/types";
import { API, unwrap } from "@/lib/api";

export const getMe = async () => (await unwrap<{ user: UserDto }>(API.get("/auth/me"))).data.user;
export const login = async (input: LoginInput) =>
    (await unwrap<{ user: UserDto }>(API.post("/auth/login", input))).data.user;
export const register = async (input: RegisterInput) =>
    (await unwrap<{ user: UserDto }>(API.post("/auth/register", input))).data.user;
export const logout = async () => {
    await API.post("/auth/logout");
};
