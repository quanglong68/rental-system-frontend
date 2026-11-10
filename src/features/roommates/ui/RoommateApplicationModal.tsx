import { Icon } from "@/shared/ui";
import type { RoommateApplication } from "@/api/booking";
import { bookingApi } from "@/api/booking";
import { useEffect, useState } from "react";

type Props = {
  app: RoommateApplication;
  customerName?: string;
  roomCode: string;
  buildingName: string;
  onClose: () => void;
  onAccept?: () => void;
  onReject?: () => void;
  busy?: boolean;
};

const day = (value?: string | null) => {
  if (!value) return "Chưa cập nhật";
  const [y, m, d] = value.split("-");
  return d && m && y ? `${d}/${m}/${y}` : value;
};

export default function RoommateApplicationModal({
  app,
  customerName,
  roomCode,
  buildingName,
  onClose,
  onAccept,
  onReject,
  busy,
}: Props) {
  const isPending = app.status === "PENDING";
  const isAccepted = app.status === "ACCEPTED" || app.status === "ACCEPTED_PENDING";
  const isRejected = app.status === "REJECTED" || app.status === "REJECTED_FULL";

  // CCCD image viewer state
  const [frontUrl, setFrontUrl] = useState<string | null>(null);
  const [backUrl, setBackUrl] = useState<string | null>(null);
  const [cccdLoading, setCccdLoading] = useState(false);
  const [cccdError, setCccdError] = useState("");

  // Lightbox modal for enlarged image preview
  const [lightboxUrl, setLightboxUrl] = useState<{ url: string; title: string } | null>(null);

  // Fetch CCCD images when modal opens
  useEffect(() => {
    if (!app.cccdFrontUploaded && !app.cccdBackUploaded) return;
    setCccdLoading(true);
    setCccdError("");

    let cancelled = false;
    let frontObjUrl: string | null = null;
    let backObjUrl: string | null = null;

    const loadImages = async () => {
      try {
        if (app.cccdFrontUploaded) {
          const blobFront = await bookingApi.applicationIdentityFile(app.id, "FRONT");
          if (!cancelled) {
            frontObjUrl = URL.createObjectURL(blobFront);
            setFrontUrl(frontObjUrl);
          }
        }
        if (app.cccdBackUploaded) {
          const blobBack = await bookingApi.applicationIdentityFile(app.id, "BACK");
          if (!cancelled) {
            backObjUrl = URL.createObjectURL(blobBack);
            setBackUrl(backObjUrl);
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Không tải được ảnh CCCD:", err);
          setCccdError("Không tải được tệp ảnh CCCD từ máy chủ.");
        }
      } finally {
        if (!cancelled) setCccdLoading(false);
      }
    };

    void loadImages();

    return () => {
      cancelled = true;
      if (frontObjUrl) URL.revokeObjectURL(frontObjUrl);
      if (backObjUrl) URL.revokeObjectURL(backObjUrl);
    };
  }, [app.id, app.cccdFrontUploaded, app.cccdBackUploaded]);

  return (
    <>
      <div
        className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in"
        role="dialog"
        aria-modal="true"
      >
        <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white shadow-2xl border border-line flex flex-col">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-start justify-between border-b border-line/80 bg-white/95 px-6 py-5 backdrop-blur-sm">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700 border border-teal-200">
                  <Icon name="users" size={14} />
                  Hồ sơ ứng viên ở ghép #{app.id}
                </span>
                {renderStatusBadge(app.status)}
              </div>
              <h3 className="mt-2 text-xl font-bold text-slate-900 tracking-tight">
                {app.fullName || customerName || "Khách ứng tuyển"}
              </h3>
              <p className="mt-0.5 text-xs text-muted flex items-center gap-2">
                <span>Phòng <b>{roomCode}</b> · {buildingName}</span>
                <span>•</span>
                <span>Nộp lúc {new Date(app.createdAt).toLocaleString("vi-VN")}</span>
              </p>
            </div>
            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors"
              onClick={onClose}
              aria-label="Đóng"
            >
              <Icon name="close" size={18} />
            </button>
          </div>

          {/* Body Content */}
          <div className="space-y-6 p-6">
            {/* Block 1: Thông tin cá nhân & Giấy tờ tùy thân */}
            <div className="rounded-2xl border border-line bg-slate-50/50 p-5">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-lg bg-teal-600 text-white text-xs">
                  1
                </span>
                Thông tin cá nhân & Giấy tờ tùy thân
              </h4>
              <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3.5 text-sm sm:grid-cols-2">
                <InfoItem label="Họ và tên" value={app.fullName || customerName || "Chưa cập nhật"} highlight />
                <InfoItem label="Số điện thoại" value={app.phone || "Chưa cập nhật"} />
                <InfoItem label="Số Căn cước công dân" value={app.cccdNumber || "Chưa cập nhật"} />
                <InfoItem label="Ngày sinh" value={day(app.dateOfBirth)} />
                <InfoItem label="Giới tính" value={app.gender || "Chưa cập nhật"} />
                <InfoItem label="Nghề nghiệp" value={app.occupation || "Chưa cập nhật"} />
                <InfoItem label="Địa chỉ thường trú" value={app.permanentAddress || "Chưa cập nhật"} wide />
                <InfoItem label="Ngày cấp CCCD" value={day(app.cccdIssueDate)} />
                <InfoItem label="Nơi cấp CCCD" value={app.cccdIssuePlace || "Cục Cảnh sát QLHC về TTXH"} />
                <InfoItem
                  label="Ngày dự kiến chuyển vào"
                  value={day(app.moveInDate)}
                  highlight
                  wide
                />
              </dl>
            </div>

            {/* Block 2: Ảnh CCCD 2 mặt */}
            <div className="rounded-2xl border border-line bg-slate-50/50 p-5">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-lg bg-teal-600 text-white text-xs">
                    2
                  </span>
                  Ảnh chụp Căn cước công dân (CCCD 2 mặt)
                </h4>
                {app.cccdFrontUploaded && app.cccdBackUploaded ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    <Icon name="check" size={12} /> Đầy đủ 2 mặt
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                    Chưa đầy đủ
                  </span>
                )}
              </div>

              {cccdLoading ? (
                <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-10 text-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
                  <p className="mt-3 text-xs text-muted">Đang tải ảnh CCCD của ứng viên…</p>
                </div>
              ) : cccdError ? (
                <div className="mt-4 rounded-xl border border-danger/30 bg-danger/5 p-4 text-xs text-danger">
                  {cccdError}
                </div>
              ) : frontUrl || backUrl ? (
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* Mặt trước */}
                  <div className="group relative rounded-xl border border-line bg-white p-3 shadow-sm hover:border-teal-500 transition-all">
                    <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-700">
                      <span>Mặt trước CCCD</span>
                      <span className="text-[11px] text-teal-600 group-hover:underline">Bấm để phóng to</span>
                    </div>
                    {frontUrl ? (
                      <button
                        type="button"
                        className="block w-full overflow-hidden rounded-lg bg-slate-100"
                        onClick={() => setLightboxUrl({ url: frontUrl, title: "Mặt trước CCCD" })}
                        title="Xem ảnh phóng to"
                      >
                        <img
                          src={frontUrl}
                          alt="CCCD mặt trước"
                          className="h-44 w-full object-contain transition-transform duration-200 group-hover:scale-105"
                        />
                      </button>
                    ) : (
                      <div className="flex h-44 items-center justify-center rounded-lg bg-slate-100 text-xs text-muted">
                        Chưa có ảnh mặt trước
                      </div>
                    )}
                  </div>

                  {/* Mặt sau */}
                  <div className="group relative rounded-xl border border-line bg-white p-3 shadow-sm hover:border-teal-500 transition-all">
                    <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-700">
                      <span>Mặt sau CCCD</span>
                      <span className="text-[11px] text-teal-600 group-hover:underline">Bấm để phóng to</span>
                    </div>
                    {backUrl ? (
                      <button
                        type="button"
                        className="block w-full overflow-hidden rounded-lg bg-slate-100"
                        onClick={() => setLightboxUrl({ url: backUrl, title: "Mặt sau CCCD" })}
                        title="Xem ảnh phóng to"
                      >
                        <img
                          src={backUrl}
                          alt="CCCD mặt sau"
                          className="h-44 w-full object-contain transition-transform duration-200 group-hover:scale-105"
                        />
                      </button>
                    ) : (
                      <div className="flex h-44 items-center justify-center rounded-lg bg-slate-100 text-xs text-muted">
                        Chưa có ảnh mặt sau
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900 leading-relaxed">
                  <Icon name="clock" size={15} className="mt-0.5 shrink-0" />
                  <span>
                    <b>Lưu ý hồ sơ:</b> Ứng viên này chưa tải kèm ảnh CCCD khi nộp đơn. Bạn có thể liên hệ số điện thoại{" "}
                    <b>{app.phone || "ứng viên"}</b> để kiểm tra trực tiếp trước khi duyệt vào phòng.
                  </span>
                </div>
              )}
            </div>

            {/* Block 3: Lời nhắn & Thói quen sinh hoạt */}
            {app.message && (
              <div className="rounded-2xl border border-line bg-slate-50/50 p-5">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-lg bg-teal-600 text-white text-xs">
                    3
                  </span>
                  Lời nhắn & Thói quen sinh hoạt
                </h4>
                <div className="mt-3 rounded-xl border border-line/60 bg-white p-4 text-sm text-slate-700 leading-relaxed italic">
                  &ldquo;{app.message}&rdquo;
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t border-line/80 bg-white/95 px-6 py-4 backdrop-blur-sm">
            <div className="text-xs text-muted">
              {isPending
                ? "Duyệt đơn sẽ tự động thêm ứng viên vào hợp đồng phòng và chia sẻ chi phí."
                : isAccepted
                ? "Thành viên đã được thêm vào hợp đồng phòng."
                : "Đơn ứng tuyển này đã bị từ chối."}
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                className="rounded-xl border border-line bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                onClick={onClose}
              >
                Đóng
              </button>
              {isPending && onAccept && onReject && (
                <>
                  <button
                    type="button"
                    className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors disabled:opacity-50"
                    onClick={onReject}
                    disabled={busy}
                  >
                    Từ chối
                  </button>
                  <button
                    type="button"
                    className="rounded-xl bg-teal-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-teal-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    onClick={onAccept}
                    disabled={busy}
                  >
                    {busy ? (
                      <>
                        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Đang duyệt…
                      </>
                    ) : (
                      <>
                        <Icon name="check" size={14} />
                        Duyệt vào phòng
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* LIGHTBOX MODAL Phóng To Ảnh CCCD */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative max-h-[95vh] max-w-4xl overflow-hidden rounded-2xl bg-slate-900 p-4 text-white shadow-2xl">
            <div className="mb-3 flex items-center justify-between border-b border-slate-700 pb-2">
              <span className="text-sm font-semibold">{lightboxUrl.title}</span>
              <button
                type="button"
                className="grid h-8 w-8 place-items-center rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                onClick={() => setLightboxUrl(null)}
                aria-label="Đóng"
              >
                <Icon name="close" size={16} />
              </button>
            </div>
            <img
              src={lightboxUrl.url}
              alt={lightboxUrl.title}
              className="max-h-[80vh] w-auto max-w-full rounded-lg object-contain mx-auto"
            />
          </div>
        </div>
      )}
    </>
  );
}

function InfoItem({
  label,
  value,
  highlight,
  wide,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd
        className={`mt-0.5 text-sm ${
          highlight ? "font-bold text-teal-800" : "font-semibold text-slate-800"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function renderStatusBadge(status: string) {
  switch (status) {
    case "PENDING":
      return (
        <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
          Chờ duyệt
        </span>
      );
    case "ACCEPTED_PENDING":
      return (
        <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
          Đang thêm vào hợp đồng…
        </span>
      );
    case "ACCEPTED":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
          <Icon name="check" size={12} /> Đã duyệt vào phòng
        </span>
      );
    case "REJECTED_FULL":
      return (
        <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 border border-rose-200">
          Đã từ chối (Phòng đã đủ)
        </span>
      );
    case "REJECTED":
      return (
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 border border-slate-200">
          Đã từ chối
        </span>
      );
    default:
      return (
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
          {status}
        </span>
      );
  }
}
