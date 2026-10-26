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
    latitude: number;
    longitude: number;
    description: string | null
    buildingStatus: BuildingStatus;
    createdAt: string;
    updatedAt: string;
};
export type BuildingStatus = "ACTIVE" | "INACTIVE" | "MAINTENANCE" | "CLOSED";
export type BuildingSearchResult = Building & {
    provinceName: string | null;
    wardName: string | null;
    buildingUrlImage: string | null;
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
export type BuildingUpdateInput = BuildingInput & { buildingStatus?: BuildingStatus | null };
export type BuildingImage = {
    imageId: string;
    ownerId: string;
    imageUrl: string;
    displayOrder: number;
    primaryImage: boolean;
    createdAt: string;
};
export type RoomType = { id: string; typeCode: string; name: string; description?: string | null };
export type RoomInput = Pick<Room, "buildingId" | "roomTypeId" | "roomCode" | "maxCapacity" | "area" | "bedroomCount" | "bathroomCount" | "basePrice" | "status">;
export type RoomStatistics = { totalRooms: number; operatingRooms: number; roomsNeedingUpdate: number; businessDate: string };
export type RoomPrice = { id: string; roomId: string; price: number; effectiveFrom: string; effectiveTo: string | null; createdAt: string; updatedAt: string };
export type RoomImage = BuildingImage;

const unwrap = async <T>(request: Promise<Envelope<T>>) => (await request).data;
const query = (params: Record<string, string | number | undefined>) => new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== "").map(([key, value]) => [key, String(value)])).toString();

