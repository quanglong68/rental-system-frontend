import { apiBlob, apiFetch } from "@/shared/api/httpClient";
import type { PageResponse } from "@/api/listing";
import type { Id } from "@/shared/lib/id";

export type RentalRequest = {
  id: Id;
  customerId: Id;
  listingId: Id;
  roomId: Id;
  buildingId: Id;
  status: "PENDING" | "VERIFIED" | "ACCEPTED" | "REJECTED" | "CANCELLED";
  moveInDate: string;
  note?: string;
  rejectReason?: string;
  fullName?: string;
  dateOfBirth?: string;
  gender?: string;
  phone?: string;
  email?: string;
  permanentAddress?: string;
  occupation?: string;
  cccdNumber?: string;
  cccdIssueDate?: string;
  cccdIssuePlace?: string;
  cccdFrontUploaded?: boolean;
  cccdBackUploaded?: boolean;
  termsAccepted?: boolean;
  rentAmount?: number;
  depositAmount?: number;
  electricityPrice?: number;
  waterPrice?: number;
  waterUnit?: "M3" | "PERSON";
  paymentMethod?: "CASH" | "BANK_TRANSFER";
  paymentDueDay?: number;
  minTermMonths?: number;
  availableFrom?: string;
  lessorName?: string;
  lessorPhone?: string;
  lessorAddress?: string;
  requestedAt: string;
  verifiedBy?: Id | null;
  verifiedAt?: string | null;
  readAt?: string | null;
};
export type RentalRequestInput = {
  listingId: Id;
  fullName: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  email?: string;
  permanentAddress: string;
  occupation?: string;
  cccdNumber: string;
  cccdIssueDate: string;
  cccdIssuePlace: string;
  cccdFrontKey: string;
  cccdBackKey: string;
  moveInDate: string;
  note?: string;
  termsAccepted: boolean;
};

export type Appointment = {
  id: Id;
  rentalRequestId: Id | null;
  customerId: Id;
  staffId: Id | null;
  buildingId: Id | null;
  roomId?: Id | null;
  appointmentDate: string;
  status: "SCHEDULED" | "CONFIRMED" | "VIEWED" | "CANCELLED";
  createdAt: string;
  readAt?: string | null;
};

export type RoommatePost = {
  id: Id;
  customerId: Id;
  roomId: Id;
  buildingId: Id;
  title: string;
  description?: string;
  budgetShare: number;
  status: "OPEN" | "CLOSED";
  createdAt: string;
};

export type RoommateApplication = {
  id: Id;
  roommatePostId: Id;
  customerId: Id;
  customerName?: string | null;
  fullName?: string | null;
  phone?: string | null;
  cccdNumber?: string | null;
  message: string;
  dateOfBirth?: string | null;
  gender?: string | null;
  cccdIssueDate?: string | null;
  cccdIssuePlace?: string | null;
  permanentAddress?: string | null;
  occupation?: string | null;
  moveInDate?: string | null;
  cccdFrontUploaded?: boolean;
  cccdBackUploaded?: boolean;
  status: "PENDING" | "ACCEPTED_PENDING" | "ACCEPTED" | "REJECTED" | "REJECTED_FULL";
  createdAt: string;
  readAt?: string | null;
};
const toQueryString = (params: Record<string, string | number | undefined | null>) =>
  new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v]) => [k, String(v)])).toString();

