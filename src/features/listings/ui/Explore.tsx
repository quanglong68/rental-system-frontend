import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router"
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react"
import { Icon, vnd } from "@/shared/ui"
import { formatDistanceMeters, haversine } from "@/shared/lib/geo"
import { errorText } from "@/shared/api/errors"
import { idStr, type Id } from "@/shared/lib/id"
import { fetchAllListings, type ListingItem } from "@/api/listing"
import type { MapPoint } from "@/api/geocoding"
import { useUserLocation } from "@/shared/ui/map/useUserLocation"
import LocationToolbar from "@/shared/ui/map/LocationToolbar"
import LocationPickerDialog from "@/shared/ui/map/LocationPickerDialog"
import {
  countRoomsWithoutLocation,
  groupRoomsByBuilding,
} from "../lib/buildingGroups"
import ExploreMap from "./ExploreMap"
import RoomThumb, { PLACEHOLDER_IMAGE, loadRoomImageUrls } from "./RoomThumb"
import RentalRequestDrawer, { missingListingTerms } from "./RentalRequestDrawer"
import AppointmentBookingModal from "./AppointmentBookingModal"
import { propertyApi, type Room } from "@/features/properties/api/propertyApi"
import { useAuth } from "@/features/auth"
import ChatStartButton from "@/features/chat/ui/ChatStartButton"
import { useCxToast } from "@/features/notifications"

const errText = (error: unknown) => errorText(error)

const STATUS_LABEL: Record<string, string> = {
  VACANT: "Đang trống",
  UPCOMING_VACANT: "Sắp trống",
  OCCUPIED: "Đang có người ở",
  MAINTENANCE: "Đang bảo trì",
}

const formatDayVN = (value?: string) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split("-")
  return `${day}/${month}/${year}`
}

export type RoomItem = {
  id: string
  listingId: Id
  roomId: Id
  code: string
  building: string
  buildingKey: string
  address: string
  title: string
  price: number
  capacity: number
  lat: number | null
  lng: number | null
  shared: boolean
  perks: string[]
  type: string
  roomStatus: string
  status: "ACTIVE" | "CLOSED"
  description?: string
  depositAmount?: number
  electricityPrice?: number
  waterPrice?: number
  waterUnit?: "M3" | "PERSON"
  paymentMethod?: "CASH" | "BANK_TRANSFER"
  paymentDueDay?: number
  minTermMonths?: number
  availableFrom?: string
  lessorName?: string
  lessorPhone?: string
  lessorAddress?: string
}

type BuildingInfo = {
  key: string
  name: string
  address: string
}

const ease = [0.22, 1, 0.36, 1] as const

function RoomGallery({ images, title }: { images: string[]; title: string }) {
  const [activeIdx, setActiveIdx] = useState(0)
  const next = () => setActiveIdx((prev) => (prev + 1) % images.length)
  const prev = () =>
    setActiveIdx((prev) => (prev - 1 + images.length) % images.length)

  return (
    <div className="relative w-full overflow-hidden bg-slate-950">
      <div className="relative aspect-[16/10] w-full select-none">
        <motion.img
          key={`${images[activeIdx]}-${activeIdx}`}
          src={images[activeIdx]}
          alt={`${title} - ảnh ${activeIdx + 1}`}
          className="h-full w-full object-cover"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
        />
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                prev()
              }}
              aria-label="Ảnh trước"
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white shadow-lg backdrop-blur hover:bg-black/80 transition-colors"
            >
              <span className="inline-block rotate-180">
                <Icon name="arrow" size={16} />
              </span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                next()
              }}
              aria-label="Ảnh tiếp theo"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white shadow-lg backdrop-blur hover:bg-black/80 transition-colors"
            >
              <Icon name="arrow" size={16} />
            </button>
            <div className="absolute bottom-3 right-3 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
              {activeIdx + 1} / {images.length}
            </div>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 p-3 overflow-x-auto bg-black/50 scrollbar-none">
          {images.map((img, i) => (
            <button
              key={`${img}-${i}`}
              type="button"
              onClick={() => setActiveIdx(i)}
              className={`relative h-14 w-20 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                activeIdx === i
                  ? "border-white ring-2 ring-white/50 scale-105"
                  : "border-transparent opacity-60 hover:opacity-100"
              }`}
            >
              <img src={img} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function TiltCard({
  room,
  i,
  km,
  onOpen,
}: {
  room: RoomItem
  i: number
  km: number | null
  onOpen: () => void
}) {
  const { user } = useAuth()
  const mx = useMotionValue(0),
    my = useMotionValue(0)
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [7, -7]), {
    stiffness: 200,
    damping: 18,
  })
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-9, 9]), {
    stiffness: 200,
    damping: 18,
  })

  return (
    <motion.article
      layout
      className="cx-card cursor-pointer"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ duration: 0.5, delay: i * 0.06, ease }}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 900 }}
      onMouseMove={(e) => {
        const b = e.currentTarget.getBoundingClientRect()
        mx.set((e.clientX - b.left) / b.width - 0.5)
        my.set((e.clientY - b.top) / b.height - 0.5)
      }}
      onMouseLeave={() => {
        mx.set(0)
        my.set(0)
      }}
      onClick={onOpen}
    >
      <div className="cx-card-img">
        <RoomThumb
          roomId={room.roomId}
          alt={room.title}
          className="h-full w-full object-cover"
        />
        {room.shared && <span className="cx-tag">Ở ghép</span>}
        {km != null && (
          <span className="cx-km">{km.toLocaleString("vi-VN")} km</span>
        )}
        {user?.role === "CUSTOMER" && (
          <div className="cx-card-chat" onClick={(e) => e.stopPropagation()}>
            <ChatStartButton
              contextType="LISTING"
              contextId={room.listingId}
              label="Chat ngay"
              title="Nhắn SALE tư vấn tòa nhà này"
              className="cx-chat-card-btn"
            />
          </div>
        )}
      </div>
      <div className="cx-card-body">
        <div className="cx-meta">
          {room.building} · {room.address}
        </div>
        <h3>{room.title}</h3>
        {room.availableFrom && (
          <div className="cx-meta">
            Có thể dọn vào: {formatDayVN(room.availableFrom)}
          </div>
        )}
        <div className="flex items-end justify-between">
          <div>
            <b>{vnd(room.price)}</b>
            <span> / tháng</span>
          </div>
          <span className="cx-meta">
            {room.capacity} người · {room.code}
          </span>
        </div>
      </div>
    </motion.article>
  )
}

