import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { useAuth } from "@/features/auth";
import {
  getConversation,
  getConversations,
  getMessages,
  markConversationRead,
  sendChatMessage,
  sendTyping,
} from "@/features/chat/api/chatApi";
import type {
  ChatMessage,
  ChatRealtimeEvent,
  ConversationSummary,
  MessageCursorResponse,
} from "@/features/chat/api/types";
import { chatContextLabel } from "@/features/chat/api/types";
import { useChatRealtime } from "@/features/chat/realtime/ChatRealtimeProvider";
import { errorText } from "@/shared/api/errors";
import { sameId, type Id } from "@/shared/lib/id";
import { Icon } from "@/shared/ui";
import {
  chatClock,
  chatDayLabel,
  dayKeyOf,
  idBigInt,
  initialsOf,
  lastSeenText,
  shortChatTime,
} from "./chatFormat";
import "./chat.css";

type LocalMessage = ChatMessage & { pending?: boolean; failed?: boolean };
type Props = {
  mode: "customer" | "staff";
  /** Hiển thị gọn trong hộp thoại nổi, không đụng URL và luôn dùng 1 khung. */
  embedded?: boolean;
  openConversationId?: Id | null;
  /** Tăng mỗi lần bấm nút chat bên ngoài để mở lại đúng hội thoại. */
  openNonce?: number;
  onBack?: () => void;
};

