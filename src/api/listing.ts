import { apiFetch } from "@/shared/api/httpClient";
import type { Id } from "@/shared/lib/id";

export type ListingItem = {
  id: Id;
  roomId: Id;
  buildingId: Id;
  buildingName: string;
  address: string;
  wardId?: Id;
  districtId?: Id;
  roomTypeId?: Id;
  roomTypeName?: string;
  roomNumber: string;
  maxCapacity: number;
  price: number;
  latitude?: number;
  longitude?: number;
  roomStatus: string;
  title: string;
  description?: string;
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
  status: "ACTIVE" | "CLOSED";
  createdAt: string;
  distanceKm?: number;
};

export type ListingTermsInput = {
  title: string;
  description?: string;
  depositAmount?: number;
  electricityPrice?: number;
  waterPrice?: number;
  waterUnit?: "M3" | "PERSON";
  paymentMethod?: "CASH" | "BANK_TRANSFER";
  paymentDueDay?: number;
  minTermMonths?: number;
  availableFrom?: string;
};

export type PageResponse<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export type ListingSearchParams = {
  wardId?: Id;
  districtId?: Id;
  buildingId?: Id;
  roomTypeId?: Id;
  minPrice?: number;
  maxPrice?: number;
  keyword?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  page?: number;
  size?: number;
};

const toQueryString = (params: Record<string, string | number | undefined | null>) =>
  new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .map(([k, v]) => [k, String(v)]),
  ).toString();

const ALL_LISTINGS_PAGE_SIZE = 50;
const ALL_LISTINGS_MAX_PAGES = 20;

export const listingApi = {
  search: (params: ListingSearchParams = {}, signal?: AbortSignal) => {
    const qs = toQueryString(params);
    return apiFetch<PageResponse<ListingItem>>(`/api/v1/listings${qs ? `?${qs}` : ""}`, { signal });
  },

  get: (id: Id) => apiFetch<ListingItem>(`/api/v1/listings/${id}`),

  getByRoom: (roomId: Id) => apiFetch<ListingItem>(`/api/v1/listings/room/${roomId}`),

  manage: (params: { buildingId?: Id; status?: string; page?: number; size?: number } = {}) => {
    const qs = toQueryString(params);
    return apiFetch<PageResponse<ListingItem>>(`/api/v1/listings/manage${qs ? `?${qs}` : ""}`);
  },

  update: (id: Id, body: ListingTermsInput) =>
    apiFetch<ListingItem>(`/api/v1/listings/${id}`, { method: "PUT", body }),

  updateStatus: (id: Id, status: "ACTIVE" | "CLOSED") =>
    apiFetch<ListingItem>(`/api/v1/listings/${id}/status`, { method: "PATCH", body: { status } }),
};

/**
 * Tải toàn bộ tin đăng đang mở theo bộ lọc, nối trang cho đến hết.
 * Server giới hạn mỗi trang tối đa 50 bản ghi nên không thể lấy một lần.
 */
export async function fetchAllListings(
  params: ListingSearchParams = {},
  signal?: AbortSignal,
): Promise<PageResponse<ListingItem>> {
  const items: ListingItem[] = [];
  let pageNumber = 0;
  let totalPages = 1;
  let totalElements = 0;

  while (pageNumber < totalPages && pageNumber < ALL_LISTINGS_MAX_PAGES) {
    if (signal?.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError");
    const page = await listingApi.search(
      { ...params, page: pageNumber, size: ALL_LISTINGS_PAGE_SIZE },
      signal,
    );
    const content = page?.content ?? [];
    items.push(...content);
    totalElements = page?.totalElements ?? items.length;
    totalPages = page?.totalPages ?? 0;
    if (content.length === 0) break;
    pageNumber += 1;
  }

  return {
    content: items,
    page: 0,
    size: ALL_LISTINGS_PAGE_SIZE,
    totalElements,
    totalPages,
  };
}
