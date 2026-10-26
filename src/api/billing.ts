import { apiFetch } from "@/shared/api/httpClient";

/*─────────────────────────────
  Types (mirror billing-utility-service DTOs)
─────────────────────────────*/

export type UtilityType = {
  id: number;
  name: string;
  unit: string;
  unitPrice: number;
  createdAt: string;
};

export type UtilityTypeRequest = {
  name: string;
  unit: string;
  unitPrice: number;
};

export type BuildingService = {
  id: number;
  buildingId: number;
  name: string;
  unit: string;
  unitPrice: number;
};

export type BuildingServiceRequest = {
  buildingId: number;
  name: string;
  unit: string;
  unitPrice: number;
};

export type UsageType = "SHARED" | "PERSONAL";

export type ContractService = {
  id: number;
  contractId: number;
  serviceId: number;
  serviceName: string;
  quantity: number;
  usageType: UsageType;
  contractTenantId: number | null;
};

export type AttachServiceRequest = {
  contractId: number;
  serviceId: number;
  quantity: number;
  usageType: UsageType;
  contractTenantId?: number;
};

export type Meter = {
  id: number;
  roomId: number;
  buildingId: number;
  utilityTypeId: number;
  utilityTypeName: string;
  meterCode: string | null;
  initialIndex: number;
  active: boolean;
};

export type CreateMeterRequest = {
  roomId: number;
  utilityTypeId: number;
  meterCode?: string;
  initialIndex: number;
};

export type MeterReading = {
  id: number;
  meterId: number;
  roomId: number;
  month: number;
  year: number;
  readingDate: string;
  prevIndex: number;
  currentIndex: number;
  consumption: number;
  unitPrice: number;
  amount: number;
};

export type CreateReadingRequest = {
  meterId: number;
  month: number;
  year: number;
  currentIndex: number;
  readingDate?: string;
};

export type UpdateReadingRequest = {
  currentIndex: number;
};

export type InvoiceItem = {
  id: number;
  itemType: "RENT" | "ELECTRIC" | "WATER" | "SERVICE_SHARED" | "SERVICE_PERSONAL";
  description: string;
  amount: number;
  meterReadingId: number | null;
  contractServiceId: number | null;
};

export type InvoiceStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID" | "OVERDUE";

export type Invoice = {
  contractId: number;
  roomId: number;
  buildingId: number;
  contractTenantId: number | null;
  customerId: number;
  month: number;
  year: number;
  totalAmount: number;
  paidAmount: number;
  status: InvoiceStatus;
  issuedAt: string;
  dueDate: string;
  items: InvoiceItem[];
};

export type GenerateInvoiceRequest = {
  month: number;
  year: number;
  buildingId?: number;
};

export type SkippedRoom = {
  roomId: number;
  reason: string;
};

export type GenerateInvoiceResult = {
  month: number;
  year: number;
  generatedCount: number;
  skipped: SkippedRoom[];
};

export type Payment = {
  id: number;
  invoiceId: number;
  amountPaid: number;
  method: "CASH";
  paidAt: string;
  note: string | null;
  recordedBy: string | null;
};

export type CreatePaymentRequest = {
  invoiceId: number;
  amountPaid: number;
  paidAt?: string;
  note?: string;
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

/*─────────────────────────────
  Billing Utility Service API (port 8086 qua Gateway /api/v1)
─────────────────────────────*/

export const billingApi = {
  /* Utility types — ADMIN tạo/sửa; staff xem */
  utilityTypes: async () =>
    apiFetch<UtilityType[]>("/api/v1/utility-types"),
  createUtilityType: (body: UtilityTypeRequest) =>
    apiFetch<UtilityType>("/api/v1/utility-types", { method: "POST", body }),
  updateUtilityType: (id: number, body: UtilityTypeRequest) =>
    apiFetch<UtilityType>(`/api/v1/utility-types/${id}`, { method: "PUT", body }),

  /* Building services — staff xem; QUAN_LY/ADMIN tạo/sửa */
  buildingServices: async (buildingId?: number) =>
    apiFetch<BuildingService[]>(
      `/api/v1/services${buildingId ? `?buildingId=${buildingId}` : ""}`,
    ),
  createBuildingService: (body: BuildingServiceRequest) =>
    apiFetch<BuildingService>("/api/v1/services", { method: "POST", body }),
  updateBuildingService: (id: number, body: Omit<BuildingServiceRequest, "buildingId">) =>
    apiFetch<BuildingService>(`/api/v1/services/${id}`, { method: "PUT", body }),

  /* Contract services — staff xem; QUAN_LY/ADMIN gắn/xóa */
  contractServices: async (contractId?: number) =>
    apiFetch<ContractService[]>(
      `/api/v1/contract-services${contractId ? `?contractId=${contractId}` : ""}`,
    ),
  attachContractService: (body: AttachServiceRequest) =>
    apiFetch<ContractService>("/api/v1/contract-services", { method: "POST", body }),
  detachContractService: (id: number) =>
    apiFetch<void>(`/api/v1/contract-services/${id}`, { method: "DELETE" }),

  /* Meters — staff xem; QUAN_LY/ADMIN tạo */
  meters: async (roomId?: number, buildingId?: number) =>
    apiFetch<Meter[]>(
      `/api/v1/meters${
        roomId || buildingId
          ? `?${roomId ? `roomId=${roomId}&` : ""}${
              buildingId ? `buildingId=${buildingId}` : ""
            }`
          : ""
      }`,
    ),
  createMeter: (body: CreateMeterRequest) =>
    apiFetch<Meter>("/api/v1/meters", { method: "POST", body }),

  /* Meter readings — KY_THUAT/QUAN_LY/ADMIN nhập/sửa; staff xem */
  meterReadings: async (params: { month?: number; year?: number; buildingId?: number; page?: number; size?: number } = {}) =>
    toPage(await apiFetch<RawPage<MeterReading>>(`/api/v1/meter-readings${qs(params)}`)),
  createMeterReading: (body: CreateReadingRequest) =>
    apiFetch<MeterReading>("/api/v1/meter-readings", { method: "POST", body }),
  updateMeterReading: (id: number, body: UpdateReadingRequest) =>
    apiFetch<MeterReading>(`/api/v1/meter-readings/${id}`, { method: "PUT", body }),

  /* Invoices — QUAN_LY/KY_THUAT/SALE/ADMIN quản lý; CUSTOMER xem của mình */
  invoices: async (params: { buildingId?: number; roomId?: number; month?: number; year?: number; status?: InvoiceStatus; page?: number; size?: number } = {}) =>
    toPage(await apiFetch<RawPage<Invoice>>(`/api/v1/invoices${qs(params)}`)),
  myInvoices: () => apiFetch<Invoice[]>("/api/v1/invoices/mine"),
  invoiceDetail: (id: number) => apiFetch<Invoice>(`/api/v1/invoices/${id}`),
  generateInvoices: (body: GenerateInvoiceRequest) =>
    apiFetch<GenerateInvoiceResult>("/api/v1/invoices/generate", { method: "POST", body }),

  /* Payments — QUAN_LY/ADMIN ghi tiền mặt; authenticated xem lịch sử */
  paymentsByInvoice: (invoiceId: number) =>
    apiFetch<Payment[]>(`/api/v1/payments?invoiceId=${invoiceId}`),
  createPayment: (body: CreatePaymentRequest) =>
    apiFetch<Payment>("/api/v1/payments", { method: "POST", body }),
};
