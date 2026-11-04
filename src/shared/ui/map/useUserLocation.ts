import { useCallback, useEffect, useRef, useState } from "react"
import {
  isValidPoint,
  pointLabel,
  reverseGeocode,
  type MapPoint,
} from "@/api/geocoding"
import { getCurrentPoint } from "./geolocation"

export type LocationSource = "gps" | "address" | "map"

export type UserLocation = {
  point: MapPoint
  label: string
  source: LocationSource
  accuracyMeters?: number
}

const fallbackLabel = (source: LocationSource) =>
  source === "gps"
    ? "Vị trí hiện tại của bạn"
    : source === "address"
      ? "Địa chỉ đã chọn"
      : "Vị trí đã chọn trên bản đồ"

export function useUserLocation() {
  const [location, setLocation] = useState<UserLocation | null>(null)
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState("")
  const reverseController = useRef<AbortController | null>(null)

  useEffect(() => () => reverseController.current?.abort(), [])

  const describePoint = useCallback(
    (point: MapPoint, source: LocationSource, accuracyMeters?: number) => {
      reverseController.current?.abort()
      const controller = new AbortController()
      reverseController.current = controller
      setLocation({
        point,
        label: fallbackLabel(source),
        source,
        accuracyMeters,
      })

      void reverseGeocode(point, controller.signal)
        .then((label) => {
          if (controller.signal.aborted) return
          setLocation((current) => {
            if (!current) return current
            const samePoint =
              current.point.latitude === point.latitude &&
              current.point.longitude === point.longitude
            return samePoint ? { ...current, label } : current
          })
        })
        .catch(() => {
          // Giữ nhãn mặc định khi dịch vụ địa chỉ không phản hồi.
        })
    },
    [],
  )

  const locate = useCallback(() => {
    setLocationError("")
    setLocating(true)
    getCurrentPoint()
      .then(({ point, accuracyMeters }) => {
        setLocating(false)
        describePoint(point, "gps", accuracyMeters)
      })
      .catch((error: unknown) => {
        setLocating(false)
        setLocationError(
          error instanceof Error
            ? error.message
            : "Không lấy được vị trí hiện tại.",
        )
      })
  }, [describePoint])

  const setFromMap = useCallback(
    (point: MapPoint, label?: string) => {
      if (!isValidPoint(point)) return
      setLocationError("")
      const trimmed = label?.trim()
      if (trimmed) {
        reverseController.current?.abort()
        setLocation({ point, label: trimmed, source: "map" })
        return
      }
      describePoint(point, "map")
    },
    [describePoint],
  )

  const clear = useCallback(() => {
    reverseController.current?.abort()
    setLocation(null)
    setLocationError("")
    setLocating(false)
  }, [])

  return {
    location,
    locating,
    locationError,
    locate,
    setFromMap,
    clear,
    pointText: location ? pointLabel(location.point) : "",
  }
}
