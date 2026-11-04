import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import MapShell from "@/shared/ui/map/MapShell";
import type { MapPoint } from "@/api/geocoding";

const markerIcon = L.divIcon({
  className: "building-map-marker",
  html: '<span aria-hidden="true"></span>',
  iconSize: [26, 26],
  iconAnchor: [13, 26],
});

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function BuildingLocationMap({
  position,
  focusKey,
  onSelect,
}: {
  position: MapPoint | null;
  focusKey: number;
  onSelect: (point: MapPoint) => void;
}) {
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const selectRef = useRef(onSelect);
  const [mapEpoch, setMapEpoch] = useState(0);

  useEffect(() => {
    selectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const map = mapRef.current;
    if (mapEpoch === 0 || !map) return;
    if (!position) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    const latLng: L.LatLngExpression = [position.latitude, position.longitude];
    if (markerRef.current) {
      markerRef.current.setLatLng(latLng);
      return;
    }
    const marker = L.marker(latLng, { draggable: true, icon: markerIcon, title: "Vị trí tòa nhà" }).addTo(map);
    marker.on("dragend", () => {
      const value = map.wrapLatLng(marker.getLatLng());
      selectRef.current({ latitude: value.lat, longitude: value.lng });
    });
    markerRef.current = marker;
  }, [mapEpoch, position]);

  useEffect(() => {
    if (focusKey <= 0 || !position || !mapRef.current) return;
    const target: [number, number] = [position.latitude, position.longitude];
    if (reducedMotion()) mapRef.current.setView(target, 16);
    else mapRef.current.flyTo(target, 16);
  }, [focusKey]);

  return (
    <MapShell
      className="building-map-shell"
      ariaLabel="Bản đồ chọn vị trí tòa nhà"
      center={position ? [position.latitude, position.longitude] : undefined}
      zoom={position ? 16 : undefined}
      onReady={(map) => {
        mapRef.current = map;
        markerRef.current = null;
        setMapEpoch((value) => value + 1);
      }}
      onMapClick={(point) => selectRef.current(point)}
    />
  );
}
