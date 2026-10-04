import { createContext, useContext, useState, type ReactNode } from "react";
import { DEMO_PASSWORD, demoAccounts } from "../mocks/demoAccounts";

export type Role = "ADMIN" | "QUAN_LY" | "KY_THUAT" | "SALE" | "CUSTOMER";
export type User = { sub: string; fullName: string; role: Role; buildings?: string[] };

type Ctx = {
  user: User | null;
  login: (username: string, password: string) => Promise<User>;
  register: (data: { fullName: string; username: string; password: string }) => Promise<User>;
  logout: () => void;
};

const AuthContext = createContext<Ctx | null>(null);

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const login: Ctx["login"] = async (username, password) => {
    await wait(500);
    const acc = demoAccounts.find((a) => a.sub === username.trim().toLowerCase());
    if (!acc || password !== DEMO_PASSWORD) throw new Error("Tên đăng nhập hoặc mật khẩu không đúng.");
    setUser(acc);
    return acc;
  };

  const register: Ctx["register"] = async ({ fullName, username }) => {
    await wait(600);
    const u: User = { sub: username, fullName, role: "CUSTOMER" };
    setUser(u);
    return u;
  };

  return <AuthContext.Provider value={{ user, login, register, logout: () => setUser(null) }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth phải nằm trong AuthProvider");
  return ctx;
}

export const homeFor = (role: Role) => (role === "CUSTOMER" ? "/phong-cua-toi" : "/quan-tri");
