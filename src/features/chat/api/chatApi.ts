import { apiFetch } from "@/shared/api/httpClient";
import type { Id } from "@/shared/lib/id";
import type {
  ChatContact,
  ChatContextType,
  ConversationSummary,
  CreateConversationInput,
  MessageCursorResponse,
  ChatMessage,
  PageResponse,
  SendMessageInput,
} from "./types";

const BASE = "/api/v1/chat";

export const getConversations = (page = 0, size = 20, keyword = "") => {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (keyword.trim()) params.set("keyword", keyword.trim());
  return apiFetch<PageResponse<ConversationSummary>>(`${BASE}/conversations?${params.toString()}`);
};

export const getConversation = (conversationId: Id) =>
  apiFetch<ConversationSummary>(`${BASE}/conversations/${conversationId}`);

/** Mở (hoặc lấy lại) hội thoại theo ngữ cảnh — backend tự chống trùng. */
export const openConversation = (body: CreateConversationInput) =>
  apiFetch<ConversationSummary>(`${BASE}/conversations`, { method: "POST", body });

export const getMessages = (conversationId: Id, beforeId?: Id | null, size = 30) => {
  const params = new URLSearchParams({ size: String(size) });
  if (beforeId != null) params.set("beforeId", String(beforeId));
  return apiFetch<MessageCursorResponse>(
    `${BASE}/conversations/${conversationId}/messages?${params.toString()}`,
  );
};

export const sendChatMessage = (conversationId: Id, body: SendMessageInput) =>
  apiFetch<ChatMessage>(`${BASE}/conversations/${conversationId}/messages`, {
    method: "POST",
    body,
  });

export const markConversationRead = (conversationId: Id, messageId: Id) =>
  apiFetch<{ count: number }>(`${BASE}/conversations/${conversationId}/read`, {
    method: "POST",
    body: { messageId },
  });

export const sendTyping = (conversationId: Id, typing: boolean) =>
  apiFetch<void>(`${BASE}/conversations/${conversationId}/typing`, {
    method: "POST",
    body: { typing },
  });

export const getChatUnreadCount = async () => {
  const result = await apiFetch<{ count: number }>(`${BASE}/unread-count`);
  return result.count;
};

export const getChatContacts = (contextType: ChatContextType, contextId?: Id) => {
  const params = new URLSearchParams({ contextType });
  if (contextId != null) params.set("contextId", String(contextId));
  return apiFetch<ChatContact[]>(`${BASE}/contacts?${params.toString()}`);
};
