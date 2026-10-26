import { apiFetch } from "@/shared/api/httpClient";

/** Khớp DTO thật của contract-tenant-service (ContractResponse / ContractDetailResponse). */
export type ContractStatus = "DRAFT" | "ACTIVE" | "TERMINATED" | "ENDED";
export type MoveOutStatus = "PENDING" | "APPROVED" | "REJECTED" | "COMPLETED";

export type Contract = {
  id: number;
  rentalRequestId: number | null;
  roomId: number;
  buildingId: number;
  customerId: number;
  status: ContractStatus;
  startDate: string;
  endDate: string | null;
  rentAmount: number | null;
  depositAmount: number | null;
  terminationReason: string | null;
  createdAt: string;
};

export type ContractTenant = {
  id: number;
  contractId: number;
  customerId: number;
  joinedAt: string;
  leftAt: string | null;
  isRepresentative: boolean;
  createdAt: string;
};

export type ContractDetail = Contract & { tenants: ContractTenant[] };

export type MoveOutRequest = {
  id: number;
  contractId: number;
  requestedBy: number;
  requestDate: string;
  expectedMoveOutDate: string;
  reason: string | null;
  status: MoveOutStatus;
  createdAt: string;
};

/** Spring Data Page (serialization mặc định: content/number/size/totalElements/totalPages). */
export type PageResponse<T> = {
  content: T[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

/** Chấp nhận cả DIRECT (page phẳng) và VIA_DTO (page lồng trong `page`). */
type RawPage<T> = Partial<PageResponse<T>> & {
  page?: { number?: number; size?: number; totalElements?: number; totalPages?: number };
  content?: T[];
  totalPages?: number;
};

function toPage<T>(raw: RawPage<T>): PageResponse<T> {
  const dto = raw.page;
  return {
    content: raw.content ?? [],
    number: raw.number ?? dto?.number ?? 0,
    size: raw.size ?? dto?.size ?? 0,
    totalElements: raw.totalElements ?? dto?.totalElements ?? 0,
    totalPages: raw.totalPages ?? dto?.totalPages ?? 0,
  };
}

type Query = Record<string, string | number | undefined>;

function qs(params: Query): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const q = search.toString();
  return q ? `?${q}` : "";
}

export const contractsApi = {
  list: async (params: { buildingId?: number; roomId?: number; status?: ContractStatus; page?: number; size?: number }) =>
    toPage(await apiFetch<RawPage<Contract>>(`/api/v1/contracts${qs(params)}`)),
  detail: (id: number) => apiFetch<ContractDetail>(`/api/v1/contracts/${id}`),
  updateDraft: (id: number, body: { startDate: string; endDate: string | null; rentAmount: number; depositAmount: number | null }) =>
    apiFetch<Contract>(`/api/v1/contracts/${id}`, { method: "PUT", body }),
  sign: (id: number) => apiFetch<Contract>(`/api/v1/contracts/${id}/sign`, { method: "POST" }),
  renew: (id: number, newEndDate: string) =>
    apiFetch<Contract>(`/api/v1/contracts/${id}/renew`, { method: "POST", body: { newEndDate } }),
  terminate: (id: number, terminationDate: string, reason: string) =>
    apiFetch<Contract>(`/api/v1/contracts/${id}/terminate`, { method: "POST", body: { terminationDate, reason } }),
  addTenant: (id: number, customerId: number, joinedAt: string) =>
    apiFetch<ContractTenant>(`/api/v1/contracts/${id}/tenants`, { method: "POST", body: { customerId, joinedAt } }),
  setRepresentative: (id: number, tenantId: number) =>
    apiFetch<void>(`/api/v1/contracts/${id}/tenants/${tenantId}/representative`, { method: "PUT" }),
  leaveTenant: (id: number, tenantId: number, leftAt: string) =>
    apiFetch<ContractTenant>(`/api/v1/contracts/${id}/tenants/${tenantId}/leave`, { method: "PUT", body: { leftAt } }),
  /** CUSTOMER: các hợp đồng mình đang là người ở (LEFT JOIN tenant, chưa rời). Trả về List, không phân trang. */
  mine: () => apiFetch<Contract[]>("/api/v1/contracts/mine"),
  /** CUSTOMER: yêu cầu trả phòng do mình gửi, mới nhất trước. */
  moveOutsMine: () => apiFetch<MoveOutRequest[]>("/api/v1/move-out-requests/mine"),
  createMoveOut: (body: { contractId: number; expectedMoveOutDate: string; reason?: string }) =>
    apiFetch<MoveOutRequest>("/api/v1/move-out-requests", { method: "POST", body }),
  moveOuts: async (params: { buildingId?: number; status?: MoveOutStatus; page?: number; size?: number }) =>
    toPage(await apiFetch<RawPage<MoveOutRequest>>(`/api/v1/move-out-requests${qs(params)}`)),
  approveMoveOut: (id: number) =>
    apiFetch<MoveOutRequest>(`/api/v1/move-out-requests/${id}/approve`, { method: "PUT" }),
  rejectMoveOut: (id: number, reason: string) =>
    apiFetch<MoveOutRequest>(`/api/v1/move-out-requests/${id}/reject`, { method: "PUT", body: { reason } }),
};
