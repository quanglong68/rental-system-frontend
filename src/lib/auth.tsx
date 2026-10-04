import { createContext, useContext, useState, type ReactNode } from "react";

export type Role = "ADMIN" | "QUAN_LY" | "KY_THUAT" | "SALE" | "CUSTOMER";
export type User = { sub: string; fullName: string; role: Role; buildings?: string[] };

type Ctx = {
  user: User | null;
  login: (username: string, password: string) => Promise<User>;
  register: (data: { fullName: string; username: string; password: string }) => Promise<User>;
  logout: () => void;
};

const AuthContext = createContext<Ctx | null>(null);

/** Tài khoản mẫu chỉ để xem giao diện theo từng vai trò */
export const demoAccounts: User[] = [
  { sub: "admin@nhaminh.vn", fullName: "Trần Minh Anh", role: "ADMIN" },
  { sub: "quanly@nhaminh.vn", fullName: "Lê Quốc Bảo", role: "QUAN_LY", buildings: ["The Fern House"] },
  { sub: "kythuat@nhaminh.vn", fullName: "Trần Minh", role: "KY_THUAT", buildings: ["Mộc Residence", "The Fern House"] },
  { sub: "sale@nhaminh.vn", fullName: "Đinh Khánh Linh", role: "SALE", buildings: ["The Fern House"] },
  { sub: "0903218447", fullName: "Hoàng Thị Mai", role: "CUSTOMER" },
];
export const DEMO_PASSWORD = "matkhau123";
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