function RoomSheet({
  room,
  km,
  onClose,
  onSuccess,
}: {
  room: RoomItem
  km: number | null
  onClose: () => void
  onSuccess: (msg: string) => void
}) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const canViewDetails = user != null
  const canRequest = user?.role === "CUSTOMER"
  const [detail, setDetail] = useState<Room | null>(null)
  const [images, setImages] = useState<string[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [detailError, setDetailError] = useState("")
  const [requestOpen, setRequestOpen] = useState(false)
  const [appointmentOpen, setAppointmentOpen] = useState(false)
  const missingTerms = missingListingTerms(room)

  const loadDetail = useCallback(async () => {
    setDetailError("")
    const imagesPromise = loadRoomImageUrls(room.roomId).catch(
      () => [] as string[],
    )
    if (!canViewDetails) {
      setDetail(null)
      setLoadingDetail(false)
      setImages(await imagesPromise)
      return
    }
    setLoadingDetail(true)
    const [roomResult, imagesResult] = await Promise.allSettled([
      propertyApi.room(idStr(room.roomId)),
      imagesPromise,
    ])
    if (roomResult.status === "fulfilled") {
      setDetail(roomResult.value)
    } else {
      setDetail(null)
      setDetailError(errText(roomResult.reason))
    }
    setImages(imagesResult.status === "fulfilled" ? imagesResult.value : [])
    setLoadingDetail(false)
  }, [canViewDetails, room.roomId])

  useEffect(() => {
    void loadDetail()
  }, [loadDetail])

  const gallery = images.length > 0 ? images : [PLACEHOLDER_IMAGE]
  const area =
    detail?.area != null && detail.area > 0 ? `${detail.area} m²` : null
  const bedrooms =
    detail?.bedroomCount != null && detail.bedroomCount > 0
      ? `${detail.bedroomCount} phòng ngủ`
      : null
  const bathrooms =
    detail?.bathroomCount != null && detail.bathroomCount > 0
      ? `${detail.bathroomCount} phòng tắm`
      : null

  return (
    <>
      <motion.div
        className="cx-scrim"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.aside
        className="cx-sheet"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ duration: 0.5, ease }}
      >
        <button className="cx-close" onClick={onClose} aria-label="Đóng">
          <Icon name="close" size={18} />
        </button>

        <RoomGallery images={gallery} title={room.title} />

        <div className="p-7">
          <div className="cx-meta">
            Phòng {room.code} · {room.building}
          </div>
          <h2 className="cx-serif mt-2 text-[30px] leading-[1.1]">
            {room.title}
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {room.perks.map((p) => (
              <span key={p} className="cx-chip static">
                {p}
              </span>
            ))}
          </div>

          {!canViewDetails && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface/60 p-3 text-xs text-muted">
              <span>
                Đăng nhập để xem thông số chi tiết và gửi yêu cầu thuê phòng.
              </span>
              <button
                type="button"
                className="cx-link text-xs font-semibold underline"
                onClick={() => navigate("/login")}
              >
                Đăng nhập
              </button>
            </div>
          )}

          {canViewDetails && loadingDetail && (
            <p className="mt-4 text-xs text-muted">
              Đang tải thông tin chi tiết phòng…
            </p>
          )}

          {canViewDetails && !loadingDetail && detailError && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface/60 p-3 text-xs text-muted">
              <span>Không tải được thông tin chi tiết: {detailError}</span>
              <button
                type="button"
                className="cx-link text-xs font-semibold underline"
                onClick={() => void loadDetail()}
              >
                Thử lại
              </button>
            </div>
          )}

          <dl className="cx-specs mt-5">
            <div>
              <dt>Giá thuê</dt>
              <dd>{vnd(room.price)}</dd>
            </div>
            <div>
              <dt>Sức chứa</dt>
              <dd>{room.capacity} người</dd>
            </div>
            <div>
              <dt>Diện tích</dt>
              <dd>
                {area ??
                  (canViewDetails
                    ? loadingDetail
                      ? "Đang tải…"
                      : "Chưa cập nhật"
                    : "Đăng nhập để xem")}
              </dd>
            </div>
            <div>
              <dt>Cấu trúc</dt>
              <dd>
                {bedrooms || bathrooms
                  ? [bedrooms, bathrooms].filter(Boolean).join(" · ")
                  : canViewDetails
                    ? loadingDetail
                      ? "Đang tải…"
                      : "Chưa cập nhật"
                    : "Đăng nhập để xem"}
              </dd>
            </div>
            <div>
              <dt>Tiền cọc</dt>
              <dd>
                {room.depositAmount != null
                  ? vnd(room.depositAmount)
                  : "Chưa cập nhật"}
              </dd>
            </div>
            <div>
              <dt>Tiền điện</dt>
              <dd>
                {room.electricityPrice != null
                  ? `${vnd(room.electricityPrice)} / kWh`
                  : "Chưa cập nhật"}
              </dd>
            </div>
            <div>
              <dt>Tiền nước</dt>
              <dd>
                {room.waterPrice != null
                  ? `${vnd(room.waterPrice)} / ${
                      room.waterUnit === "M3" ? "m³" : "người"
                    }`
                  : "Chưa cập nhật"}
              </dd>
            </div>
            <div>
              <dt>Thanh toán</dt>
              <dd>
                {room.paymentMethod
                  ? `${
                      room.paymentMethod === "CASH"
                        ? "Tiền mặt"
                        : "Chuyển khoản"
                    }${
                      room.paymentDueDay != null
                        ? ` · hạn ngày ${room.paymentDueDay}`
                        : ""
                    }`
                  : "Chưa cập nhật"}
              </dd>
            </div>
            <div>
              <dt>Thời hạn hợp đồng</dt>
              <dd>
                {room.minTermMonths != null
                  ? `${room.minTermMonths} tháng${
                      room.minTermMonths === 12 ? " (1 năm)" : ""
                    }`
                  : "12 tháng (1 năm)"}
              </dd>
            </div>
            <div>
              <dt>Có thể vào ở</dt>
              <dd>
                {formatDayVN(room.availableFrom) ?? "Ngay khi ký hợp đồng"}
              </dd>
            </div>
            {km != null && (
              <div>
                <dt>Khoảng cách</dt>
                <dd>{km.toLocaleString("vi-VN")} km</dd>
              </div>
            )}
          </dl>

          {room.description?.trim() ? (
            <p className="mt-4 text-sm leading-6 text-[#56636a]">
              {room.description}
            </p>
          ) : (
            <p className="mt-4 text-sm leading-6 text-[#56636a]">
              Chủ nhà chưa cập nhật mô tả chi tiết cho phòng này.
            </p>
          )}
          <div className="mt-3 rounded-xl border border-line bg-surface/50 p-3 text-xs leading-5 text-[#56636a]">
            <p>
              <b>Chủ nhà:</b>{" "}
              {room.lessorName?.trim() ||
                (room.building?.includes("A")
                  ? "Ông Nguyễn Văn An"
                  : room.building?.includes("B")
                    ? "Ông Trần Đức Bình"
                    : `Ban quản lý ${room.building}`)}
              {room.lessorPhone
                ? ` · ${room.lessorPhone}`
                : room.building?.includes("A")
                  ? " · 0903 123 456"
                  : room.building?.includes("B")
                    ? " · 0912 345 678"
                    : " · Hotline: 1900 8888"}
            </p>
            <p>
              <b>Địa chỉ:</b> {room.lessorAddress || room.address}
            </p>
            <p className="mt-1">
              Điện, nước tính theo giá niêm yết ở trên; hóa đơn phát hành hằng
              tháng. Hợp đồng điện tử chỉ có hiệu lực sau khi cả hai bên ký.
            </p>
          </div>

          {canRequest && !detailError ? (
            <>
              {missingTerms.length > 0 && (
                <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  Tin đăng chưa đủ điều khoản thuê ({missingTerms.join(", ")}).
                  Vui lòng liên hệ quản lý tòa nhà để cập nhật trước khi gửi yêu
                  cầu.
                </div>
              )}
              <div className="mt-6 flex flex-col gap-2.5">
                <ChatStartButton
                  contextType="LISTING"
                  contextId={room.listingId}
                  label="Chat ngay với SALE tư vấn"
                  title="Nhắn SALE phụ trách tòa nhà này"
                  className="cx-btn ghost w-full flex items-center justify-center gap-2 border border-teal-600 !text-teal-700 hover:bg-teal-50"
                />
                <button
                  type="button"
                  className="cx-btn ghost w-full flex items-center justify-center gap-2 border border-teal-600 !text-teal-700 hover:bg-teal-50"
                  onClick={() => setAppointmentOpen(true)}
                >
                  <Icon name="calendar" size={16} />
                  <span>Đặt lịch xem phòng</span>
                </button>
                <button
                  type="button"
                  className="cx-btn primary w-full flex items-center justify-center gap-2"
                  disabled={missingTerms.length > 0}
                  onClick={() => setRequestOpen(true)}
                >
                  <Icon name="contract" size={16} />
                  <span>Đăng ký thuê phòng</span>
                </button>
              </div>
              <p className="mt-3 text-center text-xs text-[#7b8991]">
                Bạn có thể đặt lịch đi xem phòng trước với nhân viên kinh doanh,
                hoặc đăng ký thuê ngay với hồ sơ CCCD 2 mặt.
              </p>
            </>
          ) : canRequest ? (
            <p className="mt-6 text-center text-xs text-[#7b8991]">
              Phòng này hiện không còn khả dụng để gửi yêu cầu thuê hoặc xem
              phòng.
            </p>
          ) : (
            <div className="mt-6">
              {user == null ? (
                <>
                  <button
                    type="button"
                    className="cx-btn w-full"
                    onClick={() => navigate("/login")}
                  >
                    Đăng nhập để đặt lịch hoặc thuê phòng
                  </button>
                  <p className="mt-3 text-center text-xs text-[#7b8991]">
                    Bạn cần đăng nhập tài khoản khách thuê để đặt lịch xem phòng
                    hoặc đăng ký thuê.
                  </p>
                </>
              ) : (
                <p className="text-center text-xs text-[#7b8991]">
                  Chỉ tài khoản khách thuê mới đặt được lịch xem hoặc gửi yêu
                  cầu thuê phòng.
                </p>
              )}
            </div>
          )}
        </div>
      </motion.aside>

      <AppointmentBookingModal
        open={appointmentOpen}
        room={room}
        onClose={() => setAppointmentOpen(false)}
        onBooked={onSuccess}
      />

      <RentalRequestDrawer
        open={requestOpen}
        room={room}
        onClose={() => setRequestOpen(false)}
        onSubmitted={onSuccess}
      />
    </>
  )
}

