import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { Icon } from "@/shared/ui";
import { formatDistanceMeters, formatDurationSeconds, haversine } from "@/shared/lib/geo";
import { fetchDrivingRoute, googleMapsDirectionsUrl, type DrivingRoute } from "@/shared/lib/routing";
import MapShell from "@/shared/ui/map/MapShell";
import { buildingMarkerIcon, userMarkerIcon } from "@/shared/ui/map/markerIcons";
import { centerBesidePanel, mapPanelPadding } from "@/shared/ui/map/panelLayout";
import type { MapPoint } from "@/api/geocoding";
import type { BuildingSearchResult, BuildingStatus } from "@/features/properties/api/propertyApi";

const STATUS_LABEL: Record<BuildingStatus, string> = {
  ACTIVE: "Đang hoạt động",
  INACTIVE: "Tạm ngừng",
  MAINTENANCE: "Đang bảo trì",
  CLOSED: "Đã đóng",
};

type Props = {
  buildings: BuildingSearchResult[];
  origin: MapPoint | null;
  accuracyMeters?: number;
  selectedId: string | null;
  loading: boolean;
  error: string;
  onSelect: (id: string | null) => void;
  onEdit: (building: BuildingSearchResult) => void;
  onViewRooms: (building: BuildingSearchResult) => void;
  onRetry: () => void;
};

