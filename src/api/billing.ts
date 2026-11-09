import { apiFetch } from "@/shared/api/httpClient";
import type { Id } from "@/shared/lib/id";

/*─────────────────────────────
  Types (mirror billing-utility-service DTOs)
─────────────────────────────*/

export type UtilityType = {
  id: Id;
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
  id: Id;
  buildingId: Id;
  name: string;
  unit: string;
  unitPrice: number;
};

export type BuildingServiceRequest = {
  buildingId: Id;
  name: string;
  unit: string;
  unitPrice: number;
};

export type UsageType = "SHARED" | "PERSONAL";

export type ContractService = {
  id: Id;
  contractId: Id;
  serviceId: Id;
  serviceName: string;
  quantity: number;
  usageType: UsageType;
  contractTenantId: Id | null;
};

export type AttachServiceRequest = {
  contractId: Id;
  serviceId: Id;
  quantity: number;
  usageType: UsageType;
  contractTenantId?: number;
};

export type Meter = {
  id: Id;
  roomId: Id;
  buildingId: Id;
  utilityTypeId: Id;
  utilityTypeName: string;
  meterCode: string | null;
  initialIndex: number;
  /** Ngày kỹ thuật ghi mốc bàn giao; null = phòng mới chưa bàn giao. */
  initialIndexDate: string | null;
  active: boolean;
};

export type CreateMeterRequest = {
  roomId: Id;
  utilityTypeId: Id;
  meterCode?: string;
  initialIndex: number;
};

export type MeterReading = {
  id: Id;
  meterId: Id;
  roomId: Id;
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
  meterId: Id;
  month: number;
  year: number;
  currentIndex: number;
  readingDate?: string;
};

export type UpdateReadingRequest = {
  currentIndex: number;
};

export type MeterIndexItem = {
  meterId: Id;
  utilityTypeName: string | null;
  initialIndex: number;
  initialIndexDate: string | null;
  currentIndex: number | null;
};

/** Phòng có khách mới chuyển vào, kỹ thuật cần ghi chỉ số bàn giao. */
export type HandoverRoom = {
  contractId: Id;
  roomId: Id;
  buildingId: Id;
  roomNumber: string | null;
  moveInDate: string;
  meters: MeterIndexItem[];
};

/** Phòng còn thiếu chỉ số của kỳ chốt sổ. */
export type MissingReadingRoom = {
  roomId: Id;
  buildingId: Id;
  roomNumber: string | null;
  meters: MeterIndexItem[];
};

export type MeterReadingOverview = {
  month: number;
  year: number;
  dayOfMonth: number;
  firstFiveDays: boolean;
  contractsAvailable: boolean;
  handoverRooms: HandoverRoom[];
  missingRooms: MissingReadingRoom[];
};

export type SaveHandoverRequest = {
  roomId: Id;
  readingDate?: string;
  readings: { meterId: Id; currentIndex: number }[];
};

export type InvoiceItem = {
  id: Id;
  itemType: "RENT" | "ELECTRIC" | "WATER" | "SERVICE_SHARED" | "SERVICE_PERSONAL";
  description: string;
  amount: number;
  meterReadingId: Id | null;
  contractServiceId: Id | null;
};

export type InvoiceStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID" | "OVERDUE";

export type Invoice = {
  id: Id;
  roomInvoiceId: Id | null;
  contractId: Id;
  roomId: Id;
  buildingId: Id;
  contractTenantId: Id | null;
  customerId: Id;
  month: number;
  year: number;
  totalAmount: number;
  paidAmount: number;
  status: InvoiceStatus;
  issuedAt: string;
  dueDate: string;
  items: InvoiceItem[];
};

export type RoomInvoiceShare = {
  invoiceId: Id;
  contractTenantId: Id;
  customerId: Id;
  /** null khi khách không phải đại diện và đây là phần của người khác. */
  totalAmount: number | null;
  paidAmount: number | null;
  status: InvoiceStatus;
  dueDate: string;
  representative: boolean;
  masked: boolean;
};

