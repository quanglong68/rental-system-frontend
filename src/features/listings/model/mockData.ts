export type RoomType = "Phòng đơn" | "Studio" | "Căn hộ mini" | "Ở ghép";
export type Room = { lat: number; lng: number; province: string; ward: string; type: RoomType; status: "ACTIVE" | "INACTIVE"; id: string; code: string; floor: number; col: number; building: string; district: string; title: string; price: number; area: number; shared: boolean; img: string; perks: string[] };

export const buildings = [
  { key: "fern", name: "The Fern House", district: "Bình Thạnh", floors: 7, cols: 5, tint: "#e9ece6" },
  { key: "moc", name: "Mộc Residence", district: "Quận 3", floors: 5, cols: 4, tint: "#efe7dc" },
  { key: "ann", name: "Căn hộ An Nhiên", district: "Quận 7", floors: 6, cols: 4, tint: "#e4eaee" },
  { key: "lam", name: "Lam Garden", district: "Thủ Đức", floors: 4, cols: 6, tint: "#e7ede4" },
];

const img = (id: string) => `https://images.unsplash.com/photo-${id}?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=80&w=900`;

export const rooms: Room[] = [
  { lat: 10.8031, lng: 106.7140, province: "TP. Hồ Chí Minh", ward: "Phường 25", type: "Studio", status: "ACTIVE", id: "f-602", code: "602", floor: 6, col: 1, building: "The Fern House", district: "Bình Thạnh", title: "Studio ban công hướng sông", price: 4650000, area: 30, shared: false, img: img("1522708323590-d24dbb6b0267"), perks: ["Ban công", "Máy giặt riêng", "Thang máy"] },
  { lat: 10.8031, lng: 106.7140, province: "TP. Hồ Chí Minh", ward: "Phường 25", type: "Phòng đơn", status: "ACTIVE", id: "f-305", code: "305", floor: 3, col: 4, building: "The Fern House", district: "Bình Thạnh", title: "Phòng sáng, cửa sổ lớn", price: 3950000, area: 25, shared: false, img: img("1762792013200-d474b123e1b8"), perks: ["Cửa sổ lớn", "Nội thất mới"] },
  { lat: 10.8031, lng: 106.7140, province: "TP. Hồ Chí Minh", ward: "Phường 25", type: "Ở ghép", status: "ACTIVE", id: "f-201", code: "201", floor: 2, col: 2, building: "The Fern House", district: "Bình Thạnh", title: "Phòng ở ghép 2 người", price: 2100000, area: 28, shared: true, img: img("1502672260266-1c1ef2d93688"), perks: ["Ở ghép", "Bếp chung"] },
  { lat: 10.7838, lng: 106.6853, province: "TP. Hồ Chí Minh", ward: "Phường Võ Thị Sáu", type: "Căn hộ mini", status: "ACTIVE", id: "m-401", code: "401", floor: 4, col: 0, building: "Mộc Residence", district: "Quận 3", title: "Căn hộ mini gỗ ấm", price: 5100000, area: 32, shared: false, img: img("1737737149038-e6532662659e"), perks: ["Bếp riêng", "Gần Hồ Con Rùa"] },
  { lat: 10.7838, lng: 106.6853, province: "TP. Hồ Chí Minh", ward: "Phường Võ Thị Sáu", type: "Phòng đơn", status: "INACTIVE", id: "m-203", code: "203", floor: 2, col: 3, building: "Mộc Residence", district: "Quận 3", title: "Phòng yên tĩnh, góc làm việc", price: 4200000, area: 24, shared: false, img: img("1505693416388-ac5ce068fe85"), perks: ["Bàn làm việc", "Wifi 300Mb"] },
  { lat: 10.7385, lng: 106.7183, province: "TP. Hồ Chí Minh", ward: "Phường Tân Phong", type: "Studio", status: "ACTIVE", id: "a-502", code: "502", floor: 5, col: 2, building: "Căn hộ An Nhiên", district: "Quận 7", title: "Phòng view Phú Mỹ Hưng", price: 4400000, area: 27, shared: false, img: img("1493809842364-78817add7ffb"), perks: ["View đẹp", "Hồ bơi chung"] },
  { lat: 10.7385, lng: 106.7183, province: "TP. Hồ Chí Minh", ward: "Phường Tân Phong", type: "Phòng đơn", status: "ACTIVE", id: "a-104", code: "104", floor: 1, col: 1, building: "Căn hộ An Nhiên", district: "Quận 7", title: "Phòng tầng trệt có sân", price: 3600000, area: 26, shared: false, img: img("1484154218962-a197022b5858"), perks: ["Sân nhỏ", "Nuôi thú cưng"] },
  { lat: 10.8459, lng: 106.7946, province: "TP. Hồ Chí Minh", ward: "Phường Tăng Nhơn Phú A", type: "Ở ghép", status: "ACTIVE", id: "l-302", code: "302", floor: 3, col: 5, building: "Lam Garden", district: "Thủ Đức", title: "Ở ghép gần ĐH Quốc gia", price: 1800000, area: 24, shared: true, img: img("1560448204-e02f11c3d0e2"), perks: ["Ở ghép", "Gần trường"] },
];

/** Cây địa giới Tỉnh → Quận → Phường cho bộ lọc */
export const areas: Record<string, Record<string, string[]>> = {
  "TP. Hồ Chí Minh": {
    "Bình Thạnh": ["Phường 25", "Phường 22", "Phường 26"],
    "Quận 3": ["Phường Võ Thị Sáu", "Phường 9"],
    "Quận 7": ["Phường Tân Phong", "Phường Tân Hưng"],
    "Thủ Đức": ["Phường Tăng Nhơn Phú A", "Phường Linh Trung"],
  },
  "Hà Nội": { "Cầu Giấy": ["Phường Dịch Vọng"], "Đống Đa": ["Phường Láng Hạ"] },
};
export const roomTypes: RoomType[] = ["Phòng đơn", "Studio", "Căn hộ mini", "Ở ghép"];
