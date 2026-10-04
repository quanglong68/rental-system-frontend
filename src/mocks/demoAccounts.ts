import type { User } from "../lib/auth";

/**
 * Tài khoản mẫu chỉ để xem giao diện theo từng vai trò (mock).
 * Task 6 sẽ thay bằng API thật (gateway /api/v1/auth/*) rồi xóa file này.
 */
export const demoAccounts: User[] = [
  { sub: "admin@nhaminh.vn", fullName: "Trần Minh Anh", role: "ADMIN" },
  { sub: "quanly@nhaminh.vn", fullName: "Lê Quốc Bảo", role: "QUAN_LY", buildings: ["The Fern House"] },
  { sub: "kythuat@nhaminh.vn", fullName: "Trần Minh", role: "KY_THUAT", buildings: ["Mộc Residence", "The Fern House"] },
  { sub: "sale@nhaminh.vn", fullName: "Đinh Khánh Linh", role: "SALE", buildings: ["The Fern House"] },
  { sub: "0903218447", fullName: "Hoàng Thị Mai", role: "CUSTOMER" },
];
export const DEMO_PASSWORD = "matkhau123";