export type RoomInvoice = {
  id: Id;
  roomId: Id;
  buildingId: Id;
  month: number;
  year: number;
  totalAmount: number;
  paidAmount: number;
  rentAmount: number;
  electricAmount: number;
  waterAmount: number;
  serviceAmount: number;
  status: InvoiceStatus;
  issuedAt: string;
  dueDate: string;
  shareCount: number;
  shares: RoomInvoiceShare[];
};

export type InvoicePeriodSummary = {
  billed: number;
  paid: number;
  debt: number;
  invoiceCount: number;
  paidCount: number;
  overdueCount: number;
  rent: number;
  electric: number;
  water: number;
  service: number;
};

export type InvoiceMonthlyPoint = {
  month: number;
  billed: number;
  paid: number;
};

export type InvoiceBuildingSummary = {
  buildingId: Id;
  billed: number;
  paid: number;
  debt: number;
  invoiceCount: number;
  overdueCount: number;
};

export type InvoiceRoomDebt = {
  roomInvoiceId: Id;
  roomId: Id;
  buildingId: Id;
  outstanding: number;
  dueDate: string;
  status: InvoiceStatus;
};

export type RoomInvoiceSummary = {
  year: number;
  month: number;
  monthSummary: InvoicePeriodSummary;
  yearSummary: InvoicePeriodSummary;
  monthly: InvoiceMonthlyPoint[];
  byBuilding: InvoiceBuildingSummary[];
  topDebtRooms: InvoiceRoomDebt[];
};

export type GenerateInvoiceRequest = {
  month: number;
  year: number;
  buildingId?: Id;
};

export type SkippedRoom = {
  roomId: Id;
  reason: string;
};

export type GenerateInvoiceResult = {
  month: number;
  year: number;
  generatedCount: number;
  skipped: SkippedRoom[];
};

export type Payment = {
  id: Id;
  invoiceId: Id;
  amountPaid: number;
  method: "CASH";
  paidAt: string;
  note: string | null;
  recordedBy: string | null;
};

