import { useCallback, useEffect, useRef, useState, type FormEvent } from "react"
import { createPortal } from "react-dom"
import L from "leaflet"
import { Icon } from "@/shared/ui"
import {
  isValidPoint,
  pointLabel,
  reverseGeocode,
  searchPlaces,
  type MapPoint,
  type PlaceResult,
} from "@/api/geocoding"
import { getCurrentPoint } from "./geolocation"
import MapShell from "./MapShell"
import { pickerMarkerIcon } from "./markerIcons"

const DEFAULT_CENTER: [number, number] = [10.7769, 106.7009]
const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches

type Props = {
  initialPoint: MapPoint | null
  initialLabel?: string
  onClose: () => void
  onConfirm: (point: MapPoint, label?: string) => void
}

export default function LocationPickerDialog({
  initialPoint,
  initialLabel,
  onClose,
  onConfirm,
}: Props) {
  const [draft, setDraft] = useState<MapPoint | null>(initialPoint)
  const [draftLabel, setDraftLabel] = useState(initialLabel ?? "")
  const [query, setQuery] = useState("")
  const [places, setPlaces] = useState<PlaceResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState("")
  const [searched, setSearched] = useState(false)
  const [locating, setLocating] = useState(false)
  const [geoError, setGeoError] = useState("")
  const [mapEpoch, setMapEpoch] = useState(0)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const reverseController = useRef<AbortController | null>(null)
  const searchController = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    inputRef.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const root = document.getElementById("root")
    root?.setAttribute("inert", "")
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current()
    }
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = previousOverflow
      root?.removeAttribute("inert")
      reverseController.current?.abort()
      searchController.current?.abort()
      mapRef.current = null
      markerRef.current = null
    }
  }, [])

  const describePoint = useCallback((point: MapPoint) => {
    reverseController.current?.abort()
    const controller = new AbortController()
    reverseController.current = controller
    setDraftLabel("")
    void reverseGeocode(point, controller.signal)
      .then((label) => {
        if (!controller.signal.aborted) setDraftLabel(label)
      })
      .catch(() => {
        // Vẫn cho phép xác nhận theo tọa độ khi dịch vụ địa chỉ không phản hồi.
      })
  }, [])

  const choosePoint = useCallback(
    (point: MapPoint) => {
      if (!isValidPoint(point)) return
      setGeoError("")
      setDraft(point)
      describePoint(point)
    },
    [describePoint],
  )

  useEffect(() => {
    const map = mapRef.current
    if (!map || mapEpoch === 0) return
    if (!draft) {
      markerRef.current?.remove()
      markerRef.current = null
      return
    }
    const latLng: L.LatLngExpression = [draft.latitude, draft.longitude]
    if (markerRef.current) {
      markerRef.current.setLatLng(latLng)
      return
    }
    const marker = L.marker(latLng, {
      icon: pickerMarkerIcon(),
      draggable: true,
      title: "Vị trí đã chọn",
      keyboard: true,
    }).addTo(map)
    marker.on("dragend", () => {
      const value = map.wrapLatLng(marker.getLatLng())
      choosePoint({ latitude: value.lat, longitude: value.lng })
    })
    markerRef.current = marker
  }, [mapEpoch, draft, choosePoint])

  const flyTo = (point: MapPoint) => {
    const map = mapRef.current
    if (!map) return
    const target: [number, number] = [point.latitude, point.longitude]
    if (reducedMotion()) map.setView(target, 16)
    else map.flyTo(target, 16, { duration: 0.6 })
  }

  const runSearch = async (event: FormEvent) => {
    event.preventDefault()
    searchController.current?.abort()
    const controller = new AbortController()
    searchController.current = controller
    setSearching(true)
    setSearchError("")
    setSearched(false)
    setPlaces([])
    try {
      const matches = await searchPlaces(query, controller.signal)
      if (controller.signal.aborted) return
      setPlaces(matches)
      setSearched(true)
    } catch (error) {
      if (!controller.signal.aborted) {
        setSearchError(
          error instanceof Error
            ? error.message
            : "Không tìm được địa chỉ lúc này.",
        )
      }
    } finally {
      if (!controller.signal.aborted) setSearching(false)
    }
  }

  const selectPlace = (place: PlaceResult) => {
    reverseController.current?.abort()
    setGeoError("")
    setQuery(place.label)
    setPlaces([])
    setSearched(false)
    setSearchError("")
    setDraft({ latitude: place.latitude, longitude: place.longitude })
    setDraftLabel(place.label)
    flyTo(place)
  }

  const useCurrentPoint = () => {
    setGeoError("")
    setLocating(true)
    getCurrentPoint()
      .then(({ point }) => {
        setLocating(false)
        choosePoint(point)
        flyTo(point)
      })
      .catch((error: unknown) => {
        setLocating(false)
        setGeoError(
          error instanceof Error
            ? error.message
            : "Không lấy được vị trí hiện tại.",
        )
      })
  }

  const confirm = () => {
    if (draft) onConfirm(draft, draftLabel.trim() || undefined)
  }

  return createPortal(
    <div
      className="map-picker-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="map-picker"
        role="dialog"
        aria-modal="true"
        aria-labelledby="map-picker-title"
      >
        <header className="map-picker-head">
          <div>
            <p className="map-picker-eyebrow">Vị trí của bạn</p>
            <h2 id="map-picker-title">Tìm vị trí trên bản đồ</h2>
          </div>
          <button
            type="button"
            className="map-picker-close"
            onClick={onClose}
            aria-label="Đóng bản đồ chọn vị trí"
          >
            <Icon name="close" size={18} />
          </button>
        </header>

        <form
          className="map-picker-search map-location-search"
          onSubmit={(event) => void runSearch(event)}
        >
          <label className="map-location-input">
            <Icon name="search" size={16} />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nhập số nhà, đường, quận…"
              aria-label="Tìm địa chỉ trên bản đồ"
              autoComplete="off"
            />
          </label>
          <button
            type="submit"
            className="map-location-button"
            disabled={searching}
          >
            {searching ? "Đang tìm…" : "Tìm"}
          </button>
          <button
            type="button"
            className="map-location-button ghost"
            onClick={useCurrentPoint}
            disabled={locating}
          >
            <Icon name="pin" size={15} />{" "}
            {locating ? "Đang định vị…" : "Vị trí hiện tại"}
          </button>
        </form>

        {searchError && (
          <p
            className="map-picker-message map-picker-message-error"
            role="alert"
          >
            {searchError}
          </p>
        )}
        {searched && places.length === 0 && !searchError && (
          <p className="map-picker-message">
            Không tìm thấy địa chỉ phù hợp. Hãy nhập rõ hơn hoặc chấm trực tiếp
            trên bản đồ.
          </p>
        )}
        {places.length > 0 && (
          <ul
            className="map-location-results map-picker-results"
            aria-label="Địa chỉ tìm thấy"
          >
            {places.map((place) => (
              <li key={place.id}>
                <button type="button" onClick={() => selectPlace(place)}>
                  <Icon name="pin" size={15} />
                  <span>{place.label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="map-picker-stage">
          <MapShell
            className="map-picker-map"
            ariaLabel="Bản đồ tìm vị trí của bạn"
            center={draft ? [draft.latitude, draft.longitude] : DEFAULT_CENTER}
            zoom={draft ? 15 : 12}
            onReady={(map) => {
              mapRef.current = map
              setMapEpoch((value) => value + 1)
            }}
            onMapClick={choosePoint}
          />
          <p className="map-picker-tip">
            Chấm lên bản đồ hoặc kéo ghim để chọn vị trí chính xác hơn.
          </p>
        </div>

        <footer className="map-picker-foot">
          <div className="map-picker-selected">
            <span className="map-location-dot" aria-hidden="true" />
            <span>
              <b>
                {draft
                  ? draftLabel || "Vị trí đã chọn trên bản đồ"
                  : "Chưa chọn vị trí"}
              </b>
              <small>
                {draft
                  ? pointLabel(draft)
                  : "Tìm địa chỉ hoặc chấm trực tiếp trên bản đồ."}
              </small>
            </span>
          </div>
          {geoError && (
            <p
              className="map-picker-message map-picker-message-error"
              role="alert"
            >
              {geoError}
            </p>
          )}
          <div className="map-picker-foot-actions">
            <button
              type="button"
              className="map-location-button ghost"
              onClick={onClose}
            >
              Hủy
            </button>
            <button
              type="button"
              className="map-location-button"
              onClick={confirm}
              disabled={!draft}
            >
              Dùng vị trí này
            </button>
          </div>
        </footer>
      </section>
    </div>,
    document.body,
  )
}
