import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { Icon, vnd } from "@/shared/ui";
import { haversine, formatDistanceMeters, formatDurationSeconds } from "@/shared/lib/geo";
import { googleMapsDirectionsUrl, fetchDrivingRoute, type DrivingRoute } from "@/shared/lib/routing";
import MapShell from "@/shared/ui/map/MapShell";
import { priceMarkerIcon, userMarkerIcon } from "@/shared/ui/map/markerIcons";
import { centerBesidePanel, mapPanelPadding } from "@/shared/ui/map/panelLayout";
import type { BuildingGroup } from "@/features/listings/lib/buildingGroups";
import type { MapPoint } from "@/api/geocoding";
import type { Id } from "@/shared/lib/id";
import RoomThumb from "./RoomThumb";

export type MapRoom = {
  id: string;
  buildingKey: string;
  building: string;
  address: string;
  lat: number | null;
  lng: number | null;
  price: number;
  roomStatus: string;
  type: string;
  roomId: Id;
  code: string;
  capacity: number;
  title: string;
};

type Props<T extends MapRoom> = {
  groups: BuildingGroup<T>[];
  origin: MapPoint | null;
  accuracyMeters?: number;
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  onOpenRoom: (room: T) => void;
};

type ActiveRoute = DrivingRoute & { targetKey: string };

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const priceShort = (price: number) =>
  price >= 1_000_000
    ? `${(price / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tr`
    : `${Math.round(price / 1000).toLocaleString("vi-VN")}K`;

const distanceKm = (origin: MapPoint | null, group: BuildingGroup<MapRoom>) => {
  if (!origin) return null;
  const km = haversine(
    { lat: origin.latitude, lng: origin.longitude },
    { lat: group.latitude, lng: group.longitude },
  );
  return Math.round(km * 10) / 10;
};

