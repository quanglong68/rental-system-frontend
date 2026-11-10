import { useCallback, useEffect, useState } from "react";
import type { Id } from "@/shared/lib/id";
import { contractsApi, type MoveOutRequest } from "@/features/contracts/api/contractsApi";
import { bookingApi, type RentalRequest } from "@/api/booking";
import { getMyProfile, type UserProfile } from "@/api/userNotification";
import { Icon, MiniStat, PageHead, Pill, useToast } from "@/shared/ui";
import { useBuildingLookup, useCustomerLookup, useRoomLookup } from "@/shared/lib/refLabels";
import { errorText } from "@/shared/api/errors";
import RequestDossierModal from "@/features/sales/ui/RequestDossierModal";

type Counts = {
  total: number;
  active: number;
  draft: number;
  pendingMoveOuts: number;
  pendingRentalRequests: number;
};

const fmtCount = (value: number | undefined) => (value == null ? "—" : String(value));

const fmtDate = (value: string | undefined | null) => {
  if (!value) return "Chưa ấn định";
  try {
    return new Date(`${value}T00:00:00`).toLocaleDateString("vi-VN");
  } catch {
    return value;
  }
};

export default function ManagerHome({ onNavigate }: { onNavigate: (s: string) => void }) {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [pendingMoveOuts, setPendingMoveOuts] = useState<MoveOutRequest[]>([]);
  const [rentalRequests, setRentalRequests] = useState<RentalRequest[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadWarning, setLoadWarning] = useState("");
  const [processingId, setProcessingId] = useState<Id | null>(null);
  const [toastNode, showToast] = useToast();

  // Modal states
  const [rejectFor, setRejectFor] = useState<RentalRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [dossierFor, setDossierFor] = useState<RentalRequest | null>(null);

  const buildingOf = useBuildingLookup([
    ...(profile?.buildingIds ?? []),
    ...rentalRequests.map((r) => r.buildingId),
  ]);
  const roomOf = useRoomLookup(rentalRequests.map((r) => r.roomId));
  const customerOf = useCustomerLookup([
    ...pendingMoveOuts.map((m) => m.requestedBy),
    ...rentalRequests.map((r) => r.customerId),
  ]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setLoadWarning("");
    try {
      const [all, active, draft, moveOuts, reqs, myProfile] = await Promise.allSettled([
        contractsApi.list({ page: 0, size: 1 }),
        contractsApi.list({ status: "ACTIVE", page: 0, size: 1 }),
        contractsApi.list({ status: "DRAFT", page: 0, size: 1 }),
        contractsApi.moveOuts({ status: "PENDING", page: 0, size: 5 }),
        bookingApi.manageRentalRequests({ page: 0, size: 10 }),
        getMyProfile(),
      ]);

      const problems: string[] = [];
      const pick = <T,>(r: PromiseSettledResult<T>, label: string): T | null => {
        if (r.status === "fulfilled") return r.value;
        problems.push(label);
        return null;
      };
      const allPage = pick(all, "tổng hợp đồng");
      const activePage = pick(active, "hợp đồng hiệu lực");
      const draftPage = pick(draft, "hợp đồng nháp");
      const moveOutsPage = pick(moveOuts, "yêu cầu trả phòng");
      const reqsPage = pick(reqs, "yêu cầu thuê");
      const myProfileValue = pick(myProfile, "hồ sơ cá nhân");

      const openReqs = (reqsPage?.content ?? []).filter(
        (r) => r.status === "PENDING" || r.status === "VERIFIED"
      );

      setCounts({
        total: allPage?.totalElements ?? 0,
        active: activePage?.totalElements ?? 0,
        draft: draftPage?.totalElements ?? 0,
        pendingMoveOuts: moveOutsPage?.totalElements ?? 0,
        pendingRentalRequests: openReqs.length,
      });

      setPendingMoveOuts(moveOutsPage?.content ?? []);
      setRentalRequests(openReqs);

      if (myProfileValue) setProfile(myProfileValue);
      setLoadWarning(problems.length > 0 ? `Không tải được ${problems.join(", ")}.` : "");
    } catch (loadError) {
      setCounts(null);
      setPendingMoveOuts([]);
      setRentalRequests([]);
      setError(errorText(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAcceptRequest = async (req: RentalRequest) => {
    setProcessingId(req.id);
    try {
      if (req.status === "PENDING") {
        await bookingApi.verifyRentalRequest(req.id);
      }
      await bookingApi.acceptRentalRequest(req.id);
      showToast("Đã duyệt yêu cầu thuê! Hệ thống đã tự động tạo hợp đồng nháp PDF để hai bên ký.");
      void load();
    } catch (err) {
      showToast(errorText(err));
    } finally {
      setProcessingId(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectFor) return;
    if (!rejectReason.trim()) {
      showToast("Vui lòng nhập lý do từ chối yêu cầu thuê.");
      return;
    }
    setProcessingId(rejectFor.id);
    try {
      await bookingApi.rejectRentalRequest(rejectFor.id, rejectReason.trim());
      showToast("Đã từ chối yêu cầu thuê phòng.");
      setRejectFor(null);
      setRejectReason("");
      void load();
    } catch (err) {
      showToast(errorText(err));
    } finally {
      setProcessingId(null);
    }
  };

  const errorNote = error ? "Không tải được" : loading ? "Đang tải…" : "Trong phạm vi tòa nhà";


  const buildingSubtitle = profile?.buildingIds?.length
    ? profile.buildingIds.map((id) => buildingOf(id) ?? `Tòa #${id}`).join(" · ")
    : "Tất cả tòa nhà";

  return (
    <>
      {toastNode}
      <PageHead
        eyebrow={`QUẢN LÝ VẬN HÀNH · ${buildingSubtitle}`}
        title={`Chào ${profile?.fullName || "Quản lý"}, đây là việc cần duyệt.`}
        desc="Tổng quan vận hành tòa nhà bạn phụ trách. Dữ liệu chỉ trong phạm vi các tòa nhà được phân công."
        actions={
          <>
            <button className="secondary-button" onClick={() => onNavigate("Chốt chỉ số")}>
              <Icon name="wallet" size={16} /> Chốt chỉ số
            </button>
            <button
              className="primary-button"
              onClick={() => onNavigate("Hợp đồng")}
              title="Quản lý và lập hợp đồng thuê"
            >
              <Icon name="plus" size={16} /> Hợp đồng
            </button>
          </>
        }
      />

      <section className="stats-grid mb-6">
        {loadWarning && !loading && !error && (
          <div className="alert alert-error mb-0 w-full sm:col-span-2 lg:col-span-4">
            <Icon name="shield" size={18} /><div>{loadWarning}</div>
          </div>
        )}
        <MiniStat
          label="Tổng hợp đồng"
          value={fmtCount(counts?.total)}
          note={errorNote}
        />
        <MiniStat
          label="Đang hiệu lực"
          value={fmtCount(counts?.active)}
          note={errorNote}
          tone="sky"
        />
        <MiniStat
          label="Bản nháp"
          value={fmtCount(counts?.draft)}
          note={errorNote}
          tone="amber"
        />
        <MiniStat
          label="Yêu cầu trả phòng"
          value={fmtCount(counts?.pendingMoveOuts)}
          note={error ? "Không tải được" : "Chờ quản lý duyệt"}
          tone="coral"
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Panel 1: Yêu cầu trả phòng */}
        <article className="panel">
          <div className="panel-header">
            <div>
              <h2>Yêu cầu trả phòng chờ duyệt</h2>
              <p>Dữ liệu hợp đồng đang xử lý</p>
            </div>
            <Pill tone="coral">
              {loading ? "…" : error ? "Không tải được" : `${counts?.pendingMoveOuts ?? 0} chờ`}
            </Pill>
          </div>
          <div>
            {loading && <div className="p-5 text-sm text-muted">Đang tải yêu cầu trả phòng…</div>}

            {!loading && error && (
              <div className="p-5">
                <div className="alert alert-error">
                  <Icon name="shield" size={18} />
                  <div>{error}</div>
                </div>
                <button className="secondary-button mt-3 !h-9" onClick={() => void load()}>
                  Thử lại
                </button>
              </div>
            )}

            {!loading && !error && pendingMoveOuts.length === 0 && (
              <div className="p-5 text-sm text-muted">
                Không có yêu cầu trả phòng nào đang chờ duyệt.
              </div>
            )}

            {!loading &&
              !error &&
              pendingMoveOuts.map((request) => (
                <div key={request.id} className="approval">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Pill tone="amber">Trả phòng</Pill>
                      <span className="text-[11px] text-muted">HĐ #{request.contractId}</span>
                    </div>
                    <div className="mt-2 text-[14px] font-extrabold">
                      {customerOf(request.requestedBy) ?? `Khách thuê #${request.requestedBy}`}
                    </div>
                    <div className="text-xs text-muted">
                      Dự kiến trả {fmtDate(request.expectedMoveOutDate)} ·{" "}
                      {request.reason?.trim() || "Không ghi lý do"}
                    </div>
                  </div>
                  <button
                    className="secondary-button !h-9"
                    onClick={() => onNavigate("Hợp đồng")}
                  >
                    Mở hợp đồng
                  </button>
                </div>
              ))}
          </div>
          {!loading && !error && (
            <div className="px-5 pb-5 text-xs text-muted">
              Duyệt hoặc từ chối trả phòng chi tiết trong trang Quản lý hợp đồng.
            </div>
          )}
        </article>

        {/* Panel 2: Yêu cầu thuê phòng chờ duyệt */}
        <article className="panel">
          <div className="panel-header">
            <div>
              <h2>Yêu cầu thuê phòng mới</h2>
              <p>Đăng ký thuê phòng từ khách hàng</p>
            </div>
            <Pill tone="teal">
              {loading ? "…" : `${counts?.pendingRentalRequests ?? 0} chờ`}
            </Pill>
          </div>
          <div>
            {loading && <div className="p-5 text-sm text-muted">Đang tải yêu cầu thuê…</div>}

            {!loading && error && (
              <div className="p-5">
                <div className="alert alert-error"><Icon name="shield" size={18} /><div>{error}</div></div>
                <button className="secondary-button mt-3 !h-9" onClick={() => void load()}>Thử lại</button>
              </div>
            )}

            {!loading && !error && rentalRequests.length === 0 && (
              <div className="p-5 text-sm text-muted">
                Hiện không có yêu cầu thuê phòng nào đang chờ duyệt.
              </div>
            )}

            {!loading &&
              !error &&
              rentalRequests.map((req) => (
                <div key={req.id} className={`approval ${!req.readAt ? "bg-sky-50/40" : ""}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1.5 font-bold text-xs text-text">
                        #{req.id}
                        {!req.readAt && (
                          <span className="inline-block h-2 w-2 rounded-full bg-sky-500" title="Chưa đọc" />
                        )}
                      </span>
                      <Pill tone={req.status === "VERIFIED" ? "teal" : "amber"}>
                        {req.status === "VERIFIED" ? "Đã xác minh" : "Chờ xử lý"}
                      </Pill>
                      <span className="text-[11px] text-muted">
                        Phòng {roomOf(req.roomId)?.code ?? `#${req.roomId}`} ·{" "}
                        {buildingOf(req.buildingId) ?? `Tòa #${req.buildingId}`}
                      </span>
                    </div>
                    <div className="mt-1.5 text-[14px] font-bold text-text">
                      {req.fullName || customerOf(req.customerId) || `Khách hàng #${req.customerId}`}
                      {req.phone && <span className="ml-2 text-xs font-normal text-muted">({req.phone})</span>}
                    </div>
                    <div className="mt-1 text-xs text-muted flex flex-wrap gap-x-3">
                      <span>Dự kiến vào ở: <strong className="text-text font-medium">{fmtDate(req.moveInDate)}</strong></span>
                      {req.depositAmount != null && (
                        <span>Cọc: <strong className="text-text font-medium">{req.depositAmount.toLocaleString("vi-VN")} đ</strong></span>
                      )}
                    </div>
                    {req.note && (
                      <div className="mt-1 text-xs italic text-muted">
                        "{req.note}"
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="btn-outline !h-8 !py-1 text-xs"
                      onClick={() => setDossierFor(req)}
                    >
                      Hồ sơ
                    </button>
                    <button
                      type="button"
                      className="primary-button !h-8 !py-1 text-xs"
                      disabled={processingId === req.id}
                      onClick={() => handleAcceptRequest(req)}
                    >
                      {processingId === req.id ? "Đang xử lý…" : req.status === "VERIFIED" ? "Duyệt tạo HĐ" : "Xác minh & Duyệt"}
                    </button>
                    <button
                      type="button"
                      className="secondary-button !h-8 !py-1 text-xs text-red-600 hover:border-red-400"
                      disabled={processingId === req.id}
                      onClick={() => {
                        setRejectFor(req);
                        setRejectReason("");
                      }}
                    >
                      Từ chối
                    </button>
                  </div>
                </div>
              ))}
          </div>
          {!loading && !error && (
            <div className="px-5 pb-5 pt-2 text-xs text-muted">
              Duyệt yêu cầu thuê sẽ tạo hợp đồng nháp PDF gửi cả hai bên ký điện tử. Yêu cầu khác của cùng phòng chỉ bị từ chối sau khi hợp đồng được ký hoàn tất.
            </div>
          )}
        </article>
      </div>

      {/* Modal từ chối yêu cầu thuê chuyên nghiệp */}
      {rejectFor && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-line">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="cx-badge danger">Từ chối hồ sơ</span>
                <h3 className="mt-2 text-lg font-bold text-text">
                  Từ chối yêu cầu thuê #{rejectFor.id}
                </h3>
                <p className="mt-1 text-xs text-muted">
                  Khách: {rejectFor.fullName || customerOf(rejectFor.customerId) || `#${rejectFor.customerId}`} · Phòng {roomOf(rejectFor.roomId)?.code ?? `#${rejectFor.roomId}`}
                </p>
              </div>
              <button
                type="button"
                className="icon-button !h-8 !w-8"
                onClick={() => setRejectFor(null)}
                aria-label="Đóng"
              >
                <Icon name="close" size={16} />
              </button>
            </div>

            <p className="mt-4 text-xs font-medium text-text">
              Nhập lý do từ chối (thông báo sẽ được gửi trực tiếp đến khách hàng):
            </p>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Ví dụ: Ảnh CCCD bị mờ/chói sáng, thông tin không khớp, hoặc phòng đã có khách hoàn tất hợp đồng trước..."
              className="mt-2 w-full rounded-xl border border-line p-3 text-sm focus:border-teal-600 focus:outline-none"
            />

            <div className="mt-2 flex flex-wrap gap-1.5">
              {[
                "Ảnh CCCD không rõ nét, vui lòng chụp lại",
                "Thông tin đăng ký chưa khớp với giấy tờ",
                "Phòng đã có khách hoàn tất ký hợp đồng trước",
              ].map((reason) => (
                <button
                  key={reason}
                  type="button"
                  className="rounded-full border border-line bg-surface/50 px-2.5 py-0.5 text-[11px] text-muted hover:border-teal-400 hover:text-text transition"
                  onClick={() => setRejectReason(reason)}
                >
                  {reason}
                </button>
              ))}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="secondary-button !h-9 text-xs"
                onClick={() => setRejectFor(null)}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="primary-button !h-9 !bg-red-600 !border-red-600 text-white text-xs hover:!bg-red-700"
                disabled={processingId === rejectFor.id}
                onClick={handleConfirmReject}
              >
                {processingId === rejectFor.id ? "Đang xử lý…" : "Xác nhận từ chối"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal xem hồ sơ chi tiết */}
      {dossierFor && (
        <RequestDossierModal
          request={dossierFor}
          roomCode={roomOf(dossierFor.roomId)?.code ?? `#${dossierFor.roomId}`}
          buildingName={buildingOf(dossierFor.buildingId) ?? `#${dossierFor.buildingId}`}
          customerName={customerOf(dossierFor.customerId) ?? `Khách #${dossierFor.customerId}`}
          onClose={() => setDossierFor(null)}
        />
      )}
    </>
  );
}