function newClientId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  } catch {
    // fallback bên dưới
  }
  return `m-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function ChatWorkspace({
  mode,
  embedded = false,
  openConversationId = null,
  openNonce = 0,
  onBack,
}: Props) {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { connected, unreadCount, setUnreadCount, subscribe } = useChatRealtime();

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [convsLoading, setConvsLoading] = useState(true);
  const [convsError, setConvsError] = useState("");
  const [keyword, setKeyword] = useState("");

  const [activeSummary, setActiveSummary] = useState<ConversationSummary | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<Id | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [peerLastRead, setPeerLastRead] = useState<Id | null>(null);
  const [peerTyping, setPeerTyping] = useState<{ userId: Id; name: string } | null>(null);
  const [draft, setDraft] = useState("");
  const [mobileThread, setMobileThread] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const selectedRef = useRef<string | null>(null);
  const loadSeq = useRef(0);
  const initialUrlHandled = useRef(false);
  const externalHandled = useRef<string | null>(null);
  const stickToBottom = useRef(true);
  const typingTimer = useRef<number | undefined>(undefined);
  const typingSentAt = useRef(0);
  const peerTypingTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    selectedRef.current = selectedId;
  }, [selectedId]);

  const listActive = conversations.find((item) => sameId(item.id, selectedId)) ?? null;
  const active = listActive ?? activeSummary;

  const markRead = useCallback(
    async (conversationId: Id, messageId: Id | null | undefined) => {
      if (messageId == null) return;
      try {
        const result = await markConversationRead(conversationId, messageId);
        setUnreadCount(result.count);
        setConversations((prev) =>
          prev.map((item) => (sameId(item.id, conversationId) ? { ...item, unreadCount: 0 } : item)),
        );
      } catch {
        // Đánh dấu đã đọc không được chặn việc đọc/gửi tin.
      }
    },
    [setUnreadCount],
  );

  const scrollToBottom = useCallback((smooth = true) => {
    stickToBottom.current = true;
    const element = listRef.current;
    if (!element) return;
    requestAnimationFrame(() => {
      element.scrollTo({ top: element.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    });
  }, []);

  const loadConversations = useCallback(
    async (silent = false) => {
      if (!silent) {
        setConvsLoading(true);
        setConvsError("");
      }
      try {
        const result = await getConversations(0, 50, keyword);
        setConversations(result.content ?? []);
      } catch (error) {
        if (!silent) setConvsError(errorText(error, "Không tải được danh sách hội thoại."));
      } finally {
        if (!silent) setConvsLoading(false);
      }
    },
    [keyword],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void loadConversations(), keyword ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [loadConversations, keyword]);

  useEffect(() => {
    return () => {
      if (typingTimer.current) window.clearTimeout(typingTimer.current);
      if (peerTypingTimer.current) window.clearTimeout(peerTypingTimer.current);
    };
  }, []);

  useEffect(() => {
    typingSentAt.current = 0;
    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    setPeerTyping(null);
  }, [selectedId]);

  const loadThread = useCallback(
    async (conversation: ConversationSummary) => {
      const seq = ++loadSeq.current;
      setActiveSummary(conversation);
      setSelectedId(String(conversation.id));
      setMessages([]);
      setMessagesError("");
      setMessagesLoading(true);
      setHasMore(false);
      setNextCursor(null);
      setPeerTyping(null);
      setPeerLastRead(conversation.peerLastReadMessageId ?? null);
      stickToBottom.current = true;
      try {
        const result: MessageCursorResponse = await getMessages(conversation.id, null, 30);
        if (seq !== loadSeq.current) return;
        setMessages(result.content ?? []);
        setHasMore(result.hasMore);
        setNextCursor(result.nextCursor);
        setPeerLastRead(result.peerLastReadMessageId ?? conversation.peerLastReadMessageId ?? null);
        if (conversation.unreadCount > 0) {
          void markRead(conversation.id, result.content?.[result.content.length - 1]?.id);
        }
        scrollToBottom(false);
      } catch (error) {
        if (seq === loadSeq.current) setMessagesError(errorText(error, "Không tải được tin nhắn."));
      } finally {
        if (seq === loadSeq.current) setMessagesLoading(false);
      }
    },
    [markRead, scrollToBottom],
  );

  const selectConversation = useCallback(
    (conversation: ConversationSummary) => {
      if (!embedded) setSearchParams({ c: String(conversation.id) }, { replace: true });
      setMobileThread(true);
      void loadThread(conversation);
    },
    [embedded, loadThread, setSearchParams],
  );

  // Mở đúng hội thoại khi bấm nút chat bên ngoài (chế độ hộp thoại nổi).
  useEffect(() => {
    if (!embedded) return;
    if (openConversationId == null) {
      externalHandled.current = null;
      return;
    }
    if (convsLoading) return;
    const key = `${String(openConversationId)}:${openNonce}`;
    if (externalHandled.current === key) return;
    externalHandled.current = key;
    const found = conversations.find((item) => sameId(item.id, openConversationId));
    if (found) {
      setMobileThread(true);
      void loadThread(found);
      return;
    }
    void (async () => {
      try {
        const conversation = await getConversation(openConversationId);
        setConversations((prev) => [
          conversation,
          ...prev.filter((item) => !sameId(item.id, conversation.id)),
        ]);
        setMobileThread(true);
        void loadThread(conversation);
      } catch (error) {
        externalHandled.current = null;
        setConvsError(errorText(error, "Không tìm thấy hội thoại."));
      }
    })();
  }, [conversations, convsLoading, embedded, loadThread, openConversationId, openNonce]);

  // Mở đúng hội thoại khi vào từ thông báo / nút "Nhắn tin" (?c=...).
  useEffect(() => {
    if (embedded || initialUrlHandled.current || convsLoading) return;
    initialUrlHandled.current = true;
    const requested = searchParams.get("c");
    if (!requested) return;
    const found = conversations.find((item) => sameId(item.id, requested));
    if (found) {
      setSelectedId(String(found.id));
      setMobileThread(true);
      void loadThread(found);
      return;
    }
    void (async () => {
      try {
        const conversation = await getConversation(requested);
        setConversations((prev) => [conversation, ...prev.filter((item) => !sameId(item.id, conversation.id))]);
        setSelectedId(String(conversation.id));
        setMobileThread(true);
        void loadThread(conversation);
      } catch (error) {
        setConvsError(errorText(error, "Không tìm thấy hội thoại."));
      }
    })();
  }, [conversations, convsLoading, loadThread, searchParams]);

  const handleRealtime = useCallback(
    (event: ChatRealtimeEvent) => {
      switch (event.type) {
        case "message.created": {
          const message = event.data;
          const fromSelf = user ? sameId(message.senderId, user.id) : false;
          const isActive = selectedId != null && sameId(message.conversationId, selectedId);
          setConversations((prev) => {
            const index = prev.findIndex((item) => sameId(item.id, message.conversationId));
            if (index === -1) {
              void loadConversations(true);
              return prev;
            }
            const current = prev[index];
            const updated: ConversationSummary = {
              ...current,
              lastMessagePreview: message.content,
              lastMessageAt: message.createdAt,
              unreadCount: fromSelf || isActive ? 0 : current.unreadCount + 1,
            };
            return [updated, ...prev.slice(0, index), ...prev.slice(index + 1)];
          });
          if (isActive) {
            setActiveSummary((prev) =>
              prev
                ? {
                    ...prev,
                    lastMessagePreview: message.content,
                    lastMessageAt: message.createdAt,
                    unreadCount: 0,
                  }
                : prev,
            );
            setMessages((prev) => {
              if (prev.some((item) => sameId(item.id, message.id))) return prev;
              if (message.clientMessageId) {
                const pendingIndex = prev.findIndex(
                  (item) => item.clientMessageId != null && item.clientMessageId === message.clientMessageId,
                );
                if (pendingIndex >= 0) {
                  const next = [...prev];
                  next[pendingIndex] = message;
                  return next;
                }
              }
              return [...prev, message];
            });
            if (stickToBottom.current || fromSelf) scrollToBottom(true);
            if (!fromSelf) void markRead(message.conversationId, message.id);
          }
          break;
        }
        case "conversation.read": {
          const data = event.data;
          if (user && sameId(data.readerId, user.id)) break;
          setConversations((prev) =>
            prev.map((item) =>
              sameId(item.id, data.conversationId)
                ? { ...item, peerLastReadMessageId: data.messageId }
                : item,
            ),
          );
          if (selectedId != null && sameId(data.conversationId, selectedId)) {
            setPeerLastRead(data.messageId);
          }
          break;
        }
        case "typing": {
          const data = event.data;
          if (user && sameId(data.userId, user.id)) break;
          if (selectedId == null || !sameId(data.conversationId, selectedId)) break;
          if (!data.typing) {
            setPeerTyping(null);
            break;
          }
          setPeerTyping({ userId: data.userId, name: data.userName });
          if (peerTypingTimer.current) window.clearTimeout(peerTypingTimer.current);
          peerTypingTimer.current = window.setTimeout(() => setPeerTyping(null), 5000);
          break;
        }
        case "presence": {
          const data = event.data;
          setConversations((prev) =>
            prev.map((item) =>
              sameId(item.peerId, data.userId)
                ? { ...item, online: data.online, lastSeenAt: data.lastSeenAt ?? item.lastSeenAt }
                : item,
            ),
          );
          setActiveSummary((prev) =>
            prev && sameId(prev.peerId, data.userId)
              ? { ...prev, online: data.online, lastSeenAt: data.lastSeenAt ?? prev.lastSeenAt }
              : prev,
          );
          break;
        }
        case "conversation.created": {
          void loadConversations(true);
          break;
        }
        default:
          break;
      }
    },
    [loadConversations, markRead, scrollToBottom, selectedId, user],
  );

  useEffect(() => subscribe(handleRealtime), [handleRealtime, subscribe]);

  const stopTyping = useCallback(() => {
    if (selectedId == null) return;
    typingSentAt.current = 0;
    void sendTyping(selectedId, false).catch(() => undefined);
  }, [selectedId]);

  const handleDraftChange = (value: string) => {
    const next = value.slice(0, 2000);
    setDraft(next);
    if (selectedId == null) return;
    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    if (next.trim()) {
      const now = Date.now();
      if (now - typingSentAt.current > 1500) {
        typingSentAt.current = now;
        void sendTyping(selectedId, true).catch(() => undefined);
      }
      typingTimer.current = window.setTimeout(() => stopTyping(), 1600);
    } else {
      stopTyping();
    }
    const element = composerRef.current;
    if (element) {
      element.style.height = "auto";
      element.style.height = `${Math.min(element.scrollHeight, 132)}px`;
    }
  };

  const send = useCallback(
    async (contentArg?: string, retryClientId?: string) => {
      const conversationId = selectedRef.current;
      const text = (contentArg ?? draft).trim();
      if (!conversationId || !text || !user) return;
      const clientMessageId = retryClientId ?? newClientId();
      const optimistic: LocalMessage = {
        id: `pending-${clientMessageId}`,
        conversationId,
        senderId: user.id,
        senderType: user.role === "CUSTOMER" ? "CUSTOMER" : "STAFF",
        senderName: user.fullName,
        content: text,
        clientMessageId,
        createdAt: new Date().toISOString(),
        pending: true,
      };
      if (contentArg === undefined) {
        setDraft("");
        if (composerRef.current) composerRef.current.style.height = "auto";
      }
      setMessages((prev) =>
        prev.some((item) => item.clientMessageId === clientMessageId) ? prev : [...prev, optimistic],
      );
      scrollToBottom(true);
      if (typingTimer.current) window.clearTimeout(typingTimer.current);
      void sendTyping(conversationId, false).catch(() => undefined);
      try {
        const saved = await sendChatMessage(conversationId, { content: text, clientMessageId });
        setMessages((prev) => {
          if (!sameId(selectedRef.current, conversationId)) return prev;
          const pendingIndex = prev.findIndex((item) => item.clientMessageId === clientMessageId);
          if (pendingIndex >= 0) {
            const next = [...prev];
            next[pendingIndex] = saved;
            return next;
          }
          return prev.some((item) => sameId(item.id, saved.id)) ? prev : [...prev, saved];
        });
        setConversations((prev) => {
          const index = prev.findIndex((item) => sameId(item.id, conversationId));
          if (index === -1) return prev;
          const updated = {
            ...prev[index],
            lastMessagePreview: text,
            lastMessageAt: saved.createdAt,
          };
          return [updated, ...prev.slice(0, index), ...prev.slice(index + 1)];
        });
      } catch {
        setMessages((prev) =>
          prev.map((item) =>
            item.clientMessageId === clientMessageId ? { ...item, pending: false, failed: true } : item,
          ),
        );
      }
    },
    [draft, scrollToBottom, user],
  );

  const retryMessage = (message: LocalMessage) => {
    setMessages((prev) => prev.filter((item) => item.clientMessageId !== message.clientMessageId));
    void send(message.content, message.clientMessageId ?? undefined);
  };

  const loadOlder = async () => {
    const conversationId = selectedRef.current;
    if (!conversationId || !hasMore || nextCursor == null || loadingOlder) return;
    setLoadingOlder(true);
    const element = listRef.current;
    const previousHeight = element?.scrollHeight ?? 0;
    const previousTop = element?.scrollTop ?? 0;
    try {
      const result = await getMessages(conversationId, nextCursor, 30);
      if (!sameId(selectedRef.current, conversationId)) return;
      setMessages((prev) => [...result.content, ...prev]);
      setHasMore(result.hasMore);
      setNextCursor(result.nextCursor);
      setPeerLastRead((prev) => result.peerLastReadMessageId ?? prev);
      requestAnimationFrame(() => {
        if (element) element.scrollTop = element.scrollHeight - previousHeight + previousTop;
      });
    } catch (error) {
      setMessagesError(errorText(error, "Không tải thêm được tin nhắn."));
    } finally {
      setLoadingOlder(false);
    }
  };

  const lastOwnMessageId = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (sameId(messages[index].senderId, user?.id)) return messages[index].id;
    }
    return null;
  }, [messages, user?.id]);

  const peerReadUpTo = idBigInt(peerLastRead);
  const lastOwnValue = idBigInt(lastOwnMessageId);
  const readByPeer =
    peerReadUpTo != null && lastOwnValue != null && peerReadUpTo >= lastOwnValue;

  const shell = (
    <div
      className={`cx-chat-shell ${mobileThread ? "cx-chat-thread-open" : ""} ${
        embedded ? "cx-chat-embedded" : ""
      }`}
    >
      <aside className="cx-chat-list" aria-label="Danh sách hội thoại">
        <div className="cx-chat-list-head">
          <div>
            <div className="cx-chat-list-title">Hội thoại</div>
            <div className="cx-chat-list-sub">
              <span className={`cx-chat-conn-dot ${connected ? "on" : ""}`} />
              {connected ? "Đang kết nối trực tiếp" : "Đang kết nối lại…"}
            </div>
          </div>
          <button
            type="button"
            className="cx-chat-refresh"
            aria-label="Làm mới danh sách hội thoại"
            disabled={convsLoading}
            onClick={() => void loadConversations()}
          >
            <Icon name="refresh" size={16} />
          </button>
        </div>

        <div className="cx-chat-search">
          <Icon name="search" size={15} />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Tìm theo tên hoặc nội dung…"
            aria-label="Tìm hội thoại"
          />
          {keyword && (
            <button type="button" aria-label="Xóa tìm kiếm" onClick={() => setKeyword("")}>
              <Icon name="close" size={14} />
            </button>
          )}
        </div>

        <div className="cx-chat-convos" role="list" aria-busy={convsLoading}>
          {convsLoading ? (
            Array.from({ length: 5 }).map((_, index) => (
              <div className="cx-chat-skeleton" key={index}>
                <span />
                <div>
                  <i />
                  <i />
                </div>
              </div>
            ))
          ) : convsError ? (
            <div className="cx-chat-list-state">
              <p>{convsError}</p>
              <button type="button" onClick={() => void loadConversations()}>
                Thử lại
              </button>
            </div>
          ) : conversations.length === 0 ? (
            <div className="cx-chat-list-state">
              <span className="cx-chat-state-icon"><Icon name="chat" size={22} /></span>
              <b>{keyword ? "Không tìm thấy hội thoại" : "Chưa có hội thoại nào"}</b>
              <p>
                {keyword
                  ? "Thử một từ khóa khác hoặc xóa tìm kiếm."
                  : mode === "staff"
                    ? "Hội thoại với khách hàng sẽ xuất hiện khi bạn phụ trách lịch xem, đơn thuê hoặc được khách chọn."
                    : "Bạn có thể bắt đầu trò chuyện từ trang ở ghép, yêu cầu thuê hoặc hợp đồng."}
              </p>
            </div>
          ) : (
            conversations.map((conversation) => {
              const isActive = sameId(conversation.id, selectedId);
              return (
                <button
                  key={String(conversation.id)}
                  type="button"
                  role="listitem"
                  className={`cx-chat-convo ${isActive ? "on" : ""} ${conversation.unreadCount > 0 ? "unread" : ""}`}
                  aria-current={isActive ? "true" : undefined}
                  onClick={() => selectConversation(conversation)}
                >
                  <span className="cx-chat-avatar">
                    {initialsOf(conversation.peerName)}
                    {conversation.online && <i className="cx-chat-presence" />}
                  </span>
                  <span className="cx-chat-convo-main">
                    <span className="cx-chat-convo-top">
                      <b>{conversation.peerName}</b>
                      <small>{shortChatTime(conversation.lastMessageAt)}</small>
                    </span>
                    <span className="cx-chat-convo-sub">
                      <span className="cx-chat-convo-preview">
                        {conversation.lastMessagePreview || "Bắt đầu trò chuyện"}
                      </span>
                      {conversation.unreadCount > 0 && (
                        <span className="cx-chat-unread">
                          {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
                        </span>
                      )}
                    </span>
                    <span className="cx-chat-convo-context">
                      {chatContextLabel(conversation.contextType)}
                      {conversation.contextLabel ? ` · ${conversation.contextLabel}` : ""}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </aside>

      <section className="cx-chat-thread" aria-label="Nội dung hội thoại">
        {!selectedId || !active ? (
          <div className="cx-chat-placeholder">
            <span className="cx-chat-placeholder-art"><Icon name="chat" size={30} /></span>
            <h2>Chọn một hội thoại</h2>
            <p>Tin nhắn được cập nhật tức thì. Chọn hội thoại bên trái để bắt đầu trao đổi.</p>
          </div>
        ) : (
          <>
            <header className="cx-chat-thread-head">
              <button
                type="button"
                className="cx-chat-back"
                aria-label="Quay lại danh sách hội thoại"
                onClick={() => {
                  setMobileThread(false);
                  onBack?.();
                }}
              >
                <Icon name="chevron-left" size={20} />
              </button>
              <span className="cx-chat-avatar sm">
                {initialsOf(active.peerName)}
                {active.online && <i className="cx-chat-presence" />}
              </span>
              <div className="cx-chat-thread-who">
                <b>{active.peerName}</b>
                <small>
                  {peerTyping
                    ? `${peerTyping.name} đang nhập…`
                    : active.online
                      ? "Đang trực tuyến"
                      : lastSeenText(active.lastSeenAt)}
                </small>
              </div>
              <span className="cx-chat-context-pill" title={active.contextLabel ?? undefined}>
                {chatContextLabel(active.contextType)}
              </span>
            </header>

            <div
              className="cx-chat-messages"
              ref={listRef}
              role="log"
              aria-live="polite"
              aria-relevant="additions"
              onScroll={(event) => {
                const element = event.currentTarget;
                stickToBottom.current =
                  element.scrollHeight - element.scrollTop - element.clientHeight < 120;
              }}
            >
              {hasMore && (
                <button
                  type="button"
                  className="cx-chat-older"
                  disabled={loadingOlder}
                  onClick={() => void loadOlder()}
                >
                  {loadingOlder ? "Đang tải…" : "Tải tin nhắn cũ hơn"}
                </button>
              )}

              {messagesLoading ? (
                <div className="cx-chat-thread-loading">
                  <span />
                  <span />
                  <span />
                </div>
              ) : messagesError ? (
                <div className="cx-chat-list-state">
                  <p>{messagesError}</p>
                  <button type="button" onClick={() => void loadThread(active)}>
                    Thử lại
                  </button>
                </div>
              ) : messages.length === 0 ? (
                <div className="cx-chat-thread-empty">
                  <span className="cx-chat-placeholder-art"><Icon name="send" size={24} /></span>
                  <b>Bắt đầu trò chuyện với {active.peerName}</b>
                  <p>Hãy gửi lời chào hoặc hỏi thông tin về {chatContextLabel(active.contextType).toLowerCase()}.</p>
                </div>
              ) : (
                messages.map((message, index) => {
                  const previous = messages[index - 1];
                  const showDay = !previous || dayKeyOf(previous.createdAt) !== dayKeyOf(message.createdAt);
                  const own = sameId(message.senderId, user?.id);
                  const isLastOwn = own && sameId(message.id, lastOwnMessageId);
                  return (
                    <Fragment key={String(message.id)}>
                      {showDay && <div className="cx-chat-day">{chatDayLabel(message.createdAt)}</div>}
                      <div className={`cx-chat-row ${own ? "own" : "peer"}`}>
                        <div
                          className={`cx-chat-bubble ${message.pending ? "pending" : ""} ${message.failed ? "failed" : ""}`}
                        >
                          <p>{message.content}</p>
                          <span className="cx-chat-meta">
                            {chatClock(message.createdAt)}
                            {message.pending ? " · Đang gửi…" : ""}
                            {message.failed ? " · Gửi lỗi" : ""}
                          </span>
                        </div>
                      </div>
                      {message.failed && (
                        <div className="cx-chat-retry">
                          <button type="button" onClick={() => retryMessage(message)}>
                            Gửi lại
                          </button>
                        </div>
                      )}
                      {isLastOwn && readByPeer && <div className="cx-chat-seen">Đã xem</div>}
                    </Fragment>
                  );
                })
              )}

              {peerTyping && (
                <div className="cx-chat-row peer">
                  <div className="cx-chat-bubble cx-chat-typing" aria-label={`${peerTyping.name} đang nhập`}>
                    <span /><span /><span />
                  </div>
                </div>
              )}
            </div>

            <form
              className="cx-chat-composer"
              onSubmit={(event) => {
                event.preventDefault();
                void send();
              }}
            >
              <textarea
                ref={composerRef}
                className="cx-chat-input"
                rows={1}
                maxLength={2000}
                value={draft}
                placeholder={`Nhắn cho ${active.peerName}…`}
                aria-label="Nội dung tin nhắn"
                disabled={messagesLoading}
                onChange={(event) => handleDraftChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                }}
              />
              <div className="cx-chat-composer-side">
                {draft.length > 1800 && (
                  <span className={`cx-chat-count ${draft.length >= 2000 ? "max" : ""}`}>
                    {draft.length}/2000
                  </span>
                )}
                <button
                  type="submit"
                  className="cx-chat-send"
                  aria-label="Gửi tin nhắn"
                  disabled={!draft.trim() || messagesLoading}
                >
                  <Icon name="send" size={18} />
                </button>
              </div>
            </form>
          </>
        )}
      </section>
    </div>
  );

  if (embedded) return shell;

  if (mode === "customer") {
    return (
      <section className="cx-section cx-chat-page !pt-32">
        <div className="cx-chat-head">
          <div>
            <div className="cx-eyebrow">Khu vực cư dân · Trao đổi trực tiếp</div>
            <h1 className="cx-serif cx-chat-title">Tin <em>nhắn</em></h1>
            <p className="cx-chat-desc">
              Nhắn trực tiếp với chủ phòng ở ghép, nhân viên kinh doanh và quản lý tòa nhà — cập nhật tức thì.
            </p>
          </div>
          <div className="cx-chat-head-stats">
            <span><b>{unreadCount}</b> tin chưa đọc</span>
            <span className={`cx-chat-conn ${connected ? "on" : ""}`}>
              <i />
              {connected ? "Realtime đang bật" : "Đang kết nối lại"}
            </span>
          </div>
        </div>
        {shell}
      </section>
    );
  }

  return <div className="admin-chat-page">{shell}</div>;
}
