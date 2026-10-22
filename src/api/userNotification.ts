import { apiFetch } from "@/shared/api/httpClient";

export type UserProfile = {
  id: number;
  fullName: string;
  phone: string | null;
  email: string | null;
  position: string | null;
  isAdmin: boolean | null;
  buildingIds: number[] | null;
};

export type NotificationItem = {
  id: number;
  type: string;
  title: string;
  content: string;
  refType: string | null;
  refId: number | null;
  isRead: boolean;
  createdAt: string;
};

export type PageResponse<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export type ProfileUpdate = Pick<UserProfile, "fullName" | "phone" | "email">;

export const getMyProfile = () => apiFetch<UserProfile>("/api/v1/users/me");

export const updateMyProfile = (body: ProfileUpdate) =>
  apiFetch<UserProfile>("/api/v1/users/me", { method: "PUT", body });

export const getNotifications = (page = 0, unreadOnly = false, size = 20) =>
  apiFetch<PageResponse<NotificationItem>>(
    `/api/v1/notifications?page=${page}&size=${size}&unreadOnly=${unreadOnly}`,
  );

export const getUnreadCount = async () => {
  const result = await apiFetch<{ count: number }>("/api/v1/notifications/unread-count");
  return result.count;
};

export const markNotificationRead = (id: number) =>
  apiFetch<void>(`/api/v1/notifications/${id}/read`, { method: "PUT" });

export const markAllNotificationsRead = () =>
  apiFetch<void>("/api/v1/notifications/read-all", { method: "PUT" });

export const getStaff = (page = 0, size = 20) =>
  apiFetch<PageResponse<UserProfile>>(`/api/v1/staff?page=${page}&size=${size}`);

export const updateStaff = (id: number, body: ProfileUpdate & { position: string | null }) =>
  apiFetch<UserProfile>(`/api/v1/staff/${id}`, { method: "PUT", body });

export const getStaffBuildings = async (id: number) => {
  const result = await apiFetch<{ staffId: number; buildingIds: number[] }>(`/api/v1/staff/${id}/buildings`);
  return result.buildingIds;
};

export const replaceStaffBuildings = (id: number, buildingIds: number[]) =>
  apiFetch<void>(`/api/v1/staff/${id}/buildings`, { method: "PUT", body: { buildingIds } });

export function notificationKind(type: string): string {
  if (/Invoice|Payment/.test(type)) return "Hóa đơn";
  if (/Appointment/.test(type)) return "Lịch hẹn";
  if (/Maintenance|Report|MeterReading/.test(type)) return "Sửa chữa";
  if (/RoommateApplication/.test(type)) return "Ở ghép";
  if (/Contract|Tenant|MoveOut/.test(type)) return "Hợp đồng";
  if (/RentalRequest/.test(type)) return "Yêu cầu thuê";
  return "Hệ thống";
}