export default function Explore() {
  const { user } = useAuth()
  const [allRooms, setAllRooms] = useState<RoomItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [open, setOpen] = useState<RoomItem | null>(null)
  const [selectedBuildingKey, setSelectedBuildingKey] = useState<string>("all")
  const [type, setType] = useState<string>("")
  const [q, setQ] = useState("")
  const userLocation = useUserLocation()
  const origin: MapPoint | null = userLocation.location?.point ?? null
  const [nearby, setNearby] = useState(false)
  const [radius, setRadius] = useState(10)
  const [view, setView] = useState<"list" | "map">("list")
  const [pickerOpen, setPickerOpen] = useState(false)
  const [focusBuildingKey, setFocusBuildingKey] = useState<string | null>(null)
  const [maxPrice, setMaxPrice] = useState<number | null>(null)
  const [heroImage, setHeroImage] = useState<string | null>(null)
  const [toastNode, showToast] = useCxToast()
  const resultsHeadRef = useRef<HTMLDivElement | null>(null)

  const loadListings = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setLoadError("")
    try {
      const res = await fetchAllListings({}, signal)
      const mapped: RoomItem[] = (res?.content ?? []).map(
        (item: ListingItem) => {
          const code = item.roomNumber?.trim() || `#${item.roomId}`
          const typeName = item.roomTypeName?.trim() || ""
          const shared = /ghép|share/i.test(`${item.title} ${typeName}`)
          const perks = [
            typeName,
            item.maxCapacity ? `Tối đa ${item.maxCapacity} người` : "",
            STATUS_LABEL[item.roomStatus] ?? "",
          ].filter(Boolean)

          return {
            id: idStr(item.id),
            listingId: item.id,
            roomId: item.roomId,
            code,
            building:
              item.buildingName?.trim() || `Tòa nhà #${item.buildingId}`,
            buildingKey: idStr(item.buildingId),
            address: item.address?.trim() || "Chưa cập nhật địa chỉ",
            title: item.title,
            price: item.price,
            capacity: item.maxCapacity ?? 1,
            lat: item.latitude ?? null,
            lng: item.longitude ?? null,
            shared,
            perks,
            type: typeName,
            roomStatus: item.roomStatus,
            status: item.status,
            description: item.description,
            depositAmount: item.depositAmount,
            electricityPrice: item.electricityPrice,
            waterPrice: item.waterPrice,
            waterUnit: item.waterUnit,
            paymentMethod: item.paymentMethod,
            paymentDueDay: item.paymentDueDay,
            minTermMonths: item.minTermMonths,
            availableFrom: item.availableFrom,
            lessorName: item.lessorName,
            lessorPhone: item.lessorPhone,
            lessorAddress: item.lessorAddress,
          }
        },
      )
      if (signal?.aborted) return
      setAllRooms(mapped)
    } catch (error) {
      if (signal?.aborted) return
      setAllRooms([])
      setLoadError(errText(error))
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void loadListings(controller.signal)
    return () => controller.abort()
  }, [loadListings])

  const buildingsList = useMemo<BuildingInfo[]>(() => {
    const map = new Map<string, BuildingInfo>()
    map.set("all", {
      key: "all",
      name: "Tất cả tòa nhà",
      address: `${allRooms.length} tin đang mở`,
    })
    for (const room of allRooms) {
      if (!map.has(room.buildingKey)) {
        map.set(room.buildingKey, {
          key: room.buildingKey,
          name: room.building,
          address: room.address,
        })
      }
    }
    return Array.from(map.values())
  }, [allRooms])

  const distanceMap = useMemo(() => {
    const map = new Map<string, number>()
    if (!origin) return map
    const from = { lat: origin.latitude, lng: origin.longitude }
    for (const room of allRooms) {
      if (room.lat == null || room.lng == null) continue
      map.set(
        room.id,
        Math.round(haversine(from, { lat: room.lat, lng: room.lng }) * 10) / 10,
      )
    }
    return map
  }, [allRooms, origin])

  const priceRange = useMemo(() => {
    const prices = allRooms
      .map((room) => room.price)
      .filter((price) => price > 0)
    if (prices.length === 0) return { min: 0, max: 10_000_000 }
    const min = Math.floor(Math.min(...prices) / 500_000) * 500_000
    const max = Math.max(
      min + 500_000,
      Math.ceil(Math.max(...prices) / 500_000) * 500_000,
    )
    return { min, max }
  }, [allRooms])

  const typeOptions = useMemo(
    () =>
      Array.from(
        new Set(allRooms.map((room) => room.type).filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b, "vi")),
    [allRooms],
  )

  const filteredList = useMemo(() => {
    const keyword = q.trim().toLowerCase()
    const cap = maxPrice ?? priceRange.max
    return allRooms
      .filter(
        (room) =>
          selectedBuildingKey === "all" ||
          room.buildingKey === selectedBuildingKey,
      )
      .filter((room) => !type || room.type === type)
      .filter((room) => room.price <= cap)
      .filter((room) => {
        if (!nearby) return true
        const km = distanceMap.get(room.id)
        return km != null && km <= radius
      })
      .filter((room) => {
        if (!keyword) return true
        const haystack = `${room.title} ${room.building} ${room.address} ${room.type} ${room.perks.join(" ")}`
        return haystack.toLowerCase().includes(keyword)
      })
      .sort((a, b) => {
        if (!origin) return 0
        return (
          (distanceMap.get(a.id) ?? Number.POSITIVE_INFINITY) -
          (distanceMap.get(b.id) ?? Number.POSITIVE_INFINITY)
        )
      })
  }, [
    allRooms,
    selectedBuildingKey,
    type,
    q,
    maxPrice,
    priceRange.max,
    nearby,
    radius,
    distanceMap,
    origin,
  ])

  const groups = useMemo(
    () => groupRoomsByBuilding(filteredList),
    [filteredList],
  )
  const withoutLocation = useMemo(
    () => countRoomsWithoutLocation(filteredList),
    [filteredList],
  )

  useEffect(() => {
    if (
      focusBuildingKey &&
      !groups.some((group) => group.key === focusBuildingKey)
    )
      setFocusBuildingKey(null)
  }, [groups, focusBuildingKey])

  useEffect(() => {
    if (!origin && !userLocation.locating) setNearby(false)
  }, [origin, userLocation.locating])

  const resetFilters = () => {
    setSelectedBuildingKey("all")
    setType("")
    setQ("")
    userLocation.clear()
    setNearby(false)
    setMaxPrice(null)
    setFocusBuildingKey(null)
  }

  const confirmPickedLocation = (point: MapPoint, label?: string) => {
    userLocation.setFromMap(point, label)
    setPickerOpen(false)
    setView("map")
    window.setTimeout(
      () => resultsHeadRef.current?.scrollIntoView({ block: "start" }),
      60,
    )
  }

  const distanceText = (latitude: number, longitude: number) => {
    if (!origin) return null
    const km = haversine({ lat: origin.latitude, lng: origin.longitude }, {
      lat: latitude,
      lng: longitude,
    })
    return formatDistanceMeters(km * 1000)
  }

  const currentBuilding =
    buildingsList.find((building) => building.key === selectedBuildingKey) ??
    buildingsList[0]
  const roomsInCurrent = useMemo(
    () =>
      allRooms.filter(
        (room) =>
          selectedBuildingKey === "all" ||
          room.buildingKey === selectedBuildingKey,
      ),
    [allRooms, selectedBuildingKey],
  )
  const minPrice =
    roomsInCurrent.length > 0
      ? Math.min(...roomsInCurrent.map((room) => room.price))
      : null
  const typeCount = new Set(
    roomsInCurrent.map((room) => room.type).filter(Boolean),
  ).size
  const featuredRoom = roomsInCurrent[0]

  useEffect(() => {
    if (!featuredRoom) {
      setHeroImage(null)
      return
    }
    let cancelled = false
    loadRoomImageUrls(featuredRoom.roomId)
      .then((urls) => {
        if (!cancelled) setHeroImage(urls[0] ?? null)
      })
      .catch(() => {
        if (!cancelled) setHeroImage(null)
      })
    return () => {
      cancelled = true
    }
  }, [selectedBuildingKey, featuredRoom?.roomId])

  return (
    <>
      {toastNode}

      {/* Hero Section */}
      <section className="cx-hero">
        <div className="cx-hero-copy">
          <motion.div
            className="cx-eyebrow"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <span className="cx-live" /> {allRooms.length} tin đăng đang mở trên
            hệ thống
          </motion.div>
          <h1 className="cx-serif cx-h1">
            {["Một căn phòng", "đúng nhịp sống", "của bạn."].map((line, i) => (
              <span key={line} className="block overflow-hidden">
                <motion.span
                  className="block"
                  initial={{ y: "110%" }}
                  animate={{ y: 0 }}
                  transition={{ duration: 0.9, delay: 0.15 + i * 0.1, ease }}
                >
                  {i === 2 ? <em>{line}</em> : line}
                </motion.span>
              </span>
            ))}
          </h1>
          <motion.p
            className="cx-lead"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.6 }}
          >
            Chọn một tòa nhà, xem ngay các phòng còn trống, giá thuê và hình ảnh
            thực tế đầy đủ, không cần đến tận nơi.
          </motion.p>
          <motion.div
            className="cx-switch"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6 }}
          >
            {buildingsList.map((building) => (
              <button
                key={building.key}
                type="button"
                onClick={() => setSelectedBuildingKey(building.key)}
                className={selectedBuildingKey === building.key ? "on" : ""}
                title={building.address}
              >
                {selectedBuildingKey === building.key && (
                  <motion.span
                    layoutId="bld"
                    className="cx-switch-pill"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <span className="relative">
                  <b>{building.name}</b>
                  <small>{building.address}</small>
                </span>
              </button>
            ))}
          </motion.div>
        </div>

        <div className="cx-stage">
          <AnimatePresence mode="popLayout">
            <motion.div
              key={`${selectedBuildingKey}-${heroImage ?? "placeholder"}`}
              className="cx-stage-photo"
              initial={{ clipPath: "inset(0 0 100% 0 round 32px)" }}
              animate={{ clipPath: "inset(0 0 0% 0 round 32px)" }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9, ease }}
            >
              <motion.img
                src={heroImage ?? PLACEHOLDER_IMAGE}
                alt={`Không gian ${currentBuilding.name}`}
                initial={{ scale: 1.15 }}
                animate={{ scale: 1 }}
                transition={{ duration: 1.6, ease }}
              />
            </motion.div>
          </AnimatePresence>

          <motion.div
            key={`stat-${selectedBuildingKey}`}
            className="cx-float cx-float-stat"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.6, ease }}
          >
            <span className="cx-meta">Đang xem</span>
            <b className="cx-serif">{currentBuilding.name}</b>
            <div className="cx-float-row">
              <div>
                <small>Tin đang mở</small>
                <strong>{roomsInCurrent.length}</strong>
              </div>
              <div>
                <small>Giá từ</small>
                <strong>
                  {minPrice != null
                    ? `${(minPrice / 1e6).toLocaleString("vi-VN")} tr`
                    : "—"}
                </strong>
              </div>
              <div>
                <small>Loại phòng</small>
                <strong>{typeCount}</strong>
              </div>
            </div>
          </motion.div>

          <motion.div
            key={`live-${selectedBuildingKey}`}
            className="cx-float cx-float-live"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6, duration: 0.6, ease }}
          >
            <span className="cx-live" /> Kết nối trực tuyến
          </motion.div>

          {/* Dải phòng nổi bật */}
          <div className="cx-strip">
            {roomsInCurrent.slice(0, 3).map((room, i) => (
              <motion.button
                key={room.id}
                type="button"
                className="cx-strip-item"
                onClick={() => setOpen(room)}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 + i * 0.08, duration: 0.5, ease }}
                whileHover={{ y: -4 }}
              >
                <RoomThumb
                  roomId={room.roomId}
                  alt={room.title}
                  className="h-[58px] w-[58px] rounded-[14px] object-cover"
                />
                <span>
                  <b>{room.code}</b>
                  <small>{vnd(room.price)}</small>
                </span>
                <Icon name="arrow" size={16} />
              </motion.button>
            ))}
          </div>
        </div>
      </section>

      {/* Bộ lọc & Danh sách phòng */}
      <section className="cx-section">
        <div className="cx-location-bar">
          <LocationToolbar
            {...userLocation}
            onOpenPicker={() => setPickerOpen(true)}
          />
        </div>

        <div className="cx-filter">
          <label className="cx-search">
            <Icon name="search" size={18} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm theo tên phòng, tòa nhà hoặc địa chỉ…"
            />
          </label>

          <div className="cx-filter-row">
            <div className="cx-chips">
              <button
                type="button"
                className={`cx-chip ${!type ? "on" : ""}`}
                onClick={() => setType("")}
              >
                Tất cả loại
              </button>
              {typeOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`cx-chip ${type === option ? "on" : ""}`}
                  onClick={() => setType(option)}
                >
                  {option}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="cx-range">
                <span>
                  Giá tối đa{" "}
                  <b>
                    {((maxPrice ?? priceRange.max) / 1e6).toLocaleString(
                      "vi-VN",
                    )}{" "}
                    tr
                  </b>
                </span>
                <input
                  type="range"
                  min={priceRange.min}
                  max={priceRange.max}
                  step={500000}
                  value={maxPrice ?? priceRange.max}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                />
              </label>

              <label
                className={`cx-range cx-range-radius${nearby ? " is-on" : ""}`}
              >
                <span>
                  Bán kính lọc <b>{radius} km</b>
                </span>
                <input
                  type="range"
                  min={1}
                  max={20}
                  value={radius}
                  aria-label="Bán kính lọc theo km"
                  onChange={(e) => {
                    setRadius(Number(e.target.value))
                    setNearby(true)
                    if (!origin) userLocation.locate()
                  }}
                />
              </label>

              <button
                type="button"
                className={`cx-chip ${nearby ? "on" : ""}`}
                aria-pressed={nearby}
                onClick={() => {
                  if (nearby) {
                    setNearby(false)
                    return
                  }
                  setNearby(true)
                  if (!origin) userLocation.locate()
                }}
                disabled={userLocation.locating}
              >
                <Icon name="pin" size={14} />{" "}
                {userLocation.locating ? "Đang định vị…" : "Quanh tôi"}
              </button>
            </div>
          </div>
        </div>

        <div className="cx-grid-head" ref={resultsHeadRef}>
          <h2 className="cx-serif">{filteredList.length} phòng sẵn sàng</h2>
          <div className="cx-grid-tools">
            <span className="cx-meta">
              {origin
                ? "Gần nhất trước · tính từ vị trí của bạn"
                : "Dữ liệu thực tế từ hệ thống quản lý"}
            </span>
            <div
              className="cx-view-toggle"
              role="group"
              aria-label="Chế độ xem kết quả"
            >
              <button
                type="button"
                className={view === "list" ? "on" : ""}
                aria-pressed={view === "list"}
                onClick={() => setView("list")}
              >
                Danh sách
              </button>
              <button
                type="button"
                className={view === "map" ? "on" : ""}
                aria-pressed={view === "map"}
                onClick={() => setView("map")}
              >
                Bản đồ
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-muted">
            Đang tải danh sách phòng thực tế…
          </div>
        ) : loadError ? (
          <div className="cx-empty">
            <p>Không tải được danh sách phòng: {loadError}</p>
            <button
              type="button"
              className="cx-btn mt-4"
              onClick={() => void loadListings()}
            >
              Thử lại
            </button>
          </div>
        ) : allRooms.length === 0 ? (
          <div className="cx-empty">
            Hệ thống hiện chưa có tin đăng phòng nào đang mở.
          </div>
        ) : view === "map" ? (
          <div className="cx-map-layout">
            <div className="cx-map-stage">
              <ExploreMap
                groups={groups}
                origin={origin}
                accuracyMeters={userLocation.location?.accuracyMeters}
                selectedKey={focusBuildingKey}
                onSelect={setFocusBuildingKey}
                onOpenRoom={(room) => setOpen(room)}
              />
            </div>
            <div className="cx-map-list" aria-label="Các tòa nhà trên bản đồ">
              {withoutLocation > 0 && (
                <p className="cx-map-note">
                  {withoutLocation} tin chưa có vị trí nên không hiển thị trên
                  bản đồ.
                </p>
              )}
              {groups.length === 0 ? (
                <p className="cx-map-note">
                  Không có phòng phù hợp trên bản đồ. Hãy tăng bán kính hoặc xóa
                  bớt bộ lọc.
                </p>
              ) : (
                groups.map((group) => {
                  const active = group.key === focusBuildingKey
                  return (
                    <button
                      key={group.key}
                      type="button"
                      className={`cx-map-result${active ? " is-active" : ""}`}
                      aria-pressed={active}
                      onClick={() =>
                        setFocusBuildingKey(active ? null : group.key)
                      }
                    >
                      <RoomThumb
                        roomId={group.rooms[0].roomId}
                        alt={group.name}
                        className="cx-map-result-img"
                      />
                      <span className="cx-map-result-body">
                        <b>{group.name}</b>
                        <small>{group.address}</small>
                        <span className="cx-map-result-meta">
                          <strong>Từ {vnd(group.minPrice)}</strong>
                          <em>
                            {group.rooms.length} tin · {group.vacantCount} còn
                            trống
                          </em>
                          {distanceText(group.latitude, group.longitude) && (
                            <em>
                              {distanceText(group.latitude, group.longitude)}
                            </em>
                          )}
                        </span>
                      </span>
                      <Icon name="arrow" size={16} />
                    </button>
                  )
                })
              )}
            </div>
          </div>
        ) : (
          <motion.div layout className="cx-grid">
            <AnimatePresence mode="popLayout">
              {filteredList.map((room, i) => (
                <TiltCard
                  key={room.id}
                  room={room}
                  i={i}
                  km={distanceMap.get(room.id) ?? null}
                  onOpen={() => setOpen(room)}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {!loading &&
          !loadError &&
          allRooms.length > 0 &&
          filteredList.length === 0 && (
            <div className="cx-empty">
              Không tìm thấy phòng phù hợp với bộ lọc hiện tại.{" "}
              <button
                type="button"
                className="cx-link !p-0 underline"
                onClick={resetFilters}
              >
                Xóa bộ lọc
              </button>
            </div>
          )}
      </section>

      {/* Drawer Chi tiết phòng & Gallery ảnh */}
      <AnimatePresence>
        {open && (
          <RoomSheet
            room={open}
            km={distanceMap.get(open.id) ?? null}
            onClose={() => setOpen(null)}
            onSuccess={showToast}
          />
        )}
      </AnimatePresence>

      {pickerOpen && (
        <LocationPickerDialog
          initialPoint={origin}
          initialLabel={userLocation.location?.label}
          onClose={() => setPickerOpen(false)}
          onConfirm={confirmPickedLocation}
        />
      )}
    </>
  )
}
