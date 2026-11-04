import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/features/auth";
import { apiEventStream } from "@/shared/api/httpClient";
import { getChatUnreadCount } from "@/features/chat/api/chatApi";
import type { ChatRealtimeEvent } from "@/features/chat/api/types";

type Listener = (event: ChatRealtimeEvent) => void;

type ChatRealtimeContextValue = {
  /** Đã nối được kênh SSE hay chưa (dùng cho chấm "trực tuyến" của chính mình). */
  connected: boolean;
  unreadCount: number;
  setUnreadCount: (count: number) => void;
  refreshUnread: () => Promise<void>;
  /** Đăng ký nhận sự kiện realtime; trả về hàm huỷ đăng ký. */
  subscribe: (listener: Listener) => () => void;
};

const ChatRealtimeContext = createContext<ChatRealtimeContextValue | null>(null);

const KNOWN_EVENTS = new Set([
  "ready",
  "message.created",
  "conversation.read",
  "typing",
  "presence",
  "conversation.created",
  "unread",
]);

function parseEvent(name: string, data: unknown): ChatRealtimeEvent | null {
  if (!KNOWN_EVENTS.has(name)) return null;
  return { type: name, data } as ChatRealtimeEvent;
}

export function ChatRealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [connected, setConnected] = useState(false);
  const [unreadCount, setUnreadCountState] = useState(0);
  const listenersRef = useRef(new Set<Listener>());

  const setUnreadCount = useCallback((count: number) => {
    setUnreadCountState((current) => {
      const next = Math.max(0, count);
      return current === next ? current : next;
    });
  }, []);

  const refreshUnread = useCallback(async () => {
    if (!userId) return;
    try {
      setUnreadCount(await getChatUnreadCount());
    } catch {
      // Badge không được chặn UI khi mạng yếu.
    }
  }, [userId, setUnreadCount]);

  const subscribe = useCallback((listener: Listener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      setConnected(false);
      setUnreadCountState(0);
      return;
    }

    const controller = new AbortController();
    let disposed = false;
    let retry = 0;
    let timer: number | undefined;

    const emit = (event: ChatRealtimeEvent) => {
      if (event.type === "unread") setUnreadCount(event.data.count);
      listenersRef.current.forEach((listener) => {
        try {
          listener(event);
        } catch {
          // Một listener lỗi không được làm rớt luồng realtime.
        }
      });
    };

    const run = async () => {
      while (!disposed) {
        try {
          await apiEventStream("/api/v1/chat/events", {
            signal: controller.signal,
            onOpen: () => {
              retry = 0;
              setConnected(true);
              void refreshUnread();
            },
            onEvent: (name, data) => {
              const event = parseEvent(name, data);
              if (event) emit(event);
            },
          });
        } catch {
          if (disposed || controller.signal.aborted) return;
        }
        if (disposed) return;
        setConnected(false);
        retry += 1;
        const delay = Math.min(30_000, 1_000 * 2 ** Math.min(retry, 5));
        await new Promise<void>((resolve) => {
          timer = window.setTimeout(resolve, delay);
        });
      }
    };

    void run();
    return () => {
      disposed = true;
      controller.abort();
      if (timer !== undefined) window.clearTimeout(timer);
      setConnected(false);
    };
  }, [userId, refreshUnread, setUnreadCount]);

  // SSE có thể bị proxy cắt im lặng khi tab ngủ; đồng bộ lại khi quay về tab.
  useEffect(() => {
    if (!userId) return;
    const sync = () => {
      if (document.visibilityState === "visible") void refreshUnread();
    };
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("focus", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("focus", sync);
    };
  }, [userId, refreshUnread]);

  return (
    <ChatRealtimeContext.Provider
      value={{ connected, unreadCount, setUnreadCount, refreshUnread, subscribe }}
    >
      {children}
    </ChatRealtimeContext.Provider>
  );
}

export function useChatRealtime(): ChatRealtimeContextValue {
  const ctx = useContext(ChatRealtimeContext);
  if (!ctx) throw new Error("useChatRealtime phải nằm trong ChatRealtimeProvider");
  return ctx;
}