export const propertyApi = {
    buildings: (page: number, size: number, keyword: string, provinceId: string, wardId: string, sort = "createdAt,desc", signal?: AbortSignal) => unwrap(apiFetch<Envelope<Page<BuildingSearchResult>>>(`/api/v1/buildings/search?${query({
        page,
        size,
        keyword: keyword || undefined,
        provinceId: provinceId || undefined,
        wardId: wardId || undefined,
        sort
    })}`, {signal})),
    nearbyBuildings: (latitude: number, longitude: number, radiusMeters: number, page: number, size: number, signal?: AbortSignal) => unwrap(apiFetch<Envelope<Page<BuildingSearchResult>>>(`/api/v1/buildings/nearby?${query({latitude, longitude, radiusMeters, page, size})}`, {signal})),
    provinces: (signal?: AbortSignal) => unwrap(apiFetch<Envelope<Province[]>>("/api/v1/provinces", {signal})),
    wardsByProvince: (provinceId: string, signal?: AbortSignal) => unwrap(apiFetch<Envelope<Ward[]>>(`/api/v1/wards/province/${encodeURIComponent(provinceId)}`, {signal})),
    building: (id: string, signal?: AbortSignal) => unwrap(apiFetch<Envelope<Building>>(`/api/v1/buildings/${encodeURIComponent(id)}`, {signal})),
    saveBuilding: (input: BuildingUpdateInput, id?: string) => unwrap(apiFetch<Envelope<Building>>(id ? `/api/v1/buildings/${encodeURIComponent(id)}` : "/api/v1/buildings", {
        method: id ? "PUT" : "POST",
        body: input
    })),
    deleteBuilding: (id: string) => unwrap(apiFetch<Envelope<null>>(`/api/v1/buildings/${encodeURIComponent(id)}`, {method: "DELETE"})),
    buildingImages: (id: string, signal?: AbortSignal) => unwrap(apiFetch<Envelope<BuildingImage[]>>(`/api/v1/images/buildings/${encodeURIComponent(id)}`, {signal})),
    uploadBuildingImage: (id: string, file: File) => {
        const form = new FormData();
        form.append("file", file);
        return unwrap(apiFetch<Envelope<BuildingImage>>(`/api/v1/images/buildings/${encodeURIComponent(id)}`, {
            method: "POST", body: form, timeoutMs: 60_000
        }));
    },
    rooms: (buildingId: string | undefined, page: number, sort: string, signal?: AbortSignal) => unwrap(apiFetch<Envelope<Page<Room>>>(`/api/v1/rooms?${query({
        buildingId,
        page,
        size: 20,
        sort
    })}`, {signal})),
    roomTypes: (signal?: AbortSignal) => unwrap(apiFetch<Envelope<Page<RoomType>>>("/api/v1/room-types?page=0&size=100", {signal})),
    createRoomType: (input: Pick<RoomType, "typeCode" | "name"> & {description?: string | null}) => unwrap(apiFetch<Envelope<RoomType>>("/api/v1/room-types", {method: "POST", body: input})),
    updateRoomType: (id: string, input: Pick<RoomType, "typeCode" | "name"> & {description?: string | null}) => unwrap(apiFetch<Envelope<RoomType>>(`/api/v1/room-types/${encodeURIComponent(id)}`, {method: "PUT", body: input})),
    deleteRoomType: (id: string) => unwrap(apiFetch<Envelope<null>>(`/api/v1/room-types/${encodeURIComponent(id)}`, {method: "DELETE"})),
    createRoom: (input: RoomInput) => unwrap(apiFetch<Envelope<Room>>("/api/v1/rooms", {method: "POST", body: input})),
    updateRoom: (id: string, input: RoomInput) => unwrap(apiFetch<Envelope<Room>>(`/api/v1/rooms/${encodeURIComponent(id)}`, {method: "PUT", body: input})),
    deleteRoom: (id: string) => unwrap(apiFetch<Envelope<null>>(`/api/v1/rooms/${encodeURIComponent(id)}`, {method: "DELETE"})),
    room: (id: string, signal?: AbortSignal) => unwrap(apiFetch<Envelope<Room>>(`/api/v1/rooms/${encodeURIComponent(id)}`, {signal})),
    roomStatistics: (buildingId?: string, signal?: AbortSignal) => unwrap(apiFetch<Envelope<RoomStatistics>>(`/api/v1/rooms/statistics${buildingId ? `?${query({buildingId})}` : ""}`, {signal})),
    roomPrices: (id: string, signal?: AbortSignal) => unwrap(apiFetch<Envelope<RoomPrice[]>>(`/api/v1/rooms/${encodeURIComponent(id)}/prices/history`, {signal})),
    currentRoomPrice: (id: string, date?: string, signal?: AbortSignal) => unwrap(apiFetch<Envelope<RoomPrice>>(`/api/v1/rooms/${encodeURIComponent(id)}/prices/current${date ? `?${query({date})}` : ""}`, {signal})),
    setRoomPrice: (id: string, price: number, effectiveFrom: string) => unwrap(apiFetch<Envelope<RoomPrice>>(`/api/v1/rooms/${encodeURIComponent(id)}/prices`, {method: "POST", body: {price, effectiveFrom}})),
    roomImages: (id: string, signal?: AbortSignal) => unwrap(apiFetch<Envelope<RoomImage[]>>(`/api/v1/images/rooms/${encodeURIComponent(id)}`, {signal})),
    uploadRoomImage: (id: string, file: File) => { const form = new FormData(); form.append("file", file); return unwrap(apiFetch<Envelope<RoomImage>>(`/api/v1/images/rooms/${encodeURIComponent(id)}`, {method: "POST", body: form, timeoutMs: 60_000})); },
    updateRoomImage: (roomId: string, imageId: string, input: Partial<Pick<RoomImage, "displayOrder" | "primaryImage">>) => unwrap(apiFetch<Envelope<RoomImage>>(`/api/v1/images/rooms/${encodeURIComponent(roomId)}/${encodeURIComponent(imageId)}`, {method: "PATCH", body: input})),
    deleteRoomImage: (roomId: string, imageId: string) => unwrap(apiFetch<Envelope<null>>(`/api/v1/images/rooms/${encodeURIComponent(roomId)}/${encodeURIComponent(imageId)}`, {method: "DELETE"})),
    occupants: (id: string, page: number, history: boolean, signal?: AbortSignal) => unwrap(apiFetch<Envelope<Page<Occupant>>>(`/api/v1/rooms/${encodeURIComponent(id)}/occupants${history ? "/history" : ""}?${query({
        page,
        size: 20
    })}`, {signal})),
    occupancySummary: (id: string, signal?: AbortSignal) => unwrap(apiFetch<Envelope<OccupancySummary>>(`/api/v1/rooms/${encodeURIComponent(id)}/occupancy-summary`, {signal})),
};
