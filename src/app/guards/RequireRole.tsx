import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { hasAnyRole, homeFor, useAuth, type Role } from "@/features/auth";
import { canAccessAdminSection } from "@/app/router/adminRouteAccess";

export function RequireRole({ roles, children }: { roles: readonly Role[]; children: ReactNode }) {
  const { user, initializing } = useAuth();
  const location = useLocation();

  if (initializing) return null;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (!hasAnyRole(user, roles)) return <Navigate to={homeFor(user.role)} replace />;
  return <>{children}</>;
}

export function RequireAdminSection({ section, children }: { section: string; children: ReactNode }) {
  const { user, initializing } = useAuth();
  if (initializing) return null;
  if (!user || !canAccessAdminSection(user.roles, section)) return <Navigate to={user ? homeFor(user.role) : "/login"} replace />;
  return <>{children}</>;
}
