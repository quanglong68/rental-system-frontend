import type { Role } from "@/features/auth";

const sectionRoles: Record<string, readonly Role[]> = {
  overview: ["ADMIN", "QUAN_LY"],
  buildings: ["ADMIN"],
  "room-details": ["ADMIN", "QUAN_LY", "SALE"],
  rooms: ["ADMIN", "QUAN_LY", "SALE"],
  contracts: ["ADMIN", "QUAN_LY", "SALE"],
  maintenance: ["ADMIN", "QUAN_LY"],
  tenants: ["ADMIN", "QUAN_LY"],
  staff: ["ADMIN", "QUAN_LY", "SALE", "KY_THUAT"],
  "meter-readings": ["ADMIN", "QUAN_LY", "KY_THUAT"],
  invoices: ["ADMIN", "QUAN_LY"],
  "my-tasks": ["KY_THUAT"],
  "maintenance-board": ["KY_THUAT"],
  leads: ["ADMIN", "QUAN_LY", "SALE"],
  messages: ["ADMIN", "QUAN_LY", "SALE", "KY_THUAT"],
  notifications: ["ADMIN", "QUAN_LY", "SALE", "KY_THUAT"],
};

export function canAccessAdminSection(roles: readonly string[], section: string): boolean {
  const allowed = sectionRoles[section];
  return !!allowed && roles.some((role) => allowed.includes(role as Role));
}
