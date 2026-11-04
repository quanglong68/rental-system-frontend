export type GroupableRoom = {
  id: string;
  buildingKey: string;
  building: string;
  address: string;
  lat: number | null;
  lng: number | null;
  price: number;
  roomStatus: string;
  type: string;
};

export type BuildingGroup<T extends GroupableRoom = GroupableRoom> = {
  key: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  rooms: T[];
  minPrice: number;
  maxPrice: number;
  vacantCount: number;
  typeCount: number;
};

const isVacant = (room: GroupableRoom) => room.roomStatus === "VACANT" || room.roomStatus === "UPCOMING_VACANT";

export function groupRoomsByBuilding<T extends GroupableRoom>(rooms: readonly T[]): BuildingGroup<T>[] {
  const groups = new Map<string, BuildingGroup<T>>();

  for (const room of rooms) {
    if (room.lat == null || room.lng == null) continue;
    if (!Number.isFinite(room.lat) || !Number.isFinite(room.lng)) continue;
    if (room.lat < -90 || room.lat > 90 || room.lng < -180 || room.lng > 180) continue;

    const existing = groups.get(room.buildingKey);
    if (existing) {
      existing.rooms.push(room);
      existing.minPrice = Math.min(existing.minPrice, room.price);
      existing.maxPrice = Math.max(existing.maxPrice, room.price);
      if (isVacant(room)) existing.vacantCount += 1;
      continue;
    }

    groups.set(room.buildingKey, {
      key: room.buildingKey,
      name: room.building,
      address: room.address,
      latitude: room.lat,
      longitude: room.lng,
      rooms: [room],
      minPrice: room.price,
      maxPrice: room.price,
      vacantCount: isVacant(room) ? 1 : 0,
      typeCount: 1,
    });
  }

  for (const group of groups.values()) {
    group.typeCount = new Set(group.rooms.map((room) => room.type).filter(Boolean)).size;
    group.rooms.sort((a, b) => a.price - b.price);
  }

  return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name, "vi"));
}

export function countRoomsWithoutLocation(rooms: readonly GroupableRoom[]): number {
  return rooms.filter((room) => room.lat == null || room.lng == null).length;
}
