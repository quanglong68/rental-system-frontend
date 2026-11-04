import type { ReactNode } from "react";
import { AppErrorBoundary } from "@/app/error/AppErrorBoundary";
import { AuthProvider } from "@/features/auth";
import { ChatRealtimeProvider } from "@/features/chat";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <ChatRealtimeProvider>{children}</ChatRealtimeProvider>
      </AuthProvider>
    </AppErrorBoundary>
  );
}
