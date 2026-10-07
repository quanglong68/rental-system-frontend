/** Kiểu dùng chung cho lớp API auth (khớp contract Table 7 backend). */

export type Role = "ADMIN" | "QUAN_LY" | "KY_THUAT" | "SALE" | "CUSTOMER";
export type AccountType = "CUSTOMER" | "STAFF" | "ADMIN";

/** User FE — fullName fallback username cho tới khi có User Service. */
export type User = { sub: string; fullName: string; role: Role; buildings?: string[] };

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

export type FieldViolation = { field: string; message: string };

/** Khớp common-lib ErrorResponse {code,message,status,traceId,details}. */
export type ErrorResponse = {
  code: string;
  message: string;
  status: number;
  traceId?: string;
  details?: FieldViolation[];
};
