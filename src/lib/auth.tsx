import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { fetchMe, login as apiLogin, logout as apiLogout, register as apiRegister, toUser } from "../api/auth";
import { clearSession, getRefreshToken } from "../api/token";
import type { Role, User } from "../api/types";

export type { Role, User };

type Ctx = {
  user: User | null;
  /** true trong lúc bootstrap /me lần đầu (guard nên chờ). */
  initializing: boolean;
  login: (username: string, password: string) => Promise<User>;
  register: (data: { fullName: string; username: string; password: string }) => Promise<User>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  // Bootstrap: còn refreshToken thì thử /me để khôi phục phiên (có auto-refresh trong client).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!getRefreshToken()) return;
        const me = await fetchMe();
        if (!cancelled) setUser(toUser(me.username, me.accountType, me.roles));
      } catch {
        if (!cancelled) {
          clearSession();
          setUser(null);
        }
      } finally {
        if (!cancelled) setInitializing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login: Ctx["login"] = useCallback(async (username, password) => {
    const res = await apiLogin(username, password);
    const u = toUser(res.account.username, res.account.accountType, res.account.roles);
    setUser(u);
    return u;
  }, []);

  const register: Ctx["register"] = useCallback(async ({ fullName, username, password }) => {
    await apiRegister({ fullName, username, password });
    // Register BE chỉ trả 201 không kèm token → login ngay để lấy cặp token thật.
    const res = await apiLogin(username, password);
    const u = toUser(res.account.username, res.account.accountType, res.account.roles, fullName);
    setUser(u);
    return u;
  }, []);

  const logout: Ctx["logout"] = useCallback(async () => {
    await apiLogout();
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, initializing, login, register, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth phải nằm trong AuthProvider");
  return ctx;
}

export const homeFor = (role: Role) => (role === "CUSTOMER" ? "/my-room" : "/admin");
