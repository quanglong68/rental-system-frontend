import type { LatLng, Map as LeafletMap } from "leaflet";

const MOBILE_QUERY = "(max-width: 760px)";

const isMobileLayout = () => typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches;

export function mapPanelPadding(map: LeafletMap, panel: HTMLElement | null) {
  if (isMobileLayout()) {
    return {
      paddingTopLeft: [40, 40] as [number, number],
      paddingBottomRight: [40, 40 + Math.round(map.getSize().y * 0.5)] as [number, number],
    };
  }
  return {
    paddingTopLeft: [40 + (panel?.offsetWidth ?? 0) + 14, 40] as [number, number],
    paddingBottomRight: [40, 40] as [number, number],
  };
}

export function centerBesidePanel(map: LeafletMap, point: LatLng, zoom: number, panel: HTMLElement | null) {
  const dx = isMobileLayout() ? 0 : (panel?.offsetWidth ?? 0) / 2;
  const dy = isMobileLayout() ? Math.round(map.getSize().y * 0.28) : 0;
  return map.unproject(map.project(point, zoom).add([-dx, dy]), zoom);
}
