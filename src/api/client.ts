import type { ErrorResponse } from "./types";
import { clearSession, getAccessToken, getRefreshToken, setSession } from "./token";

/** Base gateway — cấu hình qua env, không hardcode. */
export const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "http://localhost:8080";

export class ApiError extends Error {
  code: string;
  status: number;
  traceId?: string;
  details?: ErrorResponse["details"];

  constructor(code: string, message: string, status: number, traceId?: string, details?: ErrorResponse["details"]) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.traceId = traceId;
    this.details = details;
  }
}

function newCorrelationId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  } catch {
    // bỏ qua, fallback bên dưới
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

type ApiOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  /** Bỏ qua auto-refresh khi chính nó là /refresh (tránh đệ quy). */
  noRetry?: boolean;
};

function toApiError(status: number, body: unknown, fallbackMessage: string): ApiError {
  const b = (body ?? {}) as Partial<ErrorResponse>;
  const code = typeof b.code === "string" && b.code ? b.code : status === 401 ? "UNAUTHENTICATED" : "INTERNAL_ERROR";
  const message =
    typeof b.message === "string" && b.message ? b.message : fallbackMessage || `Yêu cầu thất bại (HTTP ${status}).`;
  return new ApiError(code, message, typeof b.status === "number" ? b.status : status, b.traceId, b.details);
}

/** Refresh access bằng refreshToken đang lưu — fetch thô để tránh đệ quy qua apiFetch. */
async function tryRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Correlation-Id": newCorrelationId() },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) clearSession();
      return false;
    }
    const data = (await res.json()) as { accessToken: string; refreshToken: string };
    if (!data.accessToken || !data.refreshToken) return false;
    setSession(data.accessToken, data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetch chuẩn: gắn Bearer + X-Correlation-Id, parse ErrorResponse,
 * tự refresh 1 lần khi 401 (trừ chính /refresh).
 */
export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { body, noRetry, headers, ...rest } = options;
  const cid = newCorrelationId();
  const access = getAccessToken();

  const doFetch = async (token: string | null): Promise<Response> =>
    fetch(`${API_BASE}${path}`, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        "X-Correlation-Id": cid,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(headers ?? {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  let res: Response;
  try {
    res = await doFetch(access);
  } catch {
    throw new ApiError("DEPENDENCY_UNAVAILABLE", "Không kết nối được máy chủ. Kiểm tra mạng hoặc thử lại.", 503, cid);
  }

  // 204 No Content (logout/password) — không có body JSON.
  if (res.status === 204) return undefined as T;

  // 401 → thử refresh 1 lần rồi retry (trừ /refresh để khỏi lặp).
  if (res.status === 401 && !noRetry && !path.endsWith("/auth/refresh")) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      try {
        res = await doFetch(getAccessToken());
      } catch {
        throw new ApiError("DEPENDENCY_UNAVAILABLE", "Không kết nối được máy chủ. Kiểm tra mạng hoặc thử lại.", 503, cid);
      }
      if (res.status === 204) return undefined as T;
    }
  }

  if (res.ok) {
    if (res.status === 200 && res.headers.get("content-length") === "0") return undefined as T;
    const text = await res.text();
    if (!text) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new ApiError("INTERNAL_ERROR", "Phản hồi máy chủ không hợp lệ.", res.status, cid);
    }
  }

  let errBody: unknown = null;
  try {
    const text = await res.text();
    errBody = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    errBody = null;
  }
  throw toApiError(res.status, errBody, `Yêu cầu thất bại (HTTP ${res.status}).`);
}
