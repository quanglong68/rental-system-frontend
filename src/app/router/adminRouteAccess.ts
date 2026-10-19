import type { Role } from "@/features/auth";

const sectionRoles: Record<string, readonly Role[]> = {
  overview: ["ADMIN", "QUAN_LY"],
  buildings: ["ADMIN"],
  rooms: ["ADMIN", "QUAN_LY", "SALE"],
  contracts: ["ADMIN", "QUAN_LY", "SALE"],
  finance: ["ADMIN"],
  maintenance: ["ADMIN", "QUAN_LY"],
  assets: ["ADMIN", "QUAN_LY", "KY_THUAT"],
  tenants: ["ADMIN", "QUAN_LY"],
  staff: ["ADMIN"],
  reports: ["ADMIN"],
  "meter-readings": ["QUAN_LY"],
  invoices: ["QUAN_LY"],
  "my-tasks": ["KY_THUAT"],
  "maintenance-board": ["KY_THUAT"],
  leads: ["SALE"],
};

export function canAccessAdminSection(role: Role, section: string): boolean {
  return sectionRoles[section]?.includes(role) ?? false;
}