export const bookingApi = {
  createRentalRequest: (body: RentalRequestInput) => apiFetch<RentalRequest>("/api/v1/rental-requests", { method: "POST", body }),
  uploadIdentityFile: (file: File, side: "FRONT" | "BACK") => {
    const form = new FormData(); form.append("file", file); form.append("side", side);
    return apiFetch<{ side: "FRONT" | "BACK"; objectKey: string }>("/api/v1/rental-requests/identity-files", { method: "POST", body: form, timeoutMs: 60_000 });
  },
  identityFile: (requestId: Id, side: "FRONT" | "BACK") => apiBlob(`/api/v1/rental-requests/${requestId}/identity-files/${side}`),
  myRentalRequests: (status?: string, page = 0, size = 10) => apiFetch<PageResponse<RentalRequest>>(`/api/v1/rental-requests/my?${toQueryString({ status, page, size })}`),
  manageRentalRequests: (params: { buildingId?: Id; listingId?: Id; status?: string; unread?: boolean; page?: number; size?: number } = {}) => apiFetch<PageResponse<RentalRequest>>(`/api/v1/rental-requests/manage?${toQueryString({ ...params, unread: params.unread ? "true" : undefined })}`),
  cancelRentalRequest: (id: Id) => apiFetch<void>(`/api/v1/rental-requests/${id}/cancel`, { method: "PUT" }),
  verifyRentalRequest: (id: Id) => apiFetch<RentalRequest>(`/api/v1/rental-requests/${id}/verify`, { method: "PUT" }),
  acceptRentalRequest: (id: Id) => apiFetch<RentalRequest>(`/api/v1/rental-requests/${id}/accept`, { method: "PUT" }),
  rejectRentalRequest: (id: Id, reason: string) => apiFetch<RentalRequest>(`/api/v1/rental-requests/${id}/reject`, { method: "PUT", body: { reason } }),
  markRentalRequestRead: (id: Id) => apiFetch<RentalRequest>(`/api/v1/rental-requests/${id}/read`, { method: "PUT" }),
  bookViewingAppointment: (body: { roomId?: Id; listingId?: Id; appointmentDate: string }) => apiFetch<Appointment>("/api/v1/appointments/my", { method: "POST", body }),
  createAppointment: (body: { rentalRequestId: Id; staffId: Id; appointmentDate: string }) => apiFetch<Appointment>("/api/v1/appointments", { method: "POST", body }),
  myAppointments: (page = 0, size = 10) => apiFetch<PageResponse<Appointment>>(`/api/v1/appointments/my?page=${page}&size=${size}`),
  searchAppointments: (params: { staffId?: Id; buildingId?: Id; status?: string; unread?: boolean; fromTime?: string; toTime?: string; page?: number; size?: number } = {}) => apiFetch<PageResponse<Appointment>>(`/api/v1/appointments?${toQueryString({ ...params, unread: params.unread ? "true" : undefined })}`),
  updateAppointmentStatus: (id: Id, status: "CONFIRMED" | "VIEWED" | "CANCELLED") => apiFetch<Appointment>(`/api/v1/appointments/${id}/status`, { method: "PUT", body: { status } }),
  markAppointmentRead: (id: Id) => apiFetch<Appointment>(`/api/v1/appointments/${id}/read`, { method: "PUT" }),
  cancelAppointment: (id: Id) => apiFetch<void>(`/api/v1/appointments/${id}/cancel`, { method: "PUT" }),
  roommatePosts: (params: { buildingId?: Id; maxBudget?: number; keyword?: string; page?: number; size?: number } = {}) => apiFetch<PageResponse<RoommatePost>>(`/api/v1/roommate-posts?${toQueryString(params)}`),
  myRoommatePosts: () => apiFetch<RoommatePost[]>("/api/v1/roommate-posts/my"),
  createRoommatePost: (body: { roomId: Id; title: string; description?: string; budgetShare?: number }) => apiFetch<RoommatePost>("/api/v1/roommate-posts", { method: "POST", body }),
  closeRoommatePost: (id: Id) => apiFetch<void>(`/api/v1/roommate-posts/${id}/close`, { method: "PUT" }),
  applyRoommatePost: (postId: Id, body: {
    fullName: string;
    phone: string;
    cccdNumber: string;
    message: string;
    dateOfBirth?: string | null;
    gender?: string | null;
    cccdIssueDate?: string | null;
    cccdIssuePlace?: string | null;
    permanentAddress?: string | null;
    occupation?: string | null;
    moveInDate?: string | null;
    cccdFrontKey: string;
    cccdBackKey: string;
  }) => apiFetch<RoommateApplication>(`/api/v1/roommate-posts/${postId}/apply`, { method: "POST", body }),
  postRoommateApplications: (postId: Id, status?: string, page = 0, size = 20) => apiFetch<PageResponse<RoommateApplication>>(`/api/v1/roommate-posts/${postId}/applications?${toQueryString({ status, page, size })}`),
  myRoommateApplications: () => apiFetch<RoommateApplication[]>("/api/v1/roommate-applications/my"),
  acceptRoommateApplication: (id: Id) => apiFetch<RoommateApplication>(`/api/v1/roommate-applications/${id}/accept`, { method: "PUT" }),
  rejectRoommateApplication: (id: Id) => apiFetch<RoommateApplication>(`/api/v1/roommate-applications/${id}/reject`, { method: "PUT" }),
  applicationIdentityFile: (applicationId: Id, side: "FRONT" | "BACK") => apiBlob(`/api/v1/roommate-applications/${applicationId}/identity-files/${side}`),
  markRoommateApplicationRead: (id: Id) => apiFetch<RoommateApplication>(`/api/v1/roommate-applications/${id}/read`, { method: "PUT" }),
};
