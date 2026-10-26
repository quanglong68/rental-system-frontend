import {apiFetch} from "@/shared/api/httpClient";
import type { PageResult } from "@/api/pagedHistory";

export type { PageResult } from "@/api/pagedHistory";

export type Appliance = {
    id: number;
    roomId: number;
    buildingId: number;
    name: string;
    status: "GOOD" | "NEEDS_REPAIR" | "BROKEN";
    warrantyProvider?: string;
    warrantyStartDate?: string;
    warrantyEndDate?: string;
    warrantyActive?: boolean
};
export type MaintenanceReport = {
    id: number;
    customerId: number;
    roomId: number;
    buildingId: number;
    title: string;
    description: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
    rejectReason?: string;
    imageUrls: string[];
    createdAt: string
};
export type MaintenanceRequest = {
    id: number;
    reportId: number;
    applianceId?: number;
    roomId: number;
    buildingId: number;
    staffId: number;
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    status: "ASSIGNED" | "IN_PROGRESS" | "COMPLETED";
    scheduledAt: string;
    createdAt: string
};
export type MaintenanceSchedule = {
    id: number;
    buildingId: number;
    staffId: number;
    title: string;
    description?: string;
    intervalMonths: number;
    nextDate: string;
    lastDoneDate?: string
};
const content = <T,>(value: PageResult<T>) => value.content;
const pageQuery = (page: number, size: number) => `?page=${page}&size=${size}`;
export const assetApi = {
    appliances: async (params = "") => content(await apiFetch<PageResult<Appliance>>(`/api/v1/appliances${params}`)),
    createAppliance: (body: {
        roomId: number;
        name: string;
        status?: string
    }) => apiFetch<Appliance>("/api/v1/appliances", {method: "POST", body}),
    updateAppliance: (id: number, body: {
        name: string;
        status: string
    }) => apiFetch<Appliance>(`/api/v1/appliances/${id}`, {method: "PUT", body}),
    updateWarranty: (id: number, body: {
        provider: string;
        startDate: string;
        endDate: string
    }) => apiFetch<Appliance>(`/api/v1/appliances/${id}/warranty`, {method: "PUT", body}),
    deleteAppliance: (id: number) => apiFetch<void>(`/api/v1/appliances/${id}`, {method: "DELETE"}),
    reports: async (buildingId: number, status?: string) => content(await apiFetch<PageResult<MaintenanceReport>>(`/api/v1/reports?buildingId=${buildingId}${status ? `&status=${status}` : ""}`)),
    myReportsPage: (page = 0, size = 20) => apiFetch<PageResult<MaintenanceReport>>(`/api/v1/reports/mine${pageQuery(page, size)}`),
    myRequestsPage: (page = 0, size = 20) => apiFetch<PageResult<MaintenanceRequest>>(`/api/v1/maintenance-requests/mine${pageQuery(page, size)}`),
    myReports: async () => content(await apiFetch<PageResult<MaintenanceReport>>("/api/v1/reports/mine")),
    myRequests: async (params = "") => content(await apiFetch<PageResult<MaintenanceRequest>>(`/api/v1/maintenance-requests/mine${params}`)),
    createReport: (body: {
        roomId: number;
        title: string;
        description: string;
        imageUrls: string[]
    }) => apiFetch<MaintenanceReport>("/api/v1/reports", {method: "POST", body}),
    uploadImage: async (file: File) => {
        const {uploadUrl, imageUrl} = await apiFetch<{
            uploadUrl: string;
            imageUrl: string;
            expiresInSeconds: number
        }>("/api/v1/reports/image-upload-url", {method: "POST", body: {fileName: file.name, contentType: file.type}});
        const response = await fetch(uploadUrl, {method: "PUT", headers: {"Content-Type": file.type}, body: file});
        if (!response.ok) throw new Error("Không tải được ảnh lên MinIO.");
        return imageUrl;
    },
    approve: (id: number, body: {
        staffId: number;
        priority: string;
        scheduledAt: string;
        applianceId?: number
    }) => apiFetch<MaintenanceRequest>(`/api/v1/reports/${id}/approve`, {method: "PUT", body}),
    reject: (id: number, reason: string) => apiFetch<MaintenanceReport>(`/api/v1/reports/${id}/reject`, {
        method: "PUT",
        body: {reason}
    }),
    requests: async (params = "") => content(await apiFetch<PageResult<MaintenanceRequest>>(`/api/v1/maintenance-requests${params}`)),
    assign: (id: number, body: {
        staffId: number;
        priority: string;
        scheduledAt: string
    }) => apiFetch<MaintenanceRequest>(`/api/v1/maintenance-requests/${id}/assign`, {method: "PUT", body}),
    start: (id: number) => apiFetch<MaintenanceRequest>(`/api/v1/maintenance-requests/${id}/start`, {method: "PUT"}),
    complete: (id: number, body: {
        actionTaken: string;
        cost: number
    }) => apiFetch<MaintenanceRequest>(`/api/v1/maintenance-requests/${id}/complete`, {method: "POST", body}),
    schedules: (buildingId?: number) => apiFetch<MaintenanceSchedule[]>(`/api/v1/maintenance-schedules${buildingId ? `?buildingId=${buildingId}` : ""}`),
    createSchedule: (body: {
        buildingId: number;
        staffId: number;
        title: string;
        description?: string;
        intervalMonths: number;
        firstDate: string
    }) => apiFetch<MaintenanceSchedule>("/api/v1/maintenance-schedules", {method: "POST", body}),
    updateSchedule: (id: number, body: {
        staffId: number;
        title: string;
        description?: string;
        intervalMonths: number;
        nextDate: string
    }) => apiFetch<MaintenanceSchedule>(`/api/v1/maintenance-schedules/${id}`, {method: "PUT", body}),
    deleteSchedule: (id: number) => apiFetch<void>(`/api/v1/maintenance-schedules/${id}`, {method: "DELETE"}),
    completeSchedule: (id: number) => apiFetch<MaintenanceSchedule>(`/api/v1/maintenance-schedules/${id}/complete`, {method: "POST"}),
};
