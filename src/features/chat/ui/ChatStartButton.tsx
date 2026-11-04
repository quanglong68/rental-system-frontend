import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/features/auth";
import { getChatContacts, openConversation } from "@/features/chat/api/chatApi";
import type { ChatContact, ChatContextType } from "@/features/chat/api/types";
import { errorText } from "@/shared/api/errors";
import { sameId, type Id } from "@/shared/lib/id";
import { Icon, useToast, type IconName } from "@/shared/ui";
import { initialsOf } from "./chatFormat";
import { openInChatDock } from "./chatDockBus";
import "./chat.css";

type Props = {
  contextType: ChatContextType;
  contextId: Id;
  label?: string;
  className?: string;
  icon?: IconName;
  disabled?: boolean;
  title?: string;
};

/**
 * Mở hội thoại theo ngữ cảnh nghiệp vụ. Backend tự chọn đúng người phụ trách:
 * SALE của tòa nhà với tin đăng/lịch xem/đơn thuê, chủ tin với tin ở ghép và
 * ban quản lý với khiếu nại.
 */
export default function ChatStartButton({
  contextType,
  contextId,
  label = "Nhắn tin",
  className = "cx-btn ghost !py-2 text-xs",
  icon = "chat",
  disabled,
  title,
}: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [toast, showToast] = useToast();
  const [busy, setBusy] = useState(false);
  const [contacts, setContacts] = useState<ChatContact[] | null>(null);
  const isCustomer = user?.role === "CUSTOMER";

  const goToConversation = useCallback(
    (conversationId: Id) => {
      if (openInChatDock(conversationId)) return;
      navigate(`${isCustomer ? "/messages" : "/admin/messages"}?c=${conversationId}`);
    },
    [isCustomer, navigate],
  );

  const open = useCallback(
    async (staffId?: Id) => {
      const conversation = await openConversation({
        contextType,
        contextId,
        ...(staffId != null ? { staffId } : {}),
      });
      setContacts(null);
      goToConversation(conversation.id);
    },
    [contextId, contextType, goToConversation],
  );

  const handleStart = async () => {
    setBusy(true);
    try {
      // Chỉ khiếu nại ban quản lý mới cần khách chọn người phụ trách.
      if (!isCustomer || contextType !== "BUILDING_MANAGER") {
        await open();
        return;
      }
      const list = await getChatContacts(contextType, contextId);
      if (list.length === 0) {
        showToast("Tòa nhà chưa có quản lý phụ trách để nhận khiếu nại.");
        return;
      }
      if (list.length === 1) {
        await open(list[0].userId);
        return;
      }
      setContacts(list);
    } catch (error) {
      showToast(errorText(error, "Không mở được hội thoại."));
    } finally {
      setBusy(false);
    }
  };

  const handleChoose = async (contact: ChatContact) => {
    setBusy(true);
    try {
      await open(contact.userId);
    } catch (error) {
      showToast(errorText(error, "Không mở được hội thoại."));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!contacts) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setContacts(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [contacts]);

  return (
    <>
      <button
        type="button"
        className={`${className} cx-chat-start`}
        disabled={disabled || busy}
        title={title}
        onClick={() => void handleStart()}
      >
        <Icon name={icon} size={14} />
        <span>{busy && !contacts ? "Đang mở…" : label}</span>
      </button>
      {toast}

      {contacts && (
        <div className="cx-chat-picker-overlay" role="presentation" onMouseDown={() => setContacts(null)}>
          <div
            className="cx-chat-picker"
            role="dialog"
            aria-modal="true"
            aria-labelledby="chat-picker-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="cx-chat-picker-head">
              <div className="cx-chat-picker-icon"><Icon name="alert" size={20} /></div>
              <div>
                <h3 id="chat-picker-title">Chọn ban quản lý để khiếu nại</h3>
                <p>Khiếu nại sẽ được gửi trực tiếp tới quản lý phụ trách tòa nhà bạn đang thuê.</p>
              </div>
              <button
                type="button"
                className="cx-chat-picker-close"
                aria-label="Đóng"
                onClick={() => setContacts(null)}
              >
                <Icon name="close" size={16} />
              </button>
            </div>
            <div className="cx-chat-picker-list">
              {contacts.map((contact) => (
                <button
                  key={String(contact.userId)}
                  type="button"
                  className="cx-chat-picker-row"
                  disabled={busy}
                  onClick={() => void handleChoose(contact)}
                >
                  <span className="cx-chat-picker-avatar">{initialsOf(contact.fullName)}</span>
                  <span className="cx-chat-picker-copy">
                    <b>{contact.fullName}</b>
                    <small>{contact.position || (contact.manager ? "Quản lý tòa nhà" : "Nhân viên")}</small>
                  </span>
                  {contact.assigned && <span className="cx-chat-picker-tag">Phụ trách</span>}
                  {sameId(contact.userId, user?.id) && <span className="cx-chat-picker-tag">Bạn</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
