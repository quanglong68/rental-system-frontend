import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { MapPoint } from "@/features/properties/api/geocodingApi";

const defaultCenter: L.LatLngExpression = [16.1, 106.1];
const markerIcon = L.divIcon({ className: "building-map-marker", html: '<span aria-hidden="true"></span>', iconSize: [26, 26], iconAnchor: [13, 26] });

export default function BuildingLocationMap({ position, focusKey, onSelect }: { position: MapPoint | null; focusKey: number; onSelect: (point: MapPoint) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const layerRef = useRef<L.TileLayer | null>(null);
  const selectRef = useRef(onSelect);
  const [tiles, setTiles] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => { selectRef.current = onSelect; }, [onSelect]);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: true, keyboard: true }).setView(position ? [position.latitude, position.longitude] : defaultCenter, position ? 16 : 6);
    const layer = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' });
    layer.on("load", () => setTiles("ready"));
    layer.on("tileerror", () => setTiles("error"));
    layer.addTo(map);
    map.on("click", (event) => { const point = map.wrapLatLng(event.latlng); selectRef.current({ latitude: point.lat, longitude: point.lng }); });
    mapRef.current = map;
    layerRef.current = layer;
    const timer = window.setTimeout(() => map.invalidateSize(), 0);
    return () => { window.clearTimeout(timer); map.remove(); mapRef.current = null; markerRef.current = null; layerRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!position) { markerRef.current?.remove(); markerRef.current = null; return; }
    const latLng: L.LatLngExpression = [position.latitude, position.longitude];
    if (markerRef.current) markerRef.current.setLatLng(latLng);
    else {
      const marker = L.marker(latLng, { draggable: true, icon: markerIcon, title: "Vị trí tòa nhà" }).addTo(map);
      marker.on("dragend", () => { const value = map.wrapLatLng(marker.getLatLng()); selectRef.current({ latitude: value.lat, longitude: value.lng }); });
      markerRef.current = marker;
    }
  }, [position]);

  useEffect(() => { if (focusKey > 0 && position && mapRef.current) mapRef.current.flyTo([position.latitude, position.longitude], 16); }, [focusKey]);

  return <div className="building-map-shell">
    <div ref={containerRef} className="building-map" aria-label="Bản đồ chọn vị trí tòa nhà" />
    {tiles === "loading" && <div className="building-map-overlay" role="status">Đang tải bản đồ…</div>}
    {tiles === "error" && <div className="building-map-overlay building-map-error" role="alert"><span>Không tải được ảnh bản đồ. Bạn vẫn có thể chọn tọa độ.</span><button type="button" onClick={() => { setTiles("loading"); layerRef.current?.redraw(); }}>Thử lại</button></div>}
  </div>;
}
