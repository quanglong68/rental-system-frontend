import { apiFetch } from "./client";
import { clearSession, getRefreshToken, setSession } from "./token";
import type { LoginResponse, MeResponse, RegisterResponse, Role, User } from "./types";

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

/** roles BE -> Role FE (ưu tiên ADMIN > QUAN_LY > KY_THUAT > SALE). */
export function mapRole(accountType: string, roles: string[] | undefined): Role {
  const set = new Set((roles ?? []).map((r) => r.toUpperCase()));
  if (set.has("ADMIN") || accountType === "ADMIN") return "ADMIN";
  if (set.has("QUAN_LY")) return "QUAN_LY";
  if (set.has("KY_THUAT")) return "KY_THUAT";
  if (set.has("SALE")) return "SALE";
  return "CUSTOMER";
}

export function toUser(username: string, accountType: string, roles: string[] | undefined, fullName?: string): User {
  return { sub: username, fullName: fullName?.trim() || username, role: mapRole(accountType, roles) };
}

export type RegisterInput = { fullName: string; username: string; password: string };

/**
 * Đăng ký CUSTOMER (BE 201). BE yêu cầu username là email/SĐT và trùng
 * email/phone nên suy email/phone từ username trước khi gửi.
 */
export async function register(input: RegisterInput): Promise<RegisterResponse> {
  const username = input.username.trim().replace(/\s/g, "");
  const email = isEmail(username) ? username : undefined;
  const phone = email ? undefined : username;
  return apiFetch<RegisterResponse>("/api/v1/auth/register", {
    method: "POST",
    body: { username, password: input.password, fullName: input.fullName.trim(), email, phone },
  });
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  const res = await apiFetch<LoginResponse>("/api/v1/auth/login", {
    method: "POST",
    body: { username: username.trim(), password },
  });
  setSession(res.accessToken, res.refreshToken);
  return res;
}

export async function refresh(): Promise<LoginResponse> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new Error("Phiên đăng nhập đã hết. Vui lòng đăng nhập lại.");
  const res = await apiFetch<LoginResponse>("/api/v1/auth/refresh", {
    method: "POST",
    body: { refreshToken },
    noRetry: true,
  });
  setSession(res.accessToken, res.refreshToken);
  return res;
}

export async function fetchMe(): Promise<MeResponse> {
  return apiFetch<MeResponse>("/api/v1/auth/me", { method: "GET" });
}

/** Logout idempotent: gọi API nếu còn refreshToken, luôn clear phiên local. */
export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  try {
    if (refreshToken) {
      await apiFetch<void>("/api/v1/auth/logout", {
        method: "POST",
        body: { refreshToken },
        noRetry: true,
      });
    }
  } catch {
    // Logout local vẫn thành công dù API lỗi — không chặn UX.
  } finally {
    clearSession();
  }
}
