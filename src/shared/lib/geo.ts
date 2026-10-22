/** Khoảng cách giữa hai tọa độ (km) theo công thức Haversine */
export function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371, rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Vị trí mô phỏng của người dùng: trung tâm Quận 1, TP.HCM */
export const HCM_CENTER = { lat: 10.7769, lng: 106.7009 };

