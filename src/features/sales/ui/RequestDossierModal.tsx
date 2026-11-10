import { useEffect, useState } from "react"
import { Icon, vnd } from "@/shared/ui"
import { bookingApi, type RentalRequest } from "@/api/booking"
import { errorText } from "@/shared/api/errors"
import { toVNTime } from "@/shared/lib/format"
import type { Id } from "@/shared/lib/id"

type Props = {
  request: RentalRequest;
  roomCode: string;
  buildingName: string;
  customerName: string;
  onClose: () => void;
  canVerify?: boolean;
  canDecide?: boolean;
  onVerify?: (request: RentalRequest) => Promise<void>;
  onAccept?: (id: Id) => Promise<void>;
  onReject?: (id: Id) => void;
  actionLoading?: boolean;
};

const day = (value?: string | null) => {
  if (!value) return "Chưa cập nhật"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("vi-VN")
}

const money = (value?: number | null) =>
  value != null ? vnd(value) : "Chưa cập nhật"

export default function RequestDossierModal({
  request,
  roomCode,
  buildingName,
  customerName,
  onClose,
  canVerify,
  canDecide,
  onVerify,
  onAccept,
  onReject,
  actionLoading,
}: Props) {
  const hasDossier = Boolean(request.fullName || request.cccdNumber)

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="eyebrow">Hồ sơ yêu cầu thuê #{request.id}</div>
            <h3 className="mt-1 text-lg font-bold text-text">
              {request.fullName || customerName} · Phòng {roomCode} ·{" "}
              {buildingName}
            </h3>
            <p className="mt-1 text-xs text-muted">
              Gửi lúc{" "}
              {request.requestedAt ? toVNTime(request.requestedAt, true) : "—"}
              {request.verifiedAt
                ? ` · Xác minh ${toVNTime(request.verifiedAt, true)}`
                : ""}
            </p>
          </div>
          <button
            type="button"
            className="icon-button !h-9 !w-9"
            onClick={onClose}
            aria-label="Đóng"
          >
            <Icon name="close" size={17} />
          </button>
        </div>

        {!hasDossier ? (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Yêu cầu này được tạo trước khi hệ thống yêu cầu hồ sơ CCCD. Hãy liên
            hệ khách để bổ sung giấy tờ trước khi duyệt.
          </div>
        ) : (
          <>
            <section className="mt-6">
              <h4 className="text-sm font-bold text-text">Thông tin cá nhân</h4>
              <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <Row
                  label="Họ và tên"
                  value={request.fullName || "Chưa cập nhật"}
                />
                <Row label="Ngày sinh" value={day(request.dateOfBirth)} />
                <Row
                  label="Giới tính"
                  value={request.gender || "Chưa cập nhật"}
                />
                <Row
                  label="Số điện thoại"
                  value={request.phone || "Chưa cập nhật"}
                />
                <Row label="Email" value={request.email || "Chưa cập nhật"} />
                <Row
                  label="Nghề nghiệp"
                  value={request.occupation || "Chưa cập nhật"}
                />
                <Row
                  label="Địa chỉ thường trú"
                  value={request.permanentAddress || "Chưa cập nhật"}
                  wide
                />
                <Row
                  label="Số CCCD"
                  value={request.cccdNumber || "Chưa cập nhật"}
                />
                <Row label="Ngày cấp" value={day(request.cccdIssueDate)} />
                <Row
                  label="Nơi cấp"
                  value={request.cccdIssuePlace || "Chưa cập nhật"}
                />
                <Row
                  label="Ngày chuyển vào"
                  value={day(request.moveInDate)}
                />
              </dl>
            </section>

            <section className="mt-6">
              <h4 className="text-sm font-bold text-text">Ảnh CCCD</h4>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <IdentityImage
                  requestId={request.id}
                  side="FRONT"
                  label="Mặt trước"
                  available={request.cccdFrontUploaded !== false}
                />
                <IdentityImage
                  requestId={request.id}
                  side="BACK"
                  label="Mặt sau"
                  available={request.cccdBackUploaded !== false}
                />
              </div>
            </section>

            <section className="mt-6">
              <h4 className="text-sm font-bold text-text">
                Điều khoản đã chốt với khách
              </h4>
              <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <Row label="Giá thuê" value={money(request.rentAmount)} />
                <Row label="Tiền cọc" value={money(request.depositAmount)} />
                <Row
                  label="Tiền điện"
                  value={
                    request.electricityPrice != null
                      ? `${vnd(request.electricityPrice)} / kWh`
                      : "Chưa cập nhật"
                  }
                />
                <Row
                  label="Tiền nước"
                  value={
                    request.waterPrice != null
                      ? `${vnd(request.waterPrice)} / ${
                          request.waterUnit === "M3" ? "m³" : "người"
                        }`
                      : "Chưa cập nhật"
                  }
                />
                <Row
                  label="Thanh toán"
                  value={
                    request.paymentMethod
                      ? `${
                          request.paymentMethod === "CASH"
                            ? "Tiền mặt"
                            : "Chuyển khoản"
                        }${
                          request.paymentDueDay != null
                            ? ` · hạn ngày ${request.paymentDueDay}`
                            : ""
                        }`
                      : "Chưa cập nhật"
                  }
                />
                <Row
                  label="Thời hạn hợp đồng"
                  value={
                    request.minTermMonths != null
                      ? `${request.minTermMonths} tháng${request.minTermMonths === 12 ? " (1 năm)" : ""}`
                      : "12 tháng (1 năm)"
                  }
                />
                <Row label="Ngày phòng sẵn sàng" value={day(request.availableFrom)} />
                <Row
                  label="Chủ nhà"
                  value={
                    request.lessorName ||
                    (roomCode?.startsWith("A")
                      ? "Ông Nguyễn Văn An"
                      : roomCode?.startsWith("B")
                      ? "Ông Trần Đức Bình"
                      : "Ban quản lý tòa nhà")
                  }
                />
                <Row
                  label="Điện thoại chủ nhà"
                  value={request.lessorPhone || "Chưa cập nhật"}
                />
                <Row
                  label="Địa chỉ chủ nhà"
                  value={request.lessorAddress || "Chưa cập nhật"}
                  wide
                />
              </dl>
            </section>
          </>
        )}

        {request.note && (
          <section className="mt-6">
            <h4 className="text-sm font-bold text-text">Ghi chú của khách</h4>
            <p className="mt-2 rounded-xl bg-surface/60 p-3 text-sm text-muted">
              {request.note}
            </p>
          </section>
        )}

        {request.rejectReason && (
          <p className="mt-4 text-sm font-medium text-red-600">
            Lý do từ chối: {request.rejectReason}
          </p>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line/80 pt-4">
          <div className="text-xs text-muted">
            Trạng thái hiện tại:{" "}
            <span className="font-semibold text-text">
              {request.status === "PENDING"
                ? "Chờ xác minh hồ sơ"
                : request.status === "VERIFIED"
                ? "Đã xác minh hồ sơ · Chờ duyệt"
                : request.status === "ACCEPTED"
                ? "Đã duyệt · Chờ ký hợp đồng"
                : request.status === "REJECTED"
                ? "Đã từ chối"
                : request.status}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {request.status === "PENDING" && canVerify && onVerify && (
              <button
                type="button"
                className="h-9 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-xs font-semibold text-white shadow-xs transition-colors shrink-0"
                disabled={actionLoading}
                onClick={async () => {
                  await onVerify(request);
                  onClose();
                }}
              >
                Xác minh hồ sơ
              </button>
            )}
            {request.status === "VERIFIED" && canDecide && onAccept && (
              <button
                type="button"
                className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold text-white shadow-xs transition-colors shrink-0"
                disabled={actionLoading}
                onClick={async () => {
                  await onAccept(request.id);
                  onClose();
                }}
              >
                Duyệt hồ sơ & Tạo hợp đồng nháp
              </button>
            )}
            {(request.status === "PENDING" || request.status === "VERIFIED") && onReject && (
              <button
                type="button"
                className="h-9 px-4 rounded-xl border border-rose-300 hover:border-rose-400 bg-white text-xs font-semibold text-rose-600 hover:bg-rose-50 shadow-xs transition-colors shrink-0"
                disabled={actionLoading}
                onClick={() => {
                  onReject(request.id);
                  onClose();
                }}
              >
                Từ chối
              </button>
            )}
            <button
              type="button"
              className="h-9 px-4 rounded-xl border border-slate-300 hover:border-slate-400 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition-colors shrink-0"
              onClick={onClose}
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 font-medium text-text">{value}</dd>
    </div>
  )
}

function IdentityImage({
  requestId,
  side,
  label,
  available,
}: {
  requestId: Id;
  side: "FRONT" | "BACK";
  label: string;
  available: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [isPdf, setIsPdf] = useState(false)
  const [loading, setLoading] = useState(available)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!available) {
      setLoading(false)
      return
    }
    let cancelled = false
    let objectUrl: string | null = null
    setLoading(true)
    setError("")
    bookingApi
      .identityFile(requestId, side)
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setIsPdf(blob.type.includes("pdf"))
        setUrl(objectUrl)
      })
      .catch((cause) => {
        if (!cancelled)
          setError(errorText(cause, "Không tải được ảnh giấy tờ."))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [requestId, side, available])

  return (
    <div className="rounded-xl border border-line p-3">
      <div className="text-xs font-semibold text-text">
        CCCD {label.toLowerCase()}
      </div>
      <div className="mt-2">
        {!available ? (
          <p className="text-xs text-muted">Không có tệp đính kèm.</p>
        ) : loading ? (
          <p className="text-xs text-muted">Đang tải ảnh…</p>
        ) : error ? (
          <p className="text-xs text-red-600">{error}</p>
        ) : url && isPdf ? (
          <a
            className="text-xs font-semibold text-teal-700 underline"
            href={url}
            target="_blank"
            rel="noreferrer"
          >
            Mở tệp PDF
          </a>
        ) : url ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            title="Mở ảnh kích thước đầy đủ"
          >
            <img
              src={url}
              alt={`CCCD ${label}`}
              className="max-h-48 w-full rounded-lg border border-line object-contain"
            />
          </a>
        ) : null}
      </div>
    </div>
  )
}
