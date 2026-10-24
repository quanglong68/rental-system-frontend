import {apiFetch} from "@/shared/api/httpClient";

type Envelope<T> = { data: T };
export type Page<T> = {
    content: T[];
    totalElements: number;
    totalPages: number;
    number: number;
    size: number;
    last: boolean
};
export type Building = {
    buildingId: string;
    name: string;
    address: string;
    wardId: string;
    provinceId: string;
    provinceName?: string;
    wardName?: string;
    latitude: number;
    longitude: number;
    description: string | null
};
export type Province = { provinceId: string; code: string; name: string; divisionType: string | null };
export type Ward = { wardId: string; provinceId: string; code: string; name: string; divisionType: string | null };
export type Room = {
    id: string;
    buildingId: string;
    roomTypeId: string;
    roomCode: string;
    maxCapacity: number;
    status: "VACANT" | "UPCOMING_VACANT" | "OCCUPIED" | "MAINTENANCE";
    area: number;
    bedroomCount: number;
    bathroomCount: number;
    basePrice: number
};
export type Occupant = {
    id: string;
    contractTenantId: string;
    roomId: string;
    contractId: string;
    userId: string;
    moveInDate: string;
    moveOutDate: string | null;
    status: "ACTIVE" | "ENDED"
};
export type OccupancySummary = {
    roomId: string;
    maxCapacity: number;
    currentOccupants: number;
    availableCapacity: number;
    overCapacity: boolean;
    roomStatus: string;
    businessDate: string
};
export type BuildingInput = Pick<Building, "name" | "address" | "wardId" | "provinceId" | "latitude" | "longitude" | "description">;
export type RoomType = { id: string; typeCode: string; name: string };
export type RoomInput = Pick<Room, "buildingId" | "roomTypeId" | "roomCode" | "maxCapacity" | "area" | "bedroomCount" | "bathroomCount" | "basePrice" | "status">;

const unwrap = async <T>(request: Promise<Envelope<T>>) => (await request).data;
const query = (params: Record<string, string | number | undefined>) => new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== "").map(([key, value]) => [key, String(value)])).toString();

export const propertyApi = {
    buildings: (page: number, keyword: string, provinceId: string, wardId: string, signal?: AbortSignal) => unwrap(apiFetch<Envelope<Page<Building>>>(`/api/v1/buildings/search?${query({
        page,
        size: 20,
        keyword: keyword || undefined,
        provinceId: provinceId || undefined,
        wardId: wardId || undefined
    })}`, {signal})),
    provinces: (signal?: AbortSignal) => unwrap(apiFetch<Envelope<Province[]>>("/api/v1/provinces", {signal})),
    wardsByProvince: (provinceId: string, signal?: AbortSignal) => unwrap(apiFetch<Envelope<Ward[]>>(`/api/v1/wards/province/${encodeURIComponent(provinceId)}`, {signal})),
    building: (id: string, signal?: AbortSignal) => unwrap(apiFetch<Envelope<Building>>(`/api/v1/buildings/${encodeURIComponent(id)}`, {signal})),
    saveBuilding: (input: BuildingInput, id?: string) => unwrap(apiFetch<Envelope<Building>>(id ? `/api/v1/buildings/${encodeURIComponent(id)}` : "/api/v1/buildings", {
        method: id ? "PUT" : "POST",
        body: input
    })),
    deleteBuilding: (id: string) => unwrap(apiFetch<Envelope<null>>(`/api/v1/buildings/${encodeURIComponent(id)}`, {method: "DELETE"})),
    rooms: (buildingId: string, page: number, sort: string, signal?: AbortSignal) => unwrap(apiFetch<Envelope<Page<Room>>>(`/api/v1/rooms?${query({
        buildingId,
        page,
        size: 20,
        sort
    })}`, {signal})),
    roomTypes: (signal?: AbortSignal) => unwrap(apiFetch<Envelope<Page<RoomType>>>("/api/v1/room-types?page=0&size=100", {signal})),
    createRoom: (input: RoomInput) => unwrap(apiFetch<Envelope<Room>>("/api/v1/rooms", {method: "POST", body: input})),
    room: (id: string, signal?: AbortSignal) => unwrap(apiFetch<Envelope<Room>>(`/api/v1/rooms/${encodeURIComponent(id)}`, {signal})),
    occupants: (id: string, page: number, history: boolean, signal?: AbortSignal) => unwrap(apiFetch<Envelope<Page<Occupant>>>(`/api/v1/rooms/${encodeURIComponent(id)}/occupants${history ? "/history" : ""}?${query({
        page,
        size: 20
    })}`, {signal})),
    occupancySummary: (id: string, signal?: AbortSignal) => unwrap(apiFetch<Envelope<OccupancySummary>>(`/api/v1/rooms/${encodeURIComponent(id)}/occupancy-summary`, {signal})),
};
