export type MapPoint = { latitude: number; longitude: number };
export type PlaceResult = MapPoint & { id: string; label: string };

type GeocodingConfig = { baseUrl?: string | null };
type NominatimPlace = { place_id: number; display_name: string; lat: string; lon: string };
type NominatimReverse = { display_name?: string; error?: string };

const searchCache = new Map<string, { expiresAt: number; places: PlaceResult[] }>();
const reverseCache = new Map<string, { expiresAt: number; label: string }>();
let nextRequestAt = 0;
let baseUrlPromise: Promise<string> | null = null;

// Nominatim yêu cầu tối đa 1 request/giây cho mỗi ứng dụng.
const REQUEST_INTERVAL_MS = 1100;
const CACHE_TTL_MS = 10 * 60_000;

export function isValidPoint(point: MapPoint | null | undefined): point is MapPoint {
  return !!point && Number.isFinite(point.latitude) && Number.isFinite(point.longitude)
    && point.latitude >= -90 && point.latitude <= 90 && point.longitude >= -180 && point.longitude <= 180;
}

export function pointLabel(point: MapPoint): string {
  return `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`;
}

async function loadBaseUrl(signal: AbortSignal): Promise<string> {
  if (!baseUrlPromise) {
    baseUrlPromise = (async () => {
      const response = await fetch(`${import.meta.env.BASE_URL}geocoding-config.json`, { cache: "no-store", signal });
      if (!response.ok) throw new Error("Chưa tải được cấu hình tìm kiếm địa điểm.");
      const config = await response.json() as GeocodingConfig;
      if (!config.baseUrl) throw new Error("Chưa cấu hình dịch vụ tìm kiếm địa điểm.");
      const base = new URL(config.baseUrl, window.location.origin);
      if (base.protocol !== "https:" && base.origin !== window.location.origin) {
        throw new Error("Dịch vụ tìm kiếm phải dùng HTTPS.");
      }
      return base.href.endsWith("/") ? base.href : `${base.href}/`;
    })().catch((error: unknown) => {
      baseUrlPromise = null;
      throw error;
    });
  }
  return baseUrlPromise;
}

async function waitForTurn(signal: AbortSignal): Promise<void> {
  const wait = Math.max(0, nextRequestAt - Date.now());
  if (wait > 0) {
    await new Promise<void>((resolve, reject) => {
      const onAbort = () => {
        window.clearTimeout(timer);
        reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      };
      const timer = window.setTimeout(() => {
        signal.removeEventListener("abort", onAbort);
        resolve();
      }, wait);
      signal.addEventListener("abort", onAbort, { once: true });
    });
  }
  if (signal.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError");
  nextRequestAt = Date.now() + REQUEST_INTERVAL_MS;
}

function requestError(response: Response, action: string): Error {
  if (response.status === 429) return new Error(`Dịch vụ ${action} đang giới hạn yêu cầu. Vui lòng thử lại sau ít phút.`);
  if (response.status === 403) return new Error(`Dịch vụ ${action} từ chối yêu cầu từ trình duyệt này.`);
  return new Error(`Không ${action} được lúc này. Vui lòng thử lại.`);
}

export async function searchPlaces(query: string, signal: AbortSignal): Promise<PlaceResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) throw new Error("Nhập ít nhất 3 ký tự để tìm địa điểm.");
  const key = trimmed.toLocaleLowerCase("vi");
  const cached = searchCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.places;

  const base = await loadBaseUrl(signal);
  const url = new URL("search", base);
  url.search = new URLSearchParams({
    q: trimmed,
    format: "jsonv2",
    limit: "5",
    addressdetails: "1",
    "accept-language": "vi",
  }).toString();

  await waitForTurn(signal);
  const response = await fetch(url, { signal, referrerPolicy: "strict-origin-when-cross-origin" });
  if (!response.ok) throw requestError(response, "tìm địa điểm");
  const data = await response.json() as NominatimPlace[];
  const places = data
    .map((item) => ({
      id: String(item.place_id),
      label: item.display_name,
      latitude: Number(item.lat),
      longitude: Number(item.lon),
    }))
    .filter((place) => isValidPoint(place) && Boolean(place.label?.trim()));
  searchCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, places });
  return places;
}

export async function reverseGeocode(point: MapPoint, signal: AbortSignal): Promise<string> {
  const cacheKey = `${point.latitude.toFixed(5)},${point.longitude.toFixed(5)}`;
  const cached = reverseCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.label;

  const base = await loadBaseUrl(signal);
  const url = new URL("reverse", base);
  url.search = new URLSearchParams({
    lat: String(point.latitude),
    lon: String(point.longitude),
    format: "jsonv2",
    zoom: "18",
    addressdetails: "1",
    "accept-language": "vi",
  }).toString();

  await waitForTurn(signal);
  const response = await fetch(url, { signal, referrerPolicy: "strict-origin-when-cross-origin" });
  if (!response.ok) throw requestError(response, "xác định địa chỉ");
  const data = await response.json() as NominatimReverse;
  const label = data.display_name?.trim();
  if (!label) throw new Error("Không xác định được địa chỉ tại vị trí này.");
  reverseCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, label });
  return label;
}