export type CreatePaymentRequest = {
  invoiceId: Id;
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
  updateUtilityType: (id: Id, body: UtilityTypeRequest) =>
    apiFetch<UtilityType>(`/api/v1/utility-types/${id}`, { method: "PUT", body }),

  /* Building services — staff xem; QUAN_LY/ADMIN tạo/sửa */
  buildingServices: async (buildingId?: Id) =>
    apiFetch<BuildingService[]>(
      `/api/v1/services${buildingId ? `?buildingId=${buildingId}` : ""}`,
    ),
  createBuildingService: (body: BuildingServiceRequest) =>
    apiFetch<BuildingService>("/api/v1/services", { method: "POST", body }),
  updateBuildingService: (id: Id, body: BuildingServiceRequest) =>
    apiFetch<BuildingService>(`/api/v1/services/${id}`, { method: "PUT", body }),

  /* Contract services — staff xem; QUAN_LY/ADMIN gắn/xóa */
  contractServices: async (contractId?: Id) =>
    apiFetch<ContractService[]>(
      `/api/v1/contract-services${contractId ? `?contractId=${contractId}` : ""}`,
    ),
  attachContractService: (body: AttachServiceRequest) =>
    apiFetch<ContractService>("/api/v1/contract-services", { method: "POST", body }),
  detachContractService: (id: Id) =>
    apiFetch<void>(`/api/v1/contract-services/${id}`, { method: "DELETE" }),

  /* Meters — staff xem; QUAN_LY/ADMIN tạo */
  meters: async (roomId?: Id, buildingId?: Id) =>
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
  meterReadings: async (params: { month?: number; year?: number; buildingId?: Id; page?: number; size?: number } = {}) =>
    toPage(await apiFetch<RawPage<MeterReading>>(`/api/v1/meter-readings${qs(params)}`)),
  createMeterReading: (body: CreateReadingRequest) =>
    apiFetch<MeterReading>("/api/v1/meter-readings", { method: "POST", body }),
  updateMeterReading: (id: Id, body: UpdateReadingRequest) =>
    apiFetch<MeterReading>(`/api/v1/meter-readings/${id}`, { method: "PUT", body }),
  meterReadingOverview: (params: { month?: number; year?: number; buildingId?: Id } = {}) =>
    apiFetch<MeterReadingOverview>(`/api/v1/meter-readings/overview${qs(params)}`),
  saveHandover: (body: SaveHandoverRequest) =>
    apiFetch<void>("/api/v1/meter-readings/handover", { method: "POST", body }),

  /* Invoices — QUAN_LY/KY_THUAT/SALE/ADMIN quản lý; CUSTOMER xem của mình */
  invoices: async (params: { buildingId?: Id; roomId?: Id; month?: number; year?: number; status?: InvoiceStatus; page?: number; size?: number } = {}) =>
    toPage(await apiFetch<RawPage<Invoice>>(`/api/v1/invoices${qs(params)}`)),
  myInvoices: async (params: { month?: number; year?: number; status?: InvoiceStatus; page?: number; size?: number } = {}) =>
    toPage(await apiFetch<RawPage<Invoice>>(`/api/v1/invoices/mine${qs(params)}`)),
  invoiceDetail: (id: Id) => apiFetch<Invoice>(`/api/v1/invoices/${id}`),
  generateInvoices: (body: GenerateInvoiceRequest) =>
    apiFetch<GenerateInvoiceResult>("/api/v1/invoices/generate", { method: "POST", body }),

  /* Room invoices — hóa đơn tổng theo phòng (docs 11.4); CUSTOMER xem phòng mình có share */
  roomInvoices: async (params: { buildingId?: Id; month?: number; year?: number; status?: InvoiceStatus; page?: number; size?: number } = {}) =>
    toPage(await apiFetch<RawPage<RoomInvoice>>(`/api/v1/room-invoices${qs(params)}`)),
  myRoomInvoices: async (params: { month?: number; year?: number; status?: InvoiceStatus; page?: number; size?: number } = {}) =>
    toPage(await apiFetch<RawPage<RoomInvoice>>(`/api/v1/room-invoices/mine${qs(params)}`)),
  roomInvoiceDetail: (id: Id) => apiFetch<RoomInvoice>(`/api/v1/room-invoices/${id}`),
  roomInvoiceSummary: (params: { month: number; year: number }) =>
    apiFetch<RoomInvoiceSummary>(`/api/v1/room-invoices/summary${qs(params)}`),

  /* Payments — QUAN_LY/ADMIN ghi tiền mặt; authenticated xem lịch sử */
  paymentsByInvoice: (invoiceId: Id) =>
    apiFetch<Payment[]>(`/api/v1/payments?invoiceId=${invoiceId}`),
  createPayment: (body: CreatePaymentRequest) =>
    apiFetch<Payment>("/api/v1/payments", { method: "POST", body }),
  simulatePayment: (body: CreatePaymentRequest) =>
    apiFetch<Payment>("/api/v1/payments/simulate", { method: "POST", body }),

  /* VNPay Sandbox Integration */
  createVnpayUrl: (body: { invoiceId: Id; amount?: number; returnUrl?: string }) =>
    apiFetch<{ paymentUrl: string; txnRef: string; invoiceId: Id; amount: number }>(
      "/api/v1/payments/vnpay/create-url",
      { method: "POST", body }
    ),
  confirmVnpayPayment: (params: Record<string, string>) =>
    apiFetch<{ success: boolean; message: string; invoiceId?: Id; amount?: number; txnRef?: string }>(
      "/api/v1/payments/vnpay/confirm",
      { method: "POST", body: params }
    ),
};
