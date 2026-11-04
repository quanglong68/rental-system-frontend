import type { Id } from "@/shared/lib/id";

type DockHandler = (conversationId: Id) => void;

let dockHandler: DockHandler | null = null;

/** ChatDock đăng ký khi mount; trả về hàm huỷ đăng ký. */
export function registerChatDock(handler: DockHandler | null) {
  dockHandler = handler;
  return () => {
    if (dockHandler === handler) dockHandler = null;
  };
}

/** Trả về false khi không có dock (ví dụ đang ở trang tin nhắn đầy đủ). */
export function openInChatDock(conversationId: Id): boolean {
  if (!dockHandler) return false;
  dockHandler(conversationId);
  return true;
}
