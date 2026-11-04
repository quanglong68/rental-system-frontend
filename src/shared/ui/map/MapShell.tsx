import { useEffect, useRef, useState, type ReactNode } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./map.css";

const DEFAULT_CENTER: [number, number] = [16.05, 106.2];
const OSM_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

type MapPoint = { latitude: number; longitude: number };

type MapShellProps = {
  ariaLabel: string;
  center?: [number, number];
  zoom?: number;
  className?: string;
  onReady?: (map: L.Map) => void;
  onMapClick?: (point: MapPoint) => void;
  children?: ReactNode;
};

export default function MapShell({
  ariaLabel,
  center = DEFAULT_CENTER,
  zoom = 6,
  className,
  onReady,
  onMapClick,
  children,
}: MapShellProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<L.TileLayer | null>(null);
  const readyRef = useRef(onReady);
  const clickRef = useRef(onMapClick);
  const [tiles, setTiles] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    readyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    clickRef.current = onMapClick;
  }, [onMapClick]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = L.map(container, { zoomControl: true, keyboard: true }).setView(center, zoom);
    const layer = L.tileLayer(OSM_TILES, { maxZoom: 19, attribution: OSM_ATTRIBUTION });
    layer.on("load", () => setTiles("ready"));
    layer.on("tileerror", () => setTiles("error"));
    layer.addTo(map);
    map.on("click", (event: L.LeafletMouseEvent) => {
      const point = map.wrapLatLng(event.latlng);
      clickRef.current?.({ latitude: point.lat, longitude: point.lng });
    });
    layerRef.current = layer;
    readyRef.current?.(map);

    const resize = new ResizeObserver(() => map.invalidateSize({ animate: false }));
    resize.observe(container);
    const timer = window.setTimeout(() => map.invalidateSize({ animate: false }), 0);

    return () => {
      window.clearTimeout(timer);
      resize.disconnect();
      map.remove();
      layerRef.current = null;
    };
  }, []);

  return (
    <div className={`map-shell ${className ?? ""}`.trim()}>
      <div ref={containerRef} className="map-canvas" role="region" aria-label={ariaLabel} />
      {tiles === "loading" && <div className="map-overlay" role="status">Đang tải bản đồ…</div>}
      {tiles === "error" && (
        <div className="map-overlay map-overlay-error" role="alert">
          <span>Không tải được ảnh bản đồ. Bạn vẫn có thể xem thông tin bên dưới.</span>
          <button
            type="button"
            onClick={() => {
              setTiles("loading");
              layerRef.current?.redraw();
            }}
          >
            Thử lại
          </button>
        </div>
      )}
      {children}
    </div>
  );
}
