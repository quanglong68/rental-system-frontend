import type { MapPoint } from "@/api/geocoding";

export type DrivingRoute = {
  distanceMeters: number;
  durationSeconds: number;
  /** Tọa độ theo thứ tự Leaflet: [lat, lng]. */
  coordinates: [number, number][];
};

type RoutingConfig = { baseUrl?: string | null };
type OsrmResponse = {
  code?: string;
  message?: string;
  routes?: Array<{
    distance: number;
    duration: number;
    geometry?: { coordinates?: [number, number][] };
  }>;
};

const routeCache = new Map<string, { expiresAt: number; route: DrivingRoute }>();
let nextRequestAt = 0;
let baseUrlPromise: Promise<string> | null = null;

const REQUEST_INTERVAL_MS = 1000;
const CACHE_TTL_MS = 10 * 60_000;

async function loadBaseUrl(signal: AbortSignal): Promise<string> {
  if (!baseUrlPromise) {
    baseUrlPromise = (async () => {
      const response = await fetch(`${import.meta.env.BASE_URL}routing-config.json`, { cache: "no-store", signal });
      if (!response.ok) throw new Error("Chưa tải được cấu hình chỉ đường.");
      const config = await response.json() as RoutingConfig;
      if (!config.baseUrl) throw new Error("Chưa cấu hình dịch vụ chỉ đường.");
      const base = new URL(config.baseUrl, window.location.origin);
      if (base.protocol !== "https:" && base.origin !== window.location.origin) {
        throw new Error("Dịch vụ chỉ đường phải dùng HTTPS.");
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

function cacheKey(from: MapPoint, to: MapPoint): string {
  return `${from.latitude.toFixed(5)},${from.longitude.toFixed(5)}>${to.latitude.toFixed(5)},${to.longitude.toFixed(5)}`;
}

export async function fetchDrivingRoute(from: MapPoint, to: MapPoint, signal: AbortSignal): Promise<DrivingRoute> {
  const key = cacheKey(from, to);
  const cached = routeCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.route;

  const base = await loadBaseUrl(signal);
  const coordinates = `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`;
  const url = new URL(`route/v1/driving/${coordinates}`, base);
  url.search = new URLSearchParams({
    overview: "full",
    geometries: "geojson",
    alternatives: "false",
    steps: "false",
  }).toString();

  await waitForTurn(signal);
  const response = await fetch(url, { signal, referrerPolicy: "strict-origin-when-cross-origin" });
  if (response.status === 429) throw new Error("Dịch vụ chỉ đường đang giới hạn yêu cầu. Vui lòng thử lại sau ít phút.");
  if (!response.ok) throw new Error("Không tìm được tuyến đường lúc này. Vui lòng thử lại.");

  const data = await response.json() as OsrmResponse;
  const first = data.routes?.[0];
  const geometry = first?.geometry?.coordinates;
  if (data.code !== "Ok" || !first || !geometry?.length) {
    throw new Error("Không tìm được tuyến đường lái xe giữa hai vị trí này.");
  }

  const route: DrivingRoute = {
    distanceMeters: first.distance,
    durationSeconds: first.duration,
    coordinates: geometry.map(([longitude, latitude]) => [latitude, longitude] as [number, number]),
  };
  routeCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, route });
  return route;
}

export function googleMapsDirectionsUrl(from: MapPoint | null, to: MapPoint): string {
  const params = new URLSearchParams({
    api: "1",
    destination: `${to.latitude},${to.longitude}`,
    travelmode: "driving",
  });
  if (from) params.set("origin", `${from.latitude},${from.longitude}`);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
