import { Icon } from "@/shared/ui";
import type { UserLocation } from "./useUserLocation";

type Props = {
  location: UserLocation | null;
  locating: boolean;
  locationError: string;
  pointText: string;
  locate: () => void;
  clear: () => void;
  onOpenPicker: () => void;
};

export default function LocationToolbar({
  location,
  locating,
  locationError,
  pointText,
  locate,
  clear,
  onOpenPicker,
}: Props) {
  return (
    <section className="map-location" aria-label="Vị trí của bạn">
      <div className="map-location-head">
        <span className="map-location-title"><Icon name="pin" size={16} /> Vị trí của bạn</span>
        {location && (
          <button type="button" className="map-location-clear" onClick={clear}>
            <Icon name="close" size={13} /> Xóa vị trí
          </button>
        )}
      </div>

      {location ? (
        <div className="map-location-current">
          <span className="map-location-dot" aria-hidden="true" />
          <span>
            <b>{location.label}</b>
            <small>{pointText}</small>
          </span>
        </div>
      ) : (
        <p className="map-location-hint">
          Chọn vị trí để xem tòa nhà gần nhất, khoảng cách và chỉ đường. Vị trí chỉ dùng trên trình duyệt của bạn.
        </p>
      )}

      <div className="map-location-actions">
        <button
          type="button"
          className="map-location-button"
          onClick={onOpenPicker}
          aria-haspopup="dialog"
        >
          <Icon name="search" size={15} /> Tìm vị trí trên bản đồ
        </button>
        <button type="button" className="map-location-button ghost" onClick={locate} disabled={locating}>
          <Icon name="pin" size={15} /> {locating ? "Đang định vị…" : "Vị trí hiện tại"}
        </button>
      </div>

      {locationError && <p className="map-location-error" role="alert">{locationError}</p>}
    </section>
  );
}
