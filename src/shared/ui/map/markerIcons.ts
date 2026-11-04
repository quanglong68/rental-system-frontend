import L from "leaflet";

function host(className: string, child: HTMLElement, size: [number, number], anchor: [number, number]) {
  return L.divIcon({ className, html: child, iconSize: size, iconAnchor: anchor });
}

/** Ghim giá thuê (theo tòa nhà) trên bản đồ khách thuê. */
export function priceMarkerIcon(label: string, active = false) {
  const bubble = document.createElement("span");
  bubble.className = `map-pin map-pin-price${active ? " is-active" : ""}`;
  bubble.textContent = label;
  bubble.setAttribute("aria-hidden", "true");
  return host("map-pin-host", bubble, [64, 34], [32, 34]);
}

/** Ghim tòa nhà trên bản đồ quản trị, màu theo trạng thái. */
export function buildingMarkerIcon(status: string, active = false) {
  const pin = document.createElement("span");
  const tone = status.toLocaleLowerCase("en");
  pin.className = `map-pin map-pin-building map-tone-${tone}${active ? " is-active" : ""}`;
  pin.setAttribute("aria-hidden", "true");
  return host("map-pin-host", pin, [30, 38], [15, 38]);
}

/** Ghim vị trí đang chọn trong hộp thoại tìm vị trí. */
export function pickerMarkerIcon() {
  const pin = document.createElement("span");
  pin.className = "map-pin map-pin-picker";
  pin.setAttribute("aria-hidden", "true");
  return host("map-pin-host", pin, [30, 38], [15, 38]);
}

/** Chấm vị trí hiện tại của người dùng. */
export function userMarkerIcon() {
  const dot = document.createElement("span");
  dot.className = "map-user-dot";
  dot.setAttribute("aria-hidden", "true");
  return host("map-user-host", dot, [24, 24], [12, 12]);
}
