export type MapPoint = { latitude: number; longitude: number };
export type PlaceResult = MapPoint & { id: string; label: string };

type GeocodingConfig = { baseUrl?: string | null };
type NominatimPlace = { place_id: number; display_name: string; lat: string; lon: string };

const cache = new Map<string, { expiresAt: number; places: PlaceResult[] }>();
let nextRequestAt = 0;

export function isValidPoint(point: MapPoint | null): point is MapPoint {
  return !!point && Number.isFinite(point.latitude) && Number.isFinite(point.longitude)
    && point.latitude >= -90 && point.latitude <= 90 && point.longitude >= -180 && point.longitude <= 180;
}

async function waitForTurn(signal: AbortSignal) {
  const wait = Math.max(0, nextRequestAt - Date.now());
  if (!wait) return;
  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, wait);
    const abort = () => { window.clearTimeout(timer); reject(signal.reason); };
    signal.addEventListener("abort", abort, { once: true });
  });
}

export async function searchPlaces(query: string, signal: AbortSignal): Promise<PlaceResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) throw new Error("Nhập ít nhất 3 ký tự để tìm địa điểm.");
  const key = trimmed.toLocaleLowerCase("vi");
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.places;

  const configResponse = await fetch(`${import.meta.env.BASE_URL}geocoding-config.json`, { cache: "no-store", signal });
  if (!configResponse.ok) throw new Error("Chưa tải được cấu hình tìm kiếm địa điểm.");
  const config = await configResponse.json() as GeocodingConfig;
  if (!config.baseUrl) throw new Error("Chưa cấu hình dịch vụ tìm kiếm địa điểm.");
  const base = new URL(config.baseUrl, window.location.origin);
  if (base.protocol !== "https:" && base.origin !== window.location.origin) throw new Error("Dịch vụ tìm kiếm phải dùng HTTPS.");
  const url = new URL("search", base.href.endsWith("/") ? base.href : `${base.href}/`);
  url.search = new URLSearchParams({ q: trimmed, format: "jsonv2", limit: "5", addressdetails: "1", "accept-language": "vi" }).toString();

  await waitForTurn(signal);
  if (signal.aborted) throw signal.reason;
  nextRequestAt = Date.now() + 1100;
  const response = await fetch(url, { signal, referrerPolicy: "strict-origin-when-cross-origin" });
  if (response.status === 429) throw new Error("Dịch vụ tìm kiếm đang giới hạn yêu cầu. Vui lòng thử lại sau.");
  if (!response.ok) throw new Error("Không tìm được địa điểm lúc này. Vui lòng thử lại.");
  const data = await response.json() as NominatimPlace[];
  const places = data.map((item) => ({ id: String(item.place_id), label: item.display_name, latitude: Number(item.lat), longitude: Number(item.lon) })).filter(isValidPoint);
  cache.set(key, { expiresAt: Date.now() + 10 * 60_000, places });
  return places;
}