type ActiveRoute = DrivingRoute & { targetId: string };

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function BuildingOverviewMap({
  buildings,
  origin,
  accuracyMeters,
  selectedId,
  loading,
  error,
  onSelect,
  onEdit,
  onViewRooms,
  onRetry,
}: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const routeController = useRef<AbortController | null>(null);
  const fittedRef = useRef(false);
  const selectRef = useRef(onSelect);
  const [mapEpoch, setMapEpoch] = useState(0);
  const [route, setRoute] = useState<ActiveRoute | null>(null);
  const [routing, setRouting] = useState(false);
  const [routeError, setRouteError] = useState("");

  const selected = buildings.find((building) => building.buildingId === selectedId) ?? null;
  const first = buildings[0];

  useEffect(() => {
    selectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    setRouteError("");
    setRoute((current) => (current && current.targetId === selectedId ? current : null));
    if (selectedId === null) {
      routeController.current?.abort();
      setRouting(false);
    }
  }, [selectedId]);

  useEffect(() => {
    setRoute(null);
    setRouteError("");
    routeController.current?.abort();
    setRouting(false);
  }, [origin?.latitude, origin?.longitude]);

  useEffect(() => () => routeController.current?.abort(), []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || mapEpoch === 0) return;

    const layer = L.layerGroup().addTo(map);
    for (const building of buildings) {
      const marker = L.marker([building.latitude, building.longitude], {
        icon: buildingMarkerIcon(building.buildingStatus, building.buildingId === selectedId),
        title: `${building.name} · ${STATUS_LABEL[building.buildingStatus]}`,
        alt: building.name,
        keyboard: true,
      });
      marker.on("click", () => selectRef.current(building.buildingId));
      marker.addTo(layer);
    }

    if (origin) {
      const point: [number, number] = [origin.latitude, origin.longitude];
      L.marker(point, { icon: userMarkerIcon(), title: "Vị trí đang xem", zIndexOffset: 1000 }).addTo(layer);
      if (accuracyMeters && Number.isFinite(accuracyMeters) && accuracyMeters > 0) {
        L.circle(point, {
          radius: accuracyMeters,
          color: "#2563eb",
          weight: 1,
          opacity: 0.45,
          fillColor: "#2563eb",
          fillOpacity: 0.08,
        }).addTo(layer);
      }
    }

    if (!fittedRef.current && buildings.length > 0 && !origin) {
      fittedRef.current = true;
      const bounds = L.latLngBounds(buildings.map((building) => [building.latitude, building.longitude] as [number, number]));
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15, animate: false });
    }

    return () => {
      layer.remove();
    };
  }, [mapEpoch, buildings, selectedId, origin, accuracyMeters]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !origin) return;
    const target: [number, number] = [origin.latitude, origin.longitude];
    const zoom = Math.max(map.getZoom(), 14);
    if (reducedMotion()) map.setView(target, zoom);
    else map.flyTo(target, zoom, { duration: 0.7 });
  }, [mapEpoch, origin?.latitude, origin?.longitude]);

  useEffect(() => {
    const map = mapRef.current;
    const building = buildings.find((item) => item.buildingId === selectedId);
    if (!map || !building) return;
    const zoom = Math.max(map.getZoom(), 15);
    const target = centerBesidePanel(map, L.latLng(building.latitude, building.longitude), zoom, panelRef.current);
    if (reducedMotion()) map.setView(target, zoom);
    else map.flyTo(target, zoom, { duration: 0.6 });
  }, [mapEpoch, selectedId, buildings]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !route) return;
    const layer = L.layerGroup().addTo(map);
    const line = L.polyline(route.coordinates, {
      color: "#16796f",
      weight: 5,
      opacity: 0.9,
      lineJoin: "round",
    }).addTo(layer);
    const bounds = line.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, {
        ...mapPanelPadding(map, panelRef.current),
        maxZoom: 16,
        animate: !reducedMotion(),
      });
    }
    return () => {
      layer.remove();
    };
  }, [route, mapEpoch]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    L.DomEvent.disableClickPropagation(panel);
    L.DomEvent.disableScrollPropagation(panel);
  }, [selected?.buildingId]);

  useEffect(() => {
    if (!selected) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onSelect(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, onSelect]);

  const showRoute = async (building: BuildingSearchResult) => {
    if (!origin) {
      setRouteError("Chọn vị trí đang xem (GPS, địa chỉ hoặc chấm trên bản đồ) trước khi xem tuyến đường.");
      return;
    }
    routeController.current?.abort();
    const controller = new AbortController();
    routeController.current = controller;
    setRouting(true);
    setRouteError("");
    try {
      const next = await fetchDrivingRoute(
        origin,
        { latitude: building.latitude, longitude: building.longitude },
        controller.signal,
      );
      if (!controller.signal.aborted) setRoute({ ...next, targetId: building.buildingId });
    } catch (cause) {
      if (!controller.signal.aborted) {
        setRouteError(cause instanceof Error ? cause.message : "Không tìm được tuyến đường lúc này.");
      }
    } finally {
      if (!controller.signal.aborted) setRouting(false);
    }
  };

  const selectedDistance = selected && origin
    ? formatDistanceMeters(
        haversine(
          { lat: origin.latitude, lng: origin.longitude },
          { lat: selected.latitude, lng: selected.longitude },
        ) * 1000,
      )
    : null;
  const activeRoute = route && selected && route.targetId === selected.buildingId ? route : null;
  const area = selected
    ? [selected.wardName, selected.provinceName].filter(Boolean).join(", ") || "Chưa có tên địa bàn"
    : "";

  return (
    <MapShell
      className="building-overview-map"
      ariaLabel="Bản đồ vị trí các tòa nhà"
      center={
        origin
          ? [origin.latitude, origin.longitude]
          : first
            ? [first.latitude, first.longitude]
            : undefined
      }
      zoom={origin ? 14 : first ? 13 : undefined}
      onReady={(map) => {
        mapRef.current = map;
        fittedRef.current = false;
        setMapEpoch((value) => value + 1);
      }}
      onMapClick={() => onSelect(null)}
    >
      {loading && <div className="map-empty" role="status">Đang tải vị trí các tòa nhà…</div>}
      {!loading && error && (
        <div className="map-empty map-empty-error" role="alert">
          <span>Không tải được vị trí tòa nhà: {error}</span>
          <button type="button" className="map-action" onClick={onRetry}>Thử lại</button>
        </div>
      )}
      {!loading && !error && buildings.length === 0 && (
        <div className="map-empty" role="status">
          Không có tòa nhà nào khớp bộ lọc hiện tại. Hãy đổi bộ lọc hoặc thêm tòa nhà mới.
        </div>
      )}

      {selected && (
        <aside ref={panelRef} className="map-panel" aria-label={`Thông tin ${selected.name}`}>
          <div className="map-panel-media">
            {selected.buildingUrlImage ? (
              <img src={selected.buildingUrlImage} alt={`Ảnh tòa nhà ${selected.name}`} loading="lazy" />
            ) : (
              <span className="map-panel-fallback" aria-hidden="true"><Icon name="building" size={40} /></span>
            )}
            <button
              type="button"
              className="map-panel-close"
              aria-label="Đóng thông tin tòa nhà"
              onClick={() => onSelect(null)}
            >
              <Icon name="close" size={16} />
            </button>
          </div>
          <div className="map-panel-body">
            <div className="map-panel-eyebrow">
              <span>{selectedDistance ? `Cách điểm xem ${selectedDistance}` : "Vị trí trên bản đồ"}</span>
              <span>{STATUS_LABEL[selected.buildingStatus]}</span>
            </div>
            <h3 className="map-panel-title">{selected.name}</h3>
            <p className="map-panel-address">{selected.address}</p>
            <p className="map-panel-address">{area}</p>
            {selected.description?.trim() && <p className="map-panel-address">{selected.description}</p>}
          </div>

          <div className="map-panel-foot">
            {activeRoute && (
              <div className="map-panel-route">
                <span>Lái xe {formatDistanceMeters(activeRoute.distanceMeters)} · {formatDurationSeconds(activeRoute.durationSeconds)}</span>
                <button type="button" onClick={() => setRoute(null)}>Xóa tuyến</button>
              </div>
            )}
            {routeError && <p className="map-panel-message" role="alert">{routeError}</p>}

            <div className="map-panel-actions">
              <button type="button" className="map-action primary" onClick={() => onViewRooms(selected)}>
                <Icon name="building" size={14} /> Xem phòng
              </button>
              <button type="button" className="map-action" onClick={() => onEdit(selected)}>
                <Icon name="edit" size={14} /> Sửa
              </button>
            </div>
            <div className="map-panel-actions">
              <button
                type="button"
                className="map-action"
                onClick={() => void showRoute(selected)}
                disabled={!origin || routing}
                title={origin ? undefined : "Chọn vị trí đang xem để xem tuyến đường"}
              >
                <Icon name="arrow" size={14} /> {routing ? "Đang tìm tuyến…" : "Chỉ đường"}
              </button>
              <a
                className="map-action"
                href={googleMapsDirectionsUrl(origin, { latitude: selected.latitude, longitude: selected.longitude })}
                target="_blank"
                rel="noreferrer"
              >
                <Icon name="pin" size={14} /> Google Maps
              </a>
            </div>
          </div>
        </aside>
      )}
    </MapShell>
  );
}
