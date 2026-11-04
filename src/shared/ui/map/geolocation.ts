import { isValidPoint, type MapPoint } from "@/api/geocoding";

export type CurrentPoint = { point: MapPoint; accuracyMeters?: number };

export function geolocationErrorMessage(error: GeolocationPositionError): string {
  if (error.code === error.PERMISSION_DENIED) {
    return "Bạn chưa cấp quyền vị trí. Hãy cho phép trình duyệt truy cập vị trí hoặc tìm địa chỉ trên bản đồ.";
  }
  if (error.code === error.POSITION_UNAVAILABLE) {
    return "Không xác định được vị trí hiện tại. Hãy thử lại hoặc tìm địa chỉ trên bản đồ.";
  }
  return "Lấy vị trí quá lâu. Hãy thử lại hoặc tìm địa chỉ trên bản đồ.";
}

export function getCurrentPoint(): Promise<CurrentPoint> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.reject(new Error("Trình duyệt không hỗ trợ định vị. Hãy tìm địa chỉ trên bản đồ."));
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        if (!isValidPoint(point)) {
          reject(new Error("Trình duyệt trả về tọa độ không hợp lệ. Hãy tìm địa chỉ trên bản đồ."));
          return;
        }
        const accuracyMeters = Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : undefined;
        resolve({ point, accuracyMeters });
      },
      (error) => reject(new Error(geolocationErrorMessage(error))),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  });
}
