import assert from "node:assert/strict";
import test from "node:test";
import { countRoomsWithoutLocation, groupRoomsByBuilding, type GroupableRoom } from "./buildingGroups.ts";

const room = (overrides: Partial<GroupableRoom> & Pick<GroupableRoom, "id" | "buildingKey">): GroupableRoom => ({
  building: "Tòa A",
  address: "1 Nguyễn Huệ",
  lat: 10.77,
  lng: 106.7,
  price: 3_000_000,
  roomStatus: "VACANT",
  type: "Studio",
  ...overrides,
});

test("gom phòng theo tòa nhà và tính giá/phòng trống", () => {
  const groups = groupRoomsByBuilding([
    room({ id: "1", buildingKey: "a", price: 3_000_000 }),
    room({ id: "2", buildingKey: "a", price: 5_000_000, roomStatus: "OCCUPIED", type: "1PN" }),
    room({ id: "3", buildingKey: "b", building: "Tòa B", price: 4_000_000, roomStatus: "UPCOMING_VACANT" }),
  ]);

  assert.equal(groups.length, 2);
  const a = groups.find((group) => group.key === "a");
  assert.ok(a);
  assert.equal(a.rooms.length, 2);
  assert.equal(a.minPrice, 3_000_000);
  assert.equal(a.maxPrice, 5_000_000);
  assert.equal(a.vacantCount, 1);
  assert.equal(a.typeCount, 2);
  assert.deepEqual(a.rooms.map((item) => item.id), ["1", "2"]);

  const b = groups.find((group) => group.key === "b");
  assert.equal(b?.vacantCount, 1);
});

test("bỏ qua phòng thiếu hoặc sai tọa độ", () => {
  const groups = groupRoomsByBuilding([
    room({ id: "1", buildingKey: "a", lat: null }),
    room({ id: "2", buildingKey: "a", lng: null }),
    room({ id: "3", buildingKey: "a", lat: 200 }),
  ]);

  assert.equal(groups.length, 0);
});

test("đếm phòng không có vị trí", () => {
  const rooms = [
    room({ id: "1", buildingKey: "a" }),
    room({ id: "2", buildingKey: "a", lat: null }),
    room({ id: "3", buildingKey: "b", lng: null }),
  ];

  assert.equal(countRoomsWithoutLocation(rooms), 2);
});
