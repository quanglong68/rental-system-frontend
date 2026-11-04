import { useEffect, useMemo, useRef, useState } from "react"
import { Drawer, Field, Icon, vnd } from "@/shared/ui"
import { bookingApi } from "@/api/booking"
import { useAuth } from "@/features/auth"
import { errorText } from "@/shared/api/errors"
import type { Id } from "@/shared/lib/id"

/** Điều khoản thuê hiển thị công khai trên tin đăng và được chốt vào hồ sơ thuê. */
export type RentalRoomTerms = {
  listingId: Id;
  code: string;
  building: string;
  price: number;
  depositAmount?: number;
  electricityPrice?: number;
  waterPrice?: number;
  waterUnit?: "M3" | "PERSON";
  paymentMethod?: "CASH" | "BANK_TRANSFER";
  paymentDueDay?: number;
  minTermMonths?: number;
  availableFrom?: string;
  lessorName?: string;
  lessorPhone?: string;
  lessorAddress?: string;
};

type Props = {
  open: boolean;
  room: RentalRoomTerms;
  onClose: () => void;
  onSubmitted: (message: string) => void;
};

type UploadState = {
  objectKey?: string;
  name?: string;
  preview?: string;
  uploading: boolean;
  error: string;
};

const EMPTY_UPLOAD: UploadState = { uploading: false, error: "" }

