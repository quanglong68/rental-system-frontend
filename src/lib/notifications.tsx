import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import {
  getUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "../api/userNotification";
import { useAuth } from "./auth";

type NotificationContextValue = {
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    try {
      setUnreadCount(await getUnreadCount());
    } catch {
      // Giữ số hiện có khi API tạm thời không truy cập được.
    }
  }, [user?.sub]);

  useEffect(() => {
    void refreshUnreadCount();
    if (!user) return;
    const timer = window.setInterval(() => void refreshUnreadCount(), 60_000);
    return () => window.clearInterval(timer);
  }, [refreshUnreadCount, user]);

  const markRead = useCallback(async (id: number) => {
    await markNotificationRead(id);
    await refreshUnreadCount();
  }, [refreshUnreadCount]);

  const markAllRead = useCallback(async () => {
    await markAllNotificationsRead();
    await refreshUnreadCount();
  }, [refreshUnreadCount]);

  return (
    <NotificationContext.Provider value={{ unreadCount, refreshUnreadCount, markRead, markAllRead }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotifications phải nằm trong NotificationProvider");
  return context;
}
