import type { Id } from "@/shared/lib/id";

export type PageResponse<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

/** Ngữ cảnh nghiệp vụ mà hội thoại được mở từ đó. */
export type ChatContextType =
  | "ROOMMATE_APPLICATION"
  | "ROOMMATE_POST"
  | "LISTING"
  | "VIEWING"
  | "BOOKING"
  | "BUILDING_MANAGER";

export type ConversationSummary = {
  id: Id;
  contextType: ChatContextType | string;
  contextLabel: string | null;
  peerId: Id | null;
  peerName: string;
  peerType: string | null;
  peerRole: string | null;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  online: boolean;
  lastSeenAt: string | null;
  peerLastReadMessageId: Id | null;
};

export type ChatMessage = {
  id: Id;
  conversationId: Id;
  senderId: Id;
  senderType: string;
  senderName: string;
  content: string;
  clientMessageId: string | null;
  createdAt: string;
};

export type MessageCursorResponse = {
  content: ChatMessage[];
  nextCursor: Id | null;
  hasMore: boolean;
  peerLastReadMessageId: Id | null;
};

export type ChatContact = {
  userId: Id;
  fullName: string;
  position: string | null;
  manager: boolean;
  assigned: boolean;
};

export type CreateConversationInput = {
  contextType: ChatContextType;
  contextId: Id;
  staffId?: Id;
  customerId?: Id;
};

export type SendMessageInput = {
  content: string;
  clientMessageId?: string;
};

export type ConversationReadEvent = {
  conversationId: Id;
  readerId: Id;
  readerName: string;
  messageId: Id;
  readAt: string;
};

export type TypingEvent = {
  conversationId: Id;
  userId: Id;
  userName: string;
  typing: boolean;
};

export type PresenceEvent = {
  userId: Id;
  online: boolean;
  lastSeenAt: string | null;
};

export type UnreadEvent = { count: number };

/** Sự kiện đẩy qua SSE, đã chuẩn hóa tên. */
export type ChatRealtimeEvent =
  | { type: "ready"; data: { userId: Id } }
  | { type: "message.created"; data: ChatMessage }
  | { type: "conversation.read"; data: ConversationReadEvent }
  | { type: "typing"; data: TypingEvent }
  | { type: "presence"; data: PresenceEvent }
  | { type: "conversation.created"; data: { conversationId: Id } }
  | { type: "unread"; data: UnreadEvent };

export const CHAT_CONTEXT_LABELS: Record<ChatContextType, string> = {
  ROOMMATE_APPLICATION: "Ở ghép",
  ROOMMATE_POST: "Ở ghép",
  LISTING: "Tư vấn thuê",
  VIEWING: "Lịch xem phòng",
  BOOKING: "Yêu cầu thuê",
  BUILDING_MANAGER: "Quản lý tòa nhà",
};

export function chatContextLabel(type: string | null | undefined): string {
  if (!type) return "Hội thoại";
  return CHAT_CONTEXT_LABELS[type as ChatContextType] ?? "Hội thoại";
}