export default function ExploreMap<T extends MapRoom>({
  groups,
  origin,
  accuracyMeters,
  selectedKey,
  onSelect,
  onOpenRoom,
}: Props<T>) {
  const mapRef = useRef<L.Map | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const routeController = useRef<AbortController | null>(null);
  const fittedRef = useRef(false);
  const selectRef = useRef(onSelect);
  const openRoomRef = useRef(onOpenRoom);
  const [mapEpoch, setMapEpoch] = useState(0);
  const [route, setRoute] = useState<ActiveRoute | null>(null);
  const [routing, setRouting] = useState(false);
  const [routeError, setRouteError] = useState("");
  const [showAllRooms, setShowAllRooms] = useState(false);

  const selectedGroup = groups.find((group) => group.key === selectedKey) ?? null;
  const firstGroup = groups[0];

  useEffect(() => {
    selectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    openRoomRef.current = onOpenRoom;
  }, [onOpenRoom]);

  useEffect(() => {
    setShowAllRooms(false);
    setRouteError("");
    setRoute((current) => (current && current.targetKey === selectedKey ? current : null));
    if (selectedKey === null) {
      routeController.current?.abort();
      setRouting(false);
    }
  }, [selectedKey]);

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
    for (const group of groups) {
      const marker = L.marker([group.latitude, group.longitude], {
        icon: priceMarkerIcon(priceShort(group.minPrice), group.key === selectedKey),
        title: `${group.name} · từ ${vnd(group.minPrice)}`,
        keyboard: true,
      });
      marker.on("click", () => selectRef.current(group.key));
      marker.addTo(layer);
    }

    if (origin) {
      const point: [number, number] = [origin.latitude, origin.longitude];
      L.marker(point, { icon: userMarkerIcon(), title: "Vị trí của bạn", zIndexOffset: 1000 }).addTo(layer);
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

    if (!fittedRef.current && groups.length > 0) {
      fittedRef.current = true;
      if (!origin) {
        const bounds = L.latLngBounds(groups.map((group) => [group.latitude, group.longitude] as [number, number]));
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [36, 36], maxZoom: 15, animate: false });
        }
      }
    }

    return () => {
      layer.remove();
    };
  }, [mapEpoch, groups, selectedKey, origin, accuracyMeters]);

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
    const group = groups.find((item) => item.key === selectedKey);
    if (!map || !group) return;
    const zoom = Math.max(map.getZoom(), 15);
    const target = centerBesidePanel(map, L.latLng(group.latitude, group.longitude), zoom, panelRef.current);
    if (reducedMotion()) map.setView(target, zoom);
    else map.flyTo(target, zoom, { duration: 0.6 });
  }, [mapEpoch, selectedKey]);

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
  }, [selectedGroup?.key]);

  useEffect(() => {
    if (!selectedGroup) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onSelect(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedGroup, onSelect]);

  const showRoute = async (group: BuildingGroup<T>) => {
    if (!origin) {
      setRouteError("Chọn vị trí của bạn (GPS hoặc nhập địa chỉ) trước khi xem tuyến đường.");
      return;
    }
    routeController.current?.abort();
    const controller = new AbortController();
    routeController.current = controller;
    setRouting(true);
    setRouteError("");
    try {
      const next = await fetchDrivingRoute(origin, { latitude: group.latitude, longitude: group.longitude }, controller.signal);
      if (!controller.signal.aborted) setRoute({ ...next, targetKey: group.key });
    } catch (error) {
      if (!controller.signal.aborted) {
        setRouteError(error instanceof Error ? error.message : "Không tìm được tuyến đường lúc này.");
      }
    } finally {
      if (!controller.signal.aborted) setRouting(false);
    }
  };

  const selectedDistance = selectedGroup ? distanceKm(origin, selectedGroup) : null;
  const rooms = selectedGroup?.rooms ?? [];
  const visibleRooms = showAllRooms ? rooms : rooms.slice(0, 3);
  const activeRoute = route && selectedGroup && route.targetKey === selectedGroup.key ? route : null;

  return (
    <MapShell
      className="cx-map"
      ariaLabel="Bản đồ các tòa nhà và phòng đang mở"
      center={
        origin
          ? [origin.latitude, origin.longitude]
          : firstGroup
            ? [firstGroup.latitude, firstGroup.longitude]
            : undefined
      }
      zoom={origin ? 14 : firstGroup ? 13 : undefined}
      onReady={(map) => {
        mapRef.current = map;
        fittedRef.current = false;
        setMapEpoch((value) => value + 1);
      }}
      onMapClick={() => onSelect(null)}
    >
      {groups.length === 0 && (
        <div className="map-empty" role="status">
          Không có phòng phù hợp trên bản đồ. Hãy thử tăng bán kính hoặc xóa bớt bộ lọc.
        </div>
      )}

      {selectedGroup && (
        <aside
          ref={panelRef}
          className="map-panel"
          aria-label={`Thông tin ${selectedGroup.name}`}
        >
          <div className="map-panel-media">
            <RoomThumb roomId={selectedGroup.rooms[0].roomId} alt={selectedGroup.name} />
            <button type="button" className="map-panel-close" aria-label="Đóng thông tin tòa nhà" onClick={() => onSelect(null)}>
              <Icon name="close" size={16} />
            </button>
          </div>
          <div className="map-panel-body">
            <div className="map-panel-eyebrow">
              <span>{selectedDistance != null ? `Cách bạn ${selectedDistance.toLocaleString("vi-VN")} km` : "Trong khu vực đang xem"}</span>
              <span>{selectedGroup.rooms.length} tin đang mở</span>
            </div>
            <h3 className="map-panel-title">{selectedGroup.name}</h3>
            <p className="map-panel-address">{selectedGroup.address}</p>

            <div className="map-panel-stats">
              <span className="map-panel-stat">Giá từ {vnd(selectedGroup.minPrice)}</span>
              <span className="map-panel-stat">{selectedGroup.vacantCount} phòng còn trống</span>
              <span className="map-panel-stat">{selectedGroup.typeCount} loại phòng</span>
            </div>

            <div className="map-panel-rooms">
              {visibleRooms.map((room) => (
                <div className="map-panel-room" key={room.id}>
                  <div>
                    <b>Phòng {room.code}</b>
                    <small>{room.capacity} người · {room.type || "Chưa rõ loại"}</small>
                  </div>
                  <div className="map-panel-room-action">
                    <strong>{vnd(room.price)}</strong>
                    <button type="button" className="map-action compact" onClick={() => openRoomRef.current(room)}>
                      Đặt
                    </button>
                  </div>
                </div>
              ))}
              {rooms.length > 3 && (
                <button type="button" className="map-action" onClick={() => setShowAllRooms((value) => !value)}>
                  {showAllRooms ? "Thu gọn danh sách" : `Xem tất cả ${rooms.length} phòng`}
                </button>
              )}
            </div>
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
              <button
                type="button"
                className="map-action primary"
                onClick={() => void showRoute(selectedGroup)}
                disabled={routing}
              >
                <Icon name="arrow" size={14} />
                {routing ? "Đang tìm tuyến…" : "Chỉ đường"}
              </button>
              <a
                className="map-action"
                href={googleMapsDirectionsUrl(origin, { latitude: selectedGroup.latitude, longitude: selectedGroup.longitude })}
                target="_blank"
                rel="noreferrer"
              >
                <Icon name="pin" size={14} />
                Google Maps
              </a>
            </div>
          </div>
        </aside>
      )}
    </MapShell>
  );
}
