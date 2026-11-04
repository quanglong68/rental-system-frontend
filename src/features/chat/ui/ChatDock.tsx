import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLocation, useNavigate } from "react-router";
import { useAuth } from "@/features/auth";
import { useChatRealtime } from "@/features/chat/realtime/ChatRealtimeProvider";
import type { Id } from "@/shared/lib/id";
import { Icon } from "@/shared/ui";
import ChatWorkspace from "./ChatWorkspace";
import { registerChatDock } from "./chatDockBus";
import "./chat.css";

/**
 * Bong bóng chat nổi kiểu Messenger + hộp thoại nhỏ, chỉ gửi tin nhắn văn bản.
 * Ẩn ở trang tin nhắn đầy đủ để tránh trùng chức năng.
 */
export default function ChatDock() {
  const { user } = useAuth();
  const { unreadCount } = useChatRealtime();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [request, setRequest] = useState<{ id: Id; nonce: number } | null>(null);

  const isCustomer = user?.role === "CUSTOMER";
  const hidden =
    !user ||
    user.role === "UNKNOWN" ||
    pathname === "/messages" ||
    pathname === "/admin/messages" ||
    pathname === "/login" ||
    pathname === "/register";

  useEffect(() => {
    if (hidden) return;
    return registerChatDock((conversationId) => {
      setRequest({ id: conversationId, nonce: Date.now() });
      setOpen(true);
    });
  }, [hidden]);

  useEffect(() => {
    if (hidden && open) setOpen(false);
  }, [hidden, open]);

  if (hidden) return null;

  const fullPath = isCustomer ? "/messages" : "/admin/messages";
  const badge = unreadCount > 99 ? "99+" : String(unreadCount);
  const label =
    unreadCount > 0 ? `Mở tin nhắn (${unreadCount} tin chưa đọc)` : "Mở tin nhắn";

  return (
    <div className="cx-dock" data-chat-dock>
      <AnimatePresence>
        {open && (
          <motion.section
            className="cx-dock-panel"
            role="dialog"
            aria-label="Hộp thoại tin nhắn"
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            <header className="cx-dock-head">
              <span className="cx-dock-brand">
                <Icon name="chat" size={16} />
                <b>Tin nhắn</b>
                {unreadCount > 0 && <em>{badge}</em>}
              </span>
              <div className="cx-dock-actions">
                <button
                  type="button"
                  aria-label="Mở trang tin nhắn đầy đủ"
                  title="Mở trang tin nhắn"
                  onClick={() => {
                    setOpen(false);
                    navigate(fullPath);
                  }}
                >
                  <Icon name="arrow" size={16} />
                </button>
                <button
                  type="button"
                  aria-label="Thu nhỏ hộp thoại"
                  title="Thu nhỏ"
                  onClick={() => setOpen(false)}
                >
                  <Icon name="minimize" size={16} />
                </button>
              </div>
            </header>
            <div className="cx-dock-body">
              <ChatWorkspace
                mode={isCustomer ? "customer" : "staff"}
                embedded
                openConversationId={request?.id ?? null}
                openNonce={request?.nonce ?? 0}
                onBack={() => setRequest(null)}
              />
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        className={`cx-dock-bubble ${unreadCount > 0 ? "has-unread" : ""}`}
        aria-label={label}
        aria-expanded={open}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.94 }}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name={open ? "minimize" : "chat"} size={open ? 22 : 24} />
        {!open && unreadCount > 0 && <span className="cx-dock-badge">{badge}</span>}
      </motion.button>
    </div>
  );
}
