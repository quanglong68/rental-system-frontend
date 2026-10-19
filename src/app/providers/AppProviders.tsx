import type { ReactNode } from "react";
import { AppErrorBoundary } from "@/app/error/AppErrorBoundary";
import { AuthProvider } from "@/features/auth";

export function AppProviders({ children }: { children: ReactNode }) {
  return <AppErrorBoundary><AuthProvider>{children}</AuthProvider></AppErrorBoundary>;
}
