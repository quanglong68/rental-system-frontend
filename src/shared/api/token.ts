/** Lưu token: access trong memory, refresh trong localStorage (theo Task 6). */

const REFRESH_KEY = "rental.refreshToken";

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

export function setRefreshToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(REFRESH_KEY, token);
    else localStorage.removeItem(REFRESH_KEY);
  } catch {
    // localStorage bị chặn (private mode) — phiên vẫn chạy in-memory.
  }
}

export function setSession(access: string, refresh: string): void {
  setAccessToken(access);
  setRefreshToken(refresh);
}

/** Xóa toàn bộ phiên (dùng khi logout / refresh invalid). */
export function clearSession(): void {
  setAccessToken(null);
  setRefreshToken(null);
}
