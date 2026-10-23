/** Kiểu dùng chung cho lớp API auth (khớp contract Table 7 backend). */

export type Role = "ADMIN" | "QUAN_LY" | "KY_THUAT" | "SALE" | "CUSTOMER" | "UNKNOWN";
export type AccountType = "CUSTOMER" | "STAFF" | "ADMIN";

/**
 * User FE — fullName fallback username cho tới khi có User Service.
 * `id` là accountId từ MeResponse/LoginAccountInfo; backend dùng chính nó làm customerId
 * (JWT `sub`), nên so sánh được với `ContractTenant.customerId`.
 */
export type User = { id: number; sub: string; fullName: string; role: Role; buildings?: string[] };

export type LoginAccountInfo = {
  id: number;
  username: string;
  accountType: AccountType;
  roles: string[];
};

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  account: LoginAccountInfo;
};

export type MeResponse = {
  accountId: number;
  username: string;
  accountType: AccountType;
  roles: string[];
};

export type RegisterResponse = {
  accountId: number;
  username: string;
  accountType: AccountType;
};