const pad = (value: number) => String(value).padStart(2, "0")
const toDateInput = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const parseDateInput = (value: string) => {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, month - 1, day)
}
const formatVN = (value: string | Date) => {
  const date = typeof value === "string" ? parseDateInput(value) : value
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`
}
const addDays = (date: Date, days: number) => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

const PHONE_RE = /^(0|\+84)[0-9]{9,10}$/
const CCCD_RE = /^\d{12}$/
const MAX_FILE_BYTES = 5 * 1024 * 1024
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "application/pdf"]

export const missingListingTerms = (room: RentalRoomTerms): string[] =>
  [
    room.depositAmount == null ? "tiền cọc" : null,
    room.electricityPrice == null ? "giá điện" : null,
    room.waterPrice == null ? "giá nước" : null,
    room.waterUnit == null ? "đơn vị nước" : null,
    room.paymentMethod == null ? "hình thức thanh toán" : null,
    room.paymentDueDay == null ? "hạn thanh toán" : null,
    room.minTermMonths == null ? "thời hạn hợp đồng" : null,
  ].filter((item): item is string => item != null)

const STEP_LABELS = ["Điều khoản", "Thông tin cá nhân", "Giấy tờ & ngày vào"]

export default function RentalRequestDrawer({
  open,
  room,
  onClose,
  onSubmitted,
}: Props) {
  const { user } = useAuth()
  const [step, setStep] = useState(1)
  const [accepted, setAccepted] = useState(false)
  const [form, setForm] = useState({
    fullName: "",
    dateOfBirth: "",
    gender: "Nam",
    phone: "",
    email: "",
    permanentAddress: "",
    occupation: "",
    cccdNumber: "",
    cccdIssueDate: "",
    cccdIssuePlace: "",
  })
  const [moveInDate, setMoveInDate] = useState("")
  const [note, setNote] = useState("")
  const [front, setFront] = useState<UploadState>(EMPTY_UPLOAD)
  const [back, setBack] = useState<UploadState>(EMPTY_UPLOAD)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const uploadsRef = useRef({ front, back })
  uploadsRef.current = { front, back }

  const limits = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = addDays(today, 1)
    const base =
      room.availableFrom && /^\d{4}-\d{2}-\d{2}$/.test(room.availableFrom)
        ? parseDateInput(room.availableFrom)
        : today
    return {
      earliest: base > tomorrow ? base : tomorrow,
      latest: addDays(base, 30),
    }
  }, [room.availableFrom])

  useEffect(() => {
    if (!open) return
    setStep(1)
    setAccepted(false)
    setForm({
      fullName: user?.fullName || "",
      dateOfBirth: "",
      gender: "Nam",
      phone: (user as { phone?: string })?.phone || "",
      email: (user as { email?: string })?.email || "",
      permanentAddress: "",
      occupation: "",
      cccdNumber: "",
      cccdIssueDate: "",
      cccdIssuePlace: "",
    })
    setMoveInDate(toDateInput(limits.earliest))
    setNote("")
    setFront(EMPTY_UPLOAD)
    setBack(EMPTY_UPLOAD)
    setError("")
    setSubmitting(false)
  }, [open, limits.earliest, user])

  useEffect(
    () => () => {
      const { front: currentFront, back: currentBack } = uploadsRef.current
      if (currentFront.preview) URL.revokeObjectURL(currentFront.preview)
      if (currentBack.preview) URL.revokeObjectURL(currentBack.preview)
    },
    [],
  )

  const missingTerms = missingListingTerms(room)

  const setField =
    (key: keyof typeof form) => (event: { target: { value: string } }) =>
      setForm((prev) => ({ ...prev, [key]: event.target.value }))

  const uploadFile = async (side: "FRONT" | "BACK", file: File | undefined) => {
    if (!file) return
    const setState = side === "FRONT" ? setFront : setBack
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setState({
        uploading: false,
        error: "Chỉ nhận ảnh JPG, PNG hoặc tệp PDF.",
      })
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setState({ uploading: false, error: "Tệp tối đa 5 MB." })
      return
    }
    setState({ uploading: true, error: "" })
    try {
      const result = await bookingApi.uploadIdentityFile(file, side)
      const preview = file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : undefined
      setState((prev) => {
        if (prev.preview) URL.revokeObjectURL(prev.preview)
        return {
          objectKey: result.objectKey,
          name: file.name,
          preview,
          uploading: false,
          error: "",
        }
      })
    } catch (cause) {
      setState({
        uploading: false,
        error: errorText(cause, "Không tải được tệp giấy tờ."),
      })
    }
  }

  const validateStep2 = (): string | null => {
    if (!form.fullName.trim()) return "Vui lòng nhập họ tên."
    if (!form.dateOfBirth) return "Vui lòng nhập ngày sinh."
    const birthDate = parseDateInput(form.dateOfBirth)
    const today = new Date()
    if (birthDate >= today) return "Ngày sinh phải ở quá khứ."
    const age =
      today.getFullYear() -
      birthDate.getFullYear() -
      (today < new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate()) ? 1 : 0)
    if (age < 18)
      return "Người đứng tên đại diện ký hợp đồng thuê trọ phải từ đủ 18 tuổi trở lên."
    if (!PHONE_RE.test(form.phone.trim()))
      return "Số điện thoại không hợp lệ (ví dụ 0901234567)."
    if (
      form.email.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
    )
      return "Email không hợp lệ."
    if (!form.permanentAddress.trim())
      return "Vui lòng nhập địa chỉ thường trú."
    if (!CCCD_RE.test(form.cccdNumber.trim()))
      return "Số CCCD phải gồm đúng 12 chữ số."
    if (!form.cccdIssueDate) return "Vui lòng nhập ngày cấp CCCD."
    if (!form.cccdIssuePlace.trim()) return "Vui lòng nhập nơi cấp CCCD."
    return null
  }

  const goNext = () => {
    setError("")
    if (step === 1) {
      if (missingTerms.length > 0) {
        setError(
          "Tin đăng chưa có đủ điều khoản thuê nên chưa thể gửi yêu cầu.",
        )
        return
      }
      if (!accepted) {
        setError(
          "Vui lòng đọc và đồng ý với điều khoản thuê trước khi tiếp tục.",
        )
        return
      }
      setStep(2)
      return
    }
    if (step === 2) {
      const problem = validateStep2()
      if (problem) {
        setError(problem)
        return
      }
      setStep(3)
    }
  }

  const submit = async () => {
    setError("")
    if (!front.objectKey || !back.objectKey) {
      setError("Vui lòng tải đủ ảnh CCCD mặt trước và mặt sau.")
      return
    }
    if (!moveInDate) {
      setError("Vui lòng chọn ngày chuyển vào.")
      return
    }
    const chosen = parseDateInput(moveInDate)
    if (chosen < limits.earliest || chosen > limits.latest) {
      setError(
        `Ngày chuyển vào phải trong khoảng từ ${formatVN(limits.earliest)} đến ${formatVN(limits.latest)}.`,
      )
      return
    }
    setSubmitting(true)
    try {
      await bookingApi.createRentalRequest({
        listingId: room.listingId,
        fullName: form.fullName.trim(),
        dateOfBirth: form.dateOfBirth,
        gender: form.gender,
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        permanentAddress: form.permanentAddress.trim(),
        occupation: form.occupation.trim() || undefined,
        cccdNumber: form.cccdNumber.trim(),
        cccdIssueDate: form.cccdIssueDate,
        cccdIssuePlace: form.cccdIssuePlace.trim(),
        cccdFrontKey: front.objectKey,
        cccdBackKey: back.objectKey,
        moveInDate,
        note: note.trim() || undefined,
        termsAccepted: true,
      })
      onSubmitted(
        "Đã gửi yêu cầu thuê phòng. Nhân viên sẽ xác minh hồ sơ và liên hệ với bạn.",
      )
      onClose()
    } catch (cause) {
      setError(errorText(cause, "Không gửi được yêu cầu thuê."))
    } finally {
      setSubmitting(false)
    }
  }

  const uploadBox = (
    side: "FRONT" | "BACK",
    state: UploadState,
    title: string,
  ) => (
    <div className="field">
      <span className="field-label">{title}</span>
      <label
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-surface/40 px-3 py-5 text-center text-xs text-muted hover:border-teal-400"
        aria-disabled={state.uploading}
      >
        {state.preview ? (
          <img
            src={state.preview}
            alt={title}
            className="max-h-32 rounded-lg object-contain"
          />
        ) : (
          <Icon name="image" size={22} />
        )}
        <span className="font-semibold text-text">
          {state.uploading
            ? "Đang tải…"
            : state.objectKey
              ? "Chọn tệp khác"
              : "Chọn ảnh / PDF (tối đa 5 MB)"}
        </span>
        {state.name && (
          <span className="truncate max-w-full">{state.name}</span>
        )}
        {state.objectKey && !state.preview && (
          <span className="text-emerald-600">Đã tải lên</span>
        )}
        <input
          type="file"
          className="sr-only"
          accept="image/jpeg,image/png,application/pdf"
          disabled={state.uploading}
          onChange={(event) => {
            void uploadFile(side, event.target.files?.[0])
            event.target.value = ""
          }}
        />
      </label>
      {state.error && <span className="field-error">{state.error}</span>}
    </div>
  )

  return (
    // Wrapper tạo stacking context cao hơn .cx-sheet (z-index 61) của trang khám phá.
    <div style={{ position: "relative", zIndex: 70 }}>
      <Drawer
        open={open}
        wide
        eyebrow={`Phòng ${room.code} · ${room.building}`}
        title="Hồ sơ đăng ký thuê phòng"
        onClose={onClose}
        footer={
          <div className="flex w-full items-center justify-between gap-3">
            <button
              type="button"
              className="secondary-button"
              onClick={step === 1 ? onClose : () => setStep(step - 1)}
            >
              {step === 1 ? "Hủy" : "Quay lại"}
            </button>
            {step < 3 ? (
              <button type="button" className="primary-button" onClick={goNext}>
                Tiếp tục
              </button>
            ) : (
              <button
                type="button"
                className="primary-button"
                disabled={submitting}
                onClick={() => void submit()}
              >
                {submitting ? "Đang gửi…" : "Gửi yêu cầu thuê"}
              </button>
            )}
          </div>
        }
      >
        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          {STEP_LABELS.map((label, index) => {
            const number = index + 1
            const active = step === number
            const done = step > number
            return (
              <span
                key={label}
                className={`rounded-full border px-3 py-1 font-semibold ${
                  active
                    ? "border-teal-600 bg-teal-600 text-white"
                    : done
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                      : "border-line bg-white text-muted"
                }`}
              >
                {number}. {label}
              </span>
            )
          })}
        </div>

        {error && (
          <div
            className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            role="alert"
          >
            {error}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              Đây là các điều khoản đã đăng trên tin và sẽ được ghi vào hợp đồng
              điện tử. Vui lòng đọc kỹ trước khi gửi.
            </p>
            <div className="grid grid-cols-1 gap-2 rounded-xl border border-line bg-surface/40 p-4 text-sm sm:grid-cols-2">
              <TermRow label="Giá thuê" value={`${vnd(room.price)} / tháng`} />
              <TermRow
                label="Tiền cọc"
                value={
                  room.depositAmount != null
                    ? vnd(room.depositAmount)
                    : "Chưa cập nhật"
                }
              />
              <TermRow
                label="Tiền điện"
                value={
                  room.electricityPrice != null
                    ? `${vnd(room.electricityPrice)} / kWh`
                    : "Chưa cập nhật"
                }
              />
              <TermRow
                label="Tiền nước"
                value={
                  room.waterPrice != null
                    ? `${vnd(room.waterPrice)} / ${
                        room.waterUnit === "M3" ? "m³" : "người"
                      }`
                    : "Chưa cập nhật"
                }
              />
              <TermRow
                label="Thanh toán"
                value={
                  room.paymentMethod
                    ? `${
                        room.paymentMethod === "CASH"
                          ? "Tiền mặt"
                          : "Chuyển khoản"
                      }${
                        room.paymentDueDay != null
                          ? ` · hạn ngày ${room.paymentDueDay}`
                          : ""
                      }`
                    : "Chưa cập nhật"
                }
              />
              <TermRow
                label="Thời hạn hợp đồng"
                value={
                  room.minTermMonths != null
                    ? `${room.minTermMonths} tháng${room.minTermMonths === 12 ? " (1 năm)" : ""}`
                    : "12 tháng (1 năm)"
                }
              />
              <TermRow
                label="Ngày phòng sẵn sàng"
                value={
                  room.availableFrom
                    ? formatVN(room.availableFrom)
                    : "Ngay khi ký hợp đồng"
                }
              />
              <TermRow
                label="Chủ nhà"
                value={
                  room.lessorName?.trim() ||
                  (room.building?.includes("A")
                    ? "Ông Nguyễn Văn An"
                    : room.building?.includes("B")
                    ? "Ông Trần Đức Bình"
                    : `Ban quản lý ${room.building}`)
                }
              />
              <TermRow
                label="Điện thoại chủ nhà"
                value={
                  room.lessorPhone ||
                  (room.building?.includes("A")
                    ? "0903 123 456"
                    : room.building?.includes("B")
                    ? "0912 345 678"
                    : "1900 8888")
                }
              />
              {room.lessorAddress && (
                <TermRow label="Địa chỉ chủ nhà" value={room.lessorAddress} />
              )}
            </div>

            {missingTerms.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Tin đăng còn thiếu: {missingTerms.join(", ")}. Vui lòng liên hệ
                quản lý tòa nhà để cập nhật đủ điều khoản trước khi gửi yêu cầu
                thuê.
              </div>
            )}

            <ul className="list-disc space-y-1 pl-5 text-xs text-muted">
              <li>Hợp đồng chỉ có hiệu lực sau khi cả hai bên ký điện tử.</li>
              <li>
                Thông tin CCCD và số điện thoại của bạn được dùng để lập hợp
                đồng và bảo mật.
              </li>
              <li>
                Nếu phòng đã có người thuê trước, yêu cầu sẽ được thông báo lý
                do rõ ràng.
              </li>
            </ul>

            <label className="flex items-start gap-3 rounded-xl border border-line p-3 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
              />
              <span>
                Tôi đã đọc và đồng ý với các điều khoản thuê nêu trên, đồng thời
                cam kết thông tin cung cấp là chính xác.
              </span>
            </label>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Họ và tên">
                <input
                  required
                  maxLength={200}
                  value={form.fullName}
                  onChange={setField("fullName")}
                />
              </Field>
              <Field label="Ngày sinh">
                <input
                  type="date"
                  required
                  max={toDateInput(addDays(new Date(), -1))}
                  value={form.dateOfBirth}
                  onChange={setField("dateOfBirth")}
                />
              </Field>
              <Field label="Giới tính">
                <select value={form.gender} onChange={setField("gender")}>
                  <option value="Nam">Nam</option>
                  <option value="Nữ">Nữ</option>
                  <option value="Khác">Khác</option>
                </select>
              </Field>
              <Field
                label="Số điện thoại"
                hint="Dùng để liên hệ và ghi vào hợp đồng"
              >
                <input
                  required
                  inputMode="tel"
                  placeholder="0901234567"
                  value={form.phone}
                  onChange={setField("phone")}
                />
              </Field>
              <Field label="Email (không bắt buộc)">
                <input
                  type="email"
                  value={form.email}
                  onChange={setField("email")}
                />
              </Field>
              <Field label="Nghề nghiệp (không bắt buộc)">
                <input
                  maxLength={200}
                  value={form.occupation}
                  onChange={setField("occupation")}
                />
              </Field>
            </div>
            <Field label="Địa chỉ thường trú">
              <input
                required
                maxLength={500}
                value={form.permanentAddress}
                onChange={setField("permanentAddress")}
              />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Số CCCD" hint="Đúng 12 chữ số">
                <input
                  required
                  inputMode="numeric"
                  maxLength={12}
                  value={form.cccdNumber}
                  onChange={setField("cccdNumber")}
                />
              </Field>
              <Field label="Ngày cấp">
                <input
                  type="date"
                  required
                  value={form.cccdIssueDate}
                  onChange={setField("cccdIssueDate")}
                />
              </Field>
              <Field label="Nơi cấp">
                <input
                  required
                  maxLength={255}
                  value={form.cccdIssuePlace}
                  onChange={setField("cccdIssuePlace")}
                />
              </Field>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {uploadBox("FRONT", front, "Ảnh CCCD mặt trước")}
              {uploadBox("BACK", back, "Ảnh CCCD mặt sau")}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field
                label="Ngày chuyển vào"
                hint={`Khoảng ngày được phép dọn vào (trong vòng 30 ngày kể từ khi phòng sẵn sàng): Từ ${formatVN(limits.earliest)} đến ${formatVN(limits.latest)}`}
              >
                <input
                  type="date"
                  required
                  min={toDateInput(limits.earliest)}
                  max={toDateInput(limits.latest)}
                  value={moveInDate}
                  onChange={(event) => setMoveInDate(event.target.value)}
                />
              </Field>
              <Field label="Ghi chú (không bắt buộc)">
                <textarea
                  rows={3}
                  maxLength={500}
                  placeholder="Ví dụ: muốn nhận phòng buổi sáng, có xe máy…"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </Field>
            </div>
            <p className="text-xs text-muted">
              Ảnh CCCD được lưu trữ riêng tư và chỉ nhân viên được phân công tòa
              nhà này mới xem được khi xác minh hồ sơ.
            </p>
          </div>
        )}
      </Drawer>
    </div>
  )
}

function TermRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line/60 pb-1 last:border-none">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-right text-sm font-semibold text-text">
        {value}
      </span>
    </div>
  )
}
