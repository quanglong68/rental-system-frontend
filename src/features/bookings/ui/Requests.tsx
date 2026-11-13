import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import type { Id } from "@/shared/lib/id";
import { sameId } from "@/shared/lib/id";
import { Icon, todayVN, vnd } from "@/shared/ui";
import { bookingApi, type RentalRequest, type Appointment } from "@/api/booking";
import {
  contractsApi,
  type Contract,
  type ContractDetail,
  type MoveOutRequest,
  type RenewalRequest,
} from "@/features/contracts/api/contractsApi";
import { useCxToast } from "@/features/notifications";
import { useBuildingLookup, useRoomLookup } from "@/shared/lib/refLabels";
import { toVNTime } from "@/shared/lib/format";
import { errorText } from "@/shared/api/errors";
import { CustomerSignatureCard } from "@/features/tenant-home/ui/MyHomeExtras";
import ChatStartButton from "@/features/chat/ui/ChatStartButton";

type TabKey = "requests" | "appointments" | "move-outs" | "renewals";
type RequestFilter = "all" | "open" | "done" | "closed";
type AppointmentFilter = "all" | "open" | "done" | "cancelled";

const requestFilters: { key: RequestFilter; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "open", label: "Đang xử lý" },
  { key: "done", label: "Đã duyệt" },
  { key: "closed", label: "Đã hủy / Từ chối" },
];

const appointmentFilters: { key: AppointmentFilter; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "open", label: "Sắp tới" },
  { key: "done", label: "Đã xem" },
  { key: "cancelled", label: "Đã hủy" },
];

const reasons = [
  "Hết hạn hợp đồng",
  "Chuyển nơi làm việc / học tập",
  "Tìm phòng khác phù hợp hơn",
  "Về quê sinh sống",
  "Lý do cá nhân khác",
];

const moveOutStatusLabel: Record<MoveOutRequest["status"], string> = {
  PENDING: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Bị từ chối",
  COMPLETED: "Đã hoàn tất",
};

const newestFirst = <T,>(items: T[], getTime: (item: T) => string | null | undefined) =>
  [...items].sort((a, b) => {
    const ta = Date.parse(getTime(a) ?? "") || 0;
    const tb = Date.parse(getTime(b) ?? "") || 0;
    return tb - ta;
  });

const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

const nextDay = (d: string) => {
  const date = new Date(Date.parse(`${d}T00:00:00Z`) + 86400000);
  return date.toISOString().slice(0, 10);
};

const plusMonths = (d: string, months: number) => {
  const [y, m, day] = d.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1 + months, day));
  return next.toISOString().slice(0, 10);
};

const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
};

export default function Requests() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get("tab") as TabKey | null;

  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    if (urlTab === "appointments" || urlTab === "move-outs" || urlTab === "renewals") {
      return urlTab;
    }
    return "requests";
  });

  const [requestFilter, setRequestFilter] = useState<RequestFilter>("all");
  const [appointmentFilter, setAppointmentFilter] = useState<AppointmentFilter>("all");
  const [requests, setRequests] = useState<RentalRequest[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [myContracts, setMyContracts] = useState<Contract[]>([]);
  const [moveOuts, setMoveOuts] = useState<MoveOutRequest[]>([]);
  const [renewalRequests, setRenewalRequests] = useState<RenewalRequest[]>([]);
  const [renewalDetail, setRenewalDetail] = useState<ContractDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [toastNode, showToast] = useCxToast();

  // Move-out form state
  const [moveOutDate, setMoveOutDate] = useState("");
  const [moveOutReason, setMoveOutReason] = useState("");
  const [moveOutNote, setMoveOutNote] = useState("");
  const [moveOutBusy, setMoveOutBusy] = useState(false);

  // Renewal form state
  const [renewalBusy, setRenewalBusy] = useState(false);

  const roomOf = useRoomLookup([
    ...requests.map((r) => r.roomId),
    ...appointments.map((a) => a.roomId),
    ...myContracts.map((c) => c.roomId),
  ]);
  const buildingOf = useBuildingLookup([
    ...requests.map((r) => r.buildingId),
    ...appointments.map((a) => a.buildingId),
    ...myContracts.map((c) => c.buildingId),
  ]);

  const switchTab = (tab: TabKey) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [reqRes, apptRes, contractRes, moveOutRes, renewalRes] = await Promise.allSettled([
        bookingApi.myRentalRequests(undefined, 0, 50),
        bookingApi.myAppointments(0, 50),
        contractsApi.mine(),
        contractsApi.moveOutsMine(),
        contractsApi.renewalRequestsMine(),
      ]);

      if (reqRes.status === "fulfilled" && reqRes.value?.content) {
        setRequests(newestFirst(reqRes.value.content, (r) => r.requestedAt));
      }
      if (apptRes.status === "fulfilled" && apptRes.value?.content) {
        setAppointments(newestFirst(apptRes.value.content, (a) => a.createdAt));
      }

      let contractList: Contract[] = [];
      if (contractRes.status === "fulfilled" && Array.isArray(contractRes.value)) {
        contractList = contractRes.value;
        setMyContracts(contractList);
      }
      let renewalList: RenewalRequest[] = [];
      if (renewalRes.status === "fulfilled" && Array.isArray(renewalRes.value)) {
        renewalList = newestFirst(renewalRes.value, (r) => r.createdAt);
        setRenewalRequests(renewalList);
      }
      if (moveOutRes.status === "fulfilled" && Array.isArray(moveOutRes.value)) {
        setMoveOuts(newestFirst(moveOutRes.value, (m) => m.createdAt));
      }

      // A renewal draft is only signable once the manager has sent it (AWAITING_TENANT).
      // Until then the tenant only sees the request status, never a contract.
      const current =
        contractList.find((c) => c.status === "ACTIVE" && c.renewedFromContractId == null) ??
        contractList.find((c) => c.status === "ACTIVE");
      const latestRenewal =
        renewalList.find((r) => current && sameId(r.contractId, current.id)) ?? renewalList[0] ?? null;
      const linkedContract = latestRenewal?.renewalContractId
        ? contractList.find((c) => sameId(c.id, latestRenewal.renewalContractId)) ?? null
        : null;
      const signatureStatus = linkedContract?.signatureStatus ?? latestRenewal?.renewalSignatureStatus ?? null;
      const awaitingTenant =
        latestRenewal?.status === "APPROVED" &&
        signatureStatus === "AWAITING_TENANT" &&
        (linkedContract?.status ?? latestRenewal?.renewalContractStatus) === "DRAFT";
      if (awaitingTenant && linkedContract) {
        try {
          setRenewalDetail(await contractsApi.detail(linkedContract.id));
        } catch {
          setRenewalDetail(null);
        }
      } else {
        setRenewalDetail(null);
      }

      if (reqRes.status === "rejected") {
        showToast(errorText(reqRes.reason, "Không tải được yêu cầu thuê phòng"));
      }
      if (apptRes.status === "rejected") {
        showToast(errorText(apptRes.reason, "Không tải được lịch xem phòng"));
      }
    } catch (err) {
      showToast(errorText(err, "Không tải được dữ liệu yêu cầu"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Sync tab with URL parameter changes
  useEffect(() => {
    if (urlTab && urlTab !== activeTab) {
      setActiveTab(urlTab);
    }
  }, [urlTab]);

  const activeContract =
    myContracts.find((c) => c.status === "ACTIVE" && c.renewedFromContractId == null) ??
    myContracts.find((c) => c.status === "ACTIVE") ??
    null;
  const latestRenewal = activeContract
    ? renewalRequests.find((r) => sameId(r.contractId, activeContract.id)) ?? renewalRequests[0] ?? null
    : renewalRequests[0] ?? null;
  const renewalContract = latestRenewal?.renewalContractId
    ? myContracts.find((c) => sameId(c.id, latestRenewal.renewalContractId)) ?? null
    : myContracts.find((c) => c.status === "DRAFT" && c.renewedFromContractId != null) ?? null;
  const renewalSignature = renewalContract?.signatureStatus ?? latestRenewal?.renewalSignatureStatus ?? null;
  const renewalCompleted =
    renewalContract?.status === "ACTIVE" ||
    renewalSignature === "COMPLETED" ||
    latestRenewal?.renewalContractStatus === "ACTIVE";
  const renewalAbandoned = renewalSignature === "DECLINED" || renewalSignature === "EXPIRED";
  const showRenewalForm =
    !latestRenewal ||
    latestRenewal.status === "REJECTED" ||
    latestRenewal.status === "CANCELLED" ||
    renewalAbandoned;
  const latestMoveOut = activeContract
    ? moveOuts.find((m) => sameId(m.contractId, activeContract.id)) ?? null
    : null;

  // 30-day window calculation
  const remainingDays = activeContract?.endDate
    ? daysBetween(todayVN(), activeContract.endDate)
    : null;
  const isEligibleWindow = remainingDays != null && remainingDays <= 30 && remainingDays >= 0;
  const earliestEligibleDate = activeContract?.endDate
    ? new Date(Date.parse(`${activeContract.endDate}T00:00:00Z`) - 30 * 86400000)
        .toISOString()
        .slice(0, 10)
    : null;
  const canSubmitMoveOut = isEligibleWindow && (latestMoveOut == null || latestMoveOut.status === "REJECTED");

  const handleCancelRequest = async (id: Id) => {
    try {
      await bookingApi.cancelRentalRequest(id);
      showToast("Đã hủy yêu cầu thuê phòng thành công!");
      loadData();
    } catch (err) {
      showToast(errorText(err, "Không thể hủy yêu cầu thuê"));
    }
  };

  const handleCancelAppointment = async (id: Id) => {
    try {
      await bookingApi.cancelAppointment(id);
      showToast("Đã hủy lịch xem phòng!");
      loadData();
    } catch (err) {
      showToast(errorText(err, "Không thể hủy lịch hẹn"));
    }
  };

  const handleCreateMoveOut = async () => {
    if (!activeContract) return;
    if (!moveOutDate) {
      showToast("Vui lòng chọn ngày dự kiến trả phòng.");
      return;
    }
    setMoveOutBusy(true);
    try {
      await contractsApi.createMoveOut({
        contractId: activeContract.id,
        expectedMoveOutDate: moveOutDate,
        reason: [moveOutReason.trim(), moveOutNote.trim()].filter(Boolean).join(" · ") || undefined,
      });
      showToast("Đã gửi yêu cầu trả phòng thành công! Ban quản lý sẽ xem xét và phê duyệt.");
      setMoveOutDate("");
      setMoveOutReason("");
      setMoveOutNote("");
      await loadData();
    } catch (err) {
      showToast(errorText(err, "Không thể gửi yêu cầu trả phòng"));
    } finally {
      setMoveOutBusy(false);
    }
  };

  const handleRequestRenewal = async () => {
    if (!activeContract) return;
    setRenewalBusy(true);
    try {
      await contractsApi.requestRenewal(activeContract.id, { termMonths: 12 });
      showToast("Đã gửi yêu cầu gia hạn 1 năm (12 tháng). Ban quản lý sẽ duyệt trước khi soạn hợp đồng mới.");
      await loadData();
    } catch (err) {
      showToast(errorText(err, "Không thể gửi yêu cầu gia hạn"));
    } finally {
      setRenewalBusy(false);
    }
  };

  const handleCancelRenewal = async () => {
    if (!latestRenewal) return;
    setRenewalBusy(true);
    try {
      await contractsApi.cancelRenewalRequest(latestRenewal.id);
      showToast("Đã hủy yêu cầu gia hạn.");
      await loadData();
    } catch (err) {
      showToast(errorText(err, "Không thể hủy yêu cầu gia hạn"));
    } finally {
      setRenewalBusy(false);
    }
  };

  const renderStatus = (status: string, isContractActive?: boolean) => {
    if (status === "ACCEPTED" && isContractActive) {
      return <span className="cx-badge success">Hợp đồng đã có hiệu lực</span>;
    }
    switch (status) {
      case "PENDING":
        return <span className="cx-badge warning">Chờ xử lý</span>;
      case "VERIFIED":
        return <span className="cx-badge info">Đã xác minh hồ sơ</span>;
      case "ACCEPTED":
        return <span className="cx-badge info">Đã duyệt · Chờ ký hợp đồng</span>;
      case "SCHEDULED":
        return <span className="cx-badge warning">Chờ xác nhận lịch</span>;
      case "CONFIRMED":
        return <span className="cx-badge success">Đã xác nhận lịch</span>;
      case "VIEWED":
        return <span className="cx-badge info">Đã xem phòng</span>;
      case "REJECTED":
        return <span className="cx-badge danger">Từ chối</span>;
      case "CANCELLED":
        return <span className="cx-badge muted">Đã hủy</span>;
      default:
        return <span className="cx-badge">{status}</span>;
    }
  };

  const filteredRequests = requests.filter((r) => {
    if (requestFilter === "open") return r.status === "PENDING" || r.status === "VERIFIED";
    if (requestFilter === "done") return r.status === "ACCEPTED";
    if (requestFilter === "closed") return r.status === "REJECTED" || r.status === "CANCELLED";
    return true;
  });

  const filteredAppointments = appointments.filter((a) => {
    if (appointmentFilter === "open") return a.status === "SCHEDULED" || a.status === "CONFIRMED";
    if (appointmentFilter === "done") return a.status === "VIEWED";
    if (appointmentFilter === "cancelled") return a.status === "CANCELLED";
    return true;
  });

  return (
    <>
      {toastNode}
      <section className="cx-section !pt-32">
        <div className="cx-eyebrow">Yêu cầu · Khách hàng</div>
        <h1 className="cx-serif cx-h2">
          Trung tâm <em>Yêu cầu &amp; Hợp đồng</em>
        </h1>
        <p className="mt-2 text-sm text-muted max-w-2xl">
          Quản lý toàn bộ tiến trình yêu cầu thuê phòng, lịch hẹn xem phòng, yêu cầu trả phòng và gia hạn hợp đồng phòng của bạn.
        </p>

        {/* 4 Dedicated Tabs */}
        <div className="mt-8 flex flex-wrap gap-2.5 border-b border-line pb-4">
          <button
            type="button"
            className={`cx-chip ${activeTab === "requests" ? "on font-semibold" : ""}`}
            onClick={() => switchTab("requests")}
          >
            <Icon name="home" size={15} /> Yêu cầu thuê phòng ({requests.length})
          </button>
          <button
            type="button"
            className={`cx-chip ${activeTab === "appointments" ? "on font-semibold" : ""}`}
            onClick={() => switchTab("appointments")}
          >
            <Icon name="calendar" size={15} /> Lịch xem phòng ({appointments.length})
          </button>
          <button
            type="button"
            className={`cx-chip ${activeTab === "move-outs" ? "on font-semibold !text-rose-700 !border-rose-300" : ""}`}
            onClick={() => switchTab("move-outs")}
          >
            <Icon name="contract" size={15} /> Yêu cầu trả phòng ({moveOuts.length})
          </button>
          <button
            type="button"
            className={`cx-chip ${activeTab === "renewals" ? "on font-semibold !text-teal-800 !border-teal-300" : ""}`}
            onClick={() => switchTab("renewals")}
          >
            <Icon name="contract" size={15} /> Yêu cầu gia hạn hợp đồng (1 năm)
          </button>
        </div>

        {loading ? (
          <div className="py-20 text-center text-muted">Đang tải dữ liệu yêu cầu…</div>
        ) : activeTab === "requests" ? (
          /* ========================================================================= */
          /* TAB 1: YÊU CẦU THUÊ PHÒNG */
          /* ========================================================================= */
          <>
            <div className="mt-6 flex flex-wrap gap-2">
              {requestFilters.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`cx-chip ${requestFilter === item.key ? "on" : ""}`}
                  onClick={() => setRequestFilter(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {filteredRequests.length === 0 ? (
              <div className="mt-8 rounded-2xl border border-line bg-white p-12 text-center">
                <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-surface text-muted">
                  <Icon name="home" size={28} />
                </div>
                <h2 className="text-xl font-bold">
                  {requests.length === 0 ? "Bạn chưa có yêu cầu thuê nào" : "Không có yêu cầu trong nhóm này"}
                </h2>
                <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
                  Hãy khám phá danh sách phòng còn trống và gửi yêu cầu để giữ chỗ sớm nhất.
                </p>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {filteredRequests.map((r) => {
                  const matchingContract = myContracts.find(
                    (c) => (c.rentalRequestId && sameId(c.rentalRequestId, r.id)) || sameId(c.roomId, r.roomId)
                  );
                  const isContractActive = matchingContract?.status === "ACTIVE";

                  return (
                    <div
                      key={r.id}
                      className="flex flex-col justify-between gap-4 rounded-xl border border-line bg-white p-6 shadow-sm md:flex-row md:items-center"
                    >
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="font-bold text-text">
                            Yêu cầu #{r.id} · Phòng {roomOf(r.roomId)?.code ?? `#${r.roomId}`} · Tòa{" "}
                            {buildingOf(r.buildingId) ?? `#${r.buildingId}`}
                          </h3>
                          {renderStatus(r.status, isContractActive)}
                          {r.status === "PENDING" && <span className="cx-badge info">Mới</span>}
                        </div>
                        <p className="mt-1 text-sm text-muted">
                          Ngày dự kiến dọn vào:{" "}
                          <b>{r.moveInDate ? new Date(r.moveInDate).toLocaleDateString("vi-VN") : "Thỏa thuận"}</b>
                          {r.requestedAt ? ` · Gửi lúc ${toVNTime(r.requestedAt, true)}` : ""}
                        </p>
                        {r.note && <p className="mt-1 text-xs text-muted">Ghi chú: {r.note}</p>}
                        {r.status === "VERIFIED" && (
                          <p className="mt-1 text-xs text-muted">
                            Hồ sơ đã được nhân viên kinh doanh xác minh, đang chờ Quản lý duyệt hợp đồng.
                          </p>
                        )}
                        {r.status === "ACCEPTED" && (
                          isContractActive ? (
                            <p className="mt-1 text-xs text-emerald-700 font-medium">
                              Hợp đồng thuê phòng này đã hoàn tất ký kết và đang có hiệu lực. Bạn có thể kiểm tra chi tiết tại Phòng của tôi.
                            </p>
                          ) : (
                            <p className="mt-1 text-xs text-emerald-700 font-medium">
                              Yêu cầu đã được duyệt! Hợp đồng nháp đã sẵn sàng. Vui lòng thanh toán cọc và ký điện tử trong 2 ngày (48 giờ).
                            </p>
                          )
                        )}
                        {r.rejectReason && (
                          <p className="mt-1 text-xs font-medium text-danger">Lý do từ chối: {r.rejectReason}</p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <ChatStartButton
                          contextType="BOOKING"
                          contextId={r.id}
                          label="Nhắn SALE"
                          className="cx-btn ghost !py-2 text-xs"
                        />
                        {r.status === "ACCEPTED" && (
                          isContractActive ? (
                            <button
                              type="button"
                              className="cx-btn secondary !py-2 text-xs"
                              onClick={() => navigate("/my-room?tab=contracts")}
                            >
                              Xem hợp đồng
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="cx-btn primary !py-2 text-xs"
                              onClick={() => navigate("/my-room?action=sign#contract-signing-section")}
                            >
                              Ký hợp đồng thuê
                            </button>
                          )
                        )}
                        {(r.status === "PENDING" || r.status === "VERIFIED") && (
                          <button
                            type="button"
                            className="cx-btn ghost !py-2 text-xs text-danger hover:bg-danger/10"
                            onClick={() => handleCancelRequest(r.id)}
                          >
                            Hủy yêu cầu
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : activeTab === "appointments" ? (
          /* ========================================================================= */
          /* TAB 2: LỊCH XEM PHÒNG */
          /* ========================================================================= */
          <>
            <div className="mt-6 flex flex-wrap gap-2">
              {appointmentFilters.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`cx-chip ${appointmentFilter === item.key ? "on" : ""}`}
                  onClick={() => setAppointmentFilter(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {filteredAppointments.length === 0 ? (
              <div className="mt-8 rounded-2xl border border-line bg-white p-12 text-center">
                <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-surface text-muted">
                  <Icon name="calendar" size={28} />
                </div>
                <h2 className="text-xl font-bold">
                  {appointments.length === 0 ? "Bạn chưa có lịch hẹn xem phòng nào" : "Không có lịch hẹn trong nhóm này"}
                </h2>
                <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
                  Bạn có thể chủ động đặt lịch xem phòng trực tiếp trên trang Khám phá phòng.
                </p>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {filteredAppointments.map((a) => {
                  const linkedRequest = a.rentalRequestId
                    ? requests.find((r) => sameId(r.id, a.rentalRequestId))
                    : null;
                  const roomId = a.roomId ?? linkedRequest?.roomId ?? null;
                  const buildingId = a.buildingId ?? linkedRequest?.buildingId ?? null;
                  return (
                  <div
                    key={a.id}
                    className="flex flex-col justify-between gap-4 rounded-xl border border-line bg-white p-6 shadow-sm md:flex-row md:items-center"
                  >
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="font-bold text-text">Lịch hẹn #{a.id}</h3>
                        {renderStatus(a.status)}
                        {(a.status === "SCHEDULED" || a.status === "CONFIRMED") && (
                          <span className="cx-badge info">Mới</span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted">
                        {roomId ? (
                          <>
                            Phòng: <b>{(roomOf(roomId)?.code ?? `#${roomId}`)}</b>
                            {" · "}
                          </>
                        ) : null}
                        Tòa nhà: <b>{buildingOf(buildingId) ?? "Chưa xác định"}</b>
                      </p>
                      <p className="mt-1 text-sm text-muted">
                        Thời gian hẹn:{" "}
                        <b>{a.appointmentDate ? toVNTime(a.appointmentDate, true) : "Chưa xác định"}</b>
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <ChatStartButton
                        contextType="VIEWING"
                        contextId={a.id}
                        label="Nhắn SALE"
                        className="cx-btn ghost !py-2 text-xs"
                      />
                      {(a.status === "SCHEDULED" || a.status === "CONFIRMED") && (
                        <button
                          type="button"
                          className="cx-btn ghost !py-2 text-xs text-danger hover:bg-danger/10"
                          onClick={() => handleCancelAppointment(a.id)}
                        >
                          Hủy lịch hẹn
                        </button>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </>
        ) : activeTab === "move-outs" ? (
          /* ========================================================================= */
          /* TAB 3: YÊU CẦU TRẢ PHÒNG */
          /* ========================================================================= */
          <div className="mt-6 space-y-6">
            {!activeContract ? (
              <div className="rounded-2xl border border-line bg-white p-12 text-center">
                <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-surface text-muted">
                  <Icon name="home" size={28} />
                </div>
                <h2 className="text-xl font-bold">Bạn hiện không có hợp đồng thuê phòng đang hiệu lực</h2>
                <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
                  Chỉ người thuê đang có hợp đồng có hiệu lực (ACTIVE) mới có thể gửi yêu cầu trả phòng.
                </p>
              </div>
            ) : (
              <>
                {/* Thông tin phòng hiện tại */}
                <div className="rounded-2xl border border-line bg-white p-6 shadow-sm">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="cx-status ok">Hợp đồng #{activeContract.id}</span>
                        <h3 className="font-bold text-text text-base m-0">
                          Phòng {roomOf(activeContract.roomId)?.code ?? `#${activeContract.roomId}`} ·{" "}
                          {buildingOf(activeContract.buildingId) ?? `Tòa #${activeContract.buildingId}`}
                        </h3>
                      </div>
                      <p className="mt-1 text-xs text-muted m-0">
                        Thời hạn hợp đồng: <b>{fmtDate(activeContract.startDate)}</b> đến{" "}
                        <b>{fmtDate(activeContract.endDate)}</b>
                        {remainingDays != null && (
                          <span className={`ml-2 font-semibold ${remainingDays <= 30 ? "text-amber-700" : "text-slate-600"}`}>
                            (Còn {remainingDays} ngày)
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-muted block">Tiền đặt cọc giữ phòng</span>
                      <b className="text-emerald-700 text-base font-bold">{activeContract.depositAmount != null ? vnd(activeContract.depositAmount) : "—"}</b>
                    </div>
                  </div>

                  {/* Cảnh báo chưa đến hạn 30 ngày */}
                  {!isEligibleWindow ? (
                    <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-5 text-xs text-amber-950 space-y-2">
                      <div className="flex items-center gap-2 font-bold text-amber-900 text-sm">
                        <Icon name="clock" size={18} /> Chưa đến thời hạn gửi yêu cầu trả phòng
                      </div>
                      <p className="m-0 leading-relaxed text-amber-900">
                        Hợp đồng của bạn có hiệu lực đến ngày <b>{fmtDate(activeContract.endDate)}</b> (còn {remainingDays} ngày).
                        Theo quy định hệ thống, chức năng trả phòng hoặc gia hạn hợp đồng chỉ mở trước ngày kết thúc hợp đồng tối đa <b>30 ngày</b> (bắt đầu mở từ ngày <b>{fmtDate(earliestEligibleDate)}</b>).
                      </p>
                    </div>
                  ) : (
                    <>
                      {latestMoveOut && (
                        /* Trạng thái yêu cầu trả phòng hiện tại */
                        <div className="mt-6 rounded-2xl border border-teal-200 bg-teal-50/50 p-6 space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-teal-200/70 pb-3">
                            <div className="flex items-center gap-2.5">
                              <span className="font-bold text-teal-950 text-base">Yêu cầu trả phòng #{latestMoveOut.id}</span>
                              <span className={`cx-badge ${latestMoveOut.status === "APPROVED" ? "success" : latestMoveOut.status === "PENDING" ? "warning" : latestMoveOut.status === "COMPLETED" ? "muted" : "danger"}`}>
                                {moveOutStatusLabel[latestMoveOut.status]}
                              </span>
                            </div>
                        {latestMoveOut.createdAt && (
                          <span className="text-xs text-muted">
                            Gửi lúc: <b>{toVNTime(latestMoveOut.createdAt, true)}</b>
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-teal-900">
                        <div>
                          <span className="text-muted block">Ngày dự kiến bàn giao phòng:</span>
                          <b className="text-sm text-slate-900">{fmtDate(latestMoveOut.expectedMoveOutDate)}</b>
                        </div>
                        <div>
                          <span className="text-muted block">
                            {latestMoveOut.status === "REJECTED" ? "Phản hồi từ Ban quản lý:" : "Lý do trả phòng:"}
                          </span>
                          <b className="text-slate-800">{latestMoveOut.reason || "Không ghi"}</b>
                        </div>
                      </div>

                      {/* Thông tin quyết toán hoàn cọc (không áp dụng cho yêu cầu bị từ chối) */}
                      {latestMoveOut.status !== "REJECTED" && (latestMoveOut.refundStatus === "REFUNDED" ? (
                        <div className="mt-4 rounded-xl bg-white p-4 border border-emerald-300 shadow-xs space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-700 text-xs">Tiền cọc thực hoàn:</span>
                            <span className="text-lg font-extrabold text-emerald-600">
                              {vnd(latestMoveOut.refundAmount ?? 0)}
                            </span>
                          </div>
                          {latestMoveOut.deductionAmount ? (
                            <div className="flex justify-between text-muted text-xs border-t border-line/60 pt-2">
                              <span>Khấu trừ hư hao/điện nước:</span>
                              <span className="text-rose-600">
                                -{vnd(latestMoveOut.deductionAmount)}{" "}
                                {latestMoveOut.deductionReason ? `(${latestMoveOut.deductionReason})` : ""}
                              </span>
                            </div>
                          ) : null}
                          {latestMoveOut.refundReceiptImageKey && (
                            <button
                              type="button"
                              className="cx-btn ghost !h-8 !px-3 text-xs text-teal-800 border-teal-300 mt-2 flex items-center gap-1.5 w-full justify-center"
                              onClick={async () => {
                                try {
                                  const blob = await contractsApi.moveOutRefundReceiptBlob(latestMoveOut.id);
                                  const url = URL.createObjectURL(blob);
                                  window.open(url, "_blank", "noopener,noreferrer");
                                } catch (e) {
                                  showToast("Không thể mở biên lai: " + errorText(e));
                                }
                              }}
                            >
                              <Icon name="search" size={14} /> Xem ảnh biên lai chuyển tiền hoàn cọc
                            </button>
                          )}
                        </div>
                      ) : latestMoveOut.refundStatus === "FORFEITED" ? (
                        <div className="rounded-xl bg-rose-50 p-4 border border-rose-200 text-xs text-rose-900">
                          <b>Đã quyết toán thanh lý:</b> Không hoàn tiền cọc do trả phòng trước hạn vi phạm hợp đồng.
                        </div>
                      ) : (
                        <div className="rounded-xl bg-white/70 p-4 border border-teal-200 text-xs text-teal-900">
                          Ban quản lý sẽ chốt chỉ số điện nước cuối cùng và chuyển hoàn cọc ngay sau khi nhận bàn giao phòng vào ngày hẹn.
                        </div>
                      ))}
                    </div>
                  )}

                      {latestMoveOut?.status === "REJECTED" && (
                        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-900">
                          <div className="flex items-center gap-1.5 font-bold text-rose-900 mb-1">
                            <Icon name="alert" size={16} /> Yêu cầu trả phòng bị từ chối
                          </div>
                          <p className="m-0 leading-relaxed">
                            Bạn có thể chọn ngày mới và bấm <b>Gửi lại yêu cầu trả phòng</b> bên dưới. Yêu cầu mới sẽ được Ban quản lý xét duyệt lại từ đầu.
                          </p>
                        </div>
                      )}

                      {canSubmitMoveOut && (
                        /* Form nộp yêu cầu trả phòng */
                        <div className="mt-6 space-y-4">
                      <div className="rounded-xl border border-emerald-300 bg-emerald-50/90 p-4 text-xs text-emerald-950">
                        <div className="flex items-center gap-1.5 font-bold text-emerald-950 mb-1">
                          <Icon name="check" size={16} /> Đủ điều kiện hoàn trả tiền đặt cọc (100%)
                        </div>
                        <p className="m-0 text-emerald-800 leading-relaxed">
                          Hợp đồng của bạn kết thúc vào ngày <b>{fmtDate(activeContract.endDate)}</b>. Trả phòng đúng hạn hợp đồng sẽ được <b>hoàn lại 100% tiền đặt cọc ({activeContract.depositAmount != null ? vnd(activeContract.depositAmount) : "theo hợp đồng"})</b> sau khi chốt công tơ điện nước và trừ chi phí phát sinh thực tế (nếu có).
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700">Ngày dự kiến trả phòng *</label>
                          <input
                            type="date"
                            className="cx-input text-xs w-full mt-1.5"
                            min={todayVN()}
                            max={activeContract.endDate || undefined}
                            value={moveOutDate}
                            onChange={(e) => setMoveOutDate(e.target.value)}
                          />
                          <span className="text-[11px] text-muted block mt-1">
                            Cho phép từ hôm nay ({fmtDate(todayVN())}) đến ngày hết hạn ({fmtDate(activeContract.endDate)}).
                          </span>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700">Lý do trả phòng:</label>
                          <select
                            className="cx-input text-xs w-full mt-1.5 bg-white"
                            value={moveOutReason}
                            onChange={(e) => setMoveOutReason(e.target.value)}
                          >
                            <option value="">-- Chọn lý do --</option>
                            {reasons.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700">Ghi chú bổ sung (giờ hẹn bàn giao chìa khóa):</label>
                        <textarea
                          rows={3}
                          className="cx-input text-xs w-full mt-1.5"
                          placeholder="Ví dụ: Tôi dự kiến bàn giao phòng lúc 10h sáng ngày hẹn..."
                          value={moveOutNote}
                          onChange={(e) => setMoveOutNote(e.target.value)}
                        />
                      </div>

                      <button
                        type="button"
                        className="cx-btn danger !h-10 text-xs font-semibold"
                        disabled={moveOutBusy || !moveOutDate}
                        onClick={handleCreateMoveOut}
                      >
                        {moveOutBusy
                          ? "Đang gửi yêu cầu…"
                          : latestMoveOut?.status === "REJECTED"
                            ? "Gửi lại yêu cầu trả phòng"
                            : "Gửi yêu cầu trả phòng"}
                      </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          /* ========================================================================= */
          /* TAB 4: YÊU CẦU GIA HẠN HỢP ĐỒNG (1 NĂM) */
          /* ========================================================================= */
          <div className="mt-6 space-y-6">
            {!activeContract ? (
              <div className="rounded-2xl border border-line bg-white p-12 text-center">
                <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-surface text-muted">
                  <Icon name="contract" size={28} />
                </div>
                <h2 className="text-xl font-bold">Bạn hiện không có hợp đồng thuê phòng đang hiệu lực</h2>
                <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
                  Chỉ khách thuê đang có hợp đồng có hiệu lực (ACTIVE) mới có thể gửi yêu cầu gia hạn hợp đồng.
                </p>
              </div>
            ) : (
              <>
                {/* Thông tin hợp đồng hiện tại */}
                <div className="rounded-2xl border border-line bg-white p-6 shadow-sm">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="cx-status ok">Hợp đồng #{activeContract.id}</span>
                        <h3 className="font-bold text-text text-base m-0">
                          Phòng {roomOf(activeContract.roomId)?.code ?? `#${activeContract.roomId}`} ·{" "}
                          {buildingOf(activeContract.buildingId) ?? `Tòa #${activeContract.buildingId}`}
                        </h3>
                      </div>
                      <p className="mt-1 text-xs text-muted m-0">
                        Thời hạn hiện tại: <b>{fmtDate(activeContract.startDate)}</b> đến{" "}
                        <b>{fmtDate(activeContract.endDate)}</b>
                        {remainingDays != null && (
                          <span className={`ml-2 font-semibold ${remainingDays <= 30 ? "text-amber-700" : "text-slate-600"}`}>
                            (Còn {remainingDays} ngày)
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-muted block">Giá thuê hàng tháng</span>
                      <b className="text-teal-900 text-base font-bold">{activeContract.rentAmount != null ? `${vnd(activeContract.rentAmount)}/tháng` : "—"}</b>
                    </div>
                  </div>

                  {latestRenewal && latestRenewal.status === "PENDING" ? (
                    <div className="mt-6 space-y-4">
                      <div className="rounded-2xl border border-sky-300 bg-sky-50/70 p-6 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <span className="font-bold text-sky-950 text-base">
                            Đã gửi yêu cầu gia hạn {latestRenewal.termMonths} tháng
                          </span>
                          <span className="cx-badge warning">Chờ quản lý duyệt</span>
                        </div>
                        <p className="text-xs text-sky-900 m-0 leading-relaxed">
                          Yêu cầu được gửi lúc <b>{toVNTime(latestRenewal.createdAt, true)}</b>. Ở bước này{" "}
                          <b>chưa có hợp đồng mới</b>: ban quản lý sẽ duyệt yêu cầu trước, sau đó mới soạn và gửi
                          hợp đồng để bạn ký.
                        </p>
                        <p className="text-xs text-sky-900 m-0 leading-relaxed">
                          Thời hạn dự kiến: <b>{fmtDate(latestRenewal.startDate)}</b> đến{" "}
                          <b>{fmtDate(latestRenewal.endDate)}</b> ({latestRenewal.termMonths} tháng).
                        </p>
                        {latestRenewal.note && (
                          <p className="text-xs text-sky-900 m-0">Ghi chú của bạn: {latestRenewal.note}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        className="cx-btn ghost !h-10 text-xs font-semibold"
                        disabled={renewalBusy}
                        onClick={handleCancelRenewal}
                      >
                        Hủy yêu cầu gia hạn
                      </button>
                    </div>
                  ) : latestRenewal && latestRenewal.status === "APPROVED" && !showRenewalForm ? (
                    <div className="mt-6 space-y-6">
                      {renewalCompleted ? (
                        <div className="rounded-2xl border border-emerald-300 bg-emerald-50/80 p-6 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-emerald-950 text-base">
                              Hợp đồng gia hạn đã có hiệu lực thành công!
                            </span>
                            <span className="cx-badge success">Hoàn tất</span>
                          </div>
                          <p className="text-xs text-emerald-900 m-0 leading-relaxed">
                            Hợp đồng mới #{renewalContract?.id ?? latestRenewal.renewalContractId} có hiệu lực từ
                            ngày <b>{fmtDate(renewalContract?.startDate ?? latestRenewal.startDate)}</b> đến ngày{" "}
                            <b>{fmtDate(renewalContract?.endDate ?? latestRenewal.endDate)}</b>.
                          </p>
                        </div>
                      ) : renewalSignature === "AWAITING_TENANT" ? (
                        <div className="space-y-6">
                          <div className="rounded-2xl border-2 border-emerald-400 bg-emerald-50 p-6 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-emerald-950 text-base">
                                Yêu cầu gia hạn đã được duyệt! Hợp đồng mới đã sẵn sàng ký
                              </span>
                              <span className="cx-badge success">Chờ bạn ký</span>
                            </div>
                            <p className="text-xs text-emerald-800 m-0 leading-relaxed">
                              Ban quản lý đã duyệt yêu cầu gia hạn <b>{latestRenewal.termMonths} tháng</b>.
                              Hạn ký điện tử:{" "}
                              <b>{renewalContract?.signatureDeadline ? toVNTime(renewalContract.signatureDeadline, true) : "—"}</b> (trong vòng 2 ngày / 48 giờ).
                            </p>
                          </div>

                          {renewalDetail ? (
                            <div className="rounded-3xl border border-teal-300 bg-white p-6 md:p-8 shadow-md">
                              <h3 className="text-lg font-bold text-teal-900 mb-4">Ký hợp đồng gia hạn điện tử</h3>
                              <CustomerSignatureCard
                                contract={renewalDetail}
                                toast={showToast}
                                onChanged={loadData}
                              />
                            </div>
                          ) : (
                            <div className="text-center py-8 text-xs text-muted">
                              Đang tải nội dung hợp đồng gia hạn để ký…
                            </div>
                          )}
                        </div>
                      ) : renewalSignature === "AWAITING_LESSOR" ? (
                        <div className="rounded-2xl border border-indigo-300 bg-indigo-50/70 p-6 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-indigo-950 text-base">
                              Bạn đã ký số thành công hợp đồng gia hạn
                            </span>
                            <span className="cx-badge info">Chờ Chủ nhà ký</span>
                          </div>
                          <p className="text-xs text-indigo-900 m-0 leading-relaxed">
                            Hợp đồng đang chờ Bên cho thuê (Chủ nhà / Quản lý) ký số để chính thức hoàn tất.
                          </p>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-sky-300 bg-sky-50/70 p-6 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <span className="font-bold text-sky-950 text-base">Yêu cầu gia hạn đã được duyệt</span>
                            <span className="cx-badge info">
                              {renewalContract ? "Đang soạn hợp đồng" : "Chờ gửi hợp đồng"}
                            </span>
                          </div>
                          <p className="text-xs text-sky-900 m-0 leading-relaxed">
                            {renewalContract
                              ? "Ban quản lý đang soạn hợp đồng mới với đầy đủ điều khoản (có thể điều chỉnh giá thuê, tiền cọc, điện nước). Hợp đồng sẽ xuất hiện ở đây để bạn ký ngay khi được gửi."
                              : "Yêu cầu đã được duyệt – đang chờ bên cho thuê gửi hợp đồng để ký."}
                          </p>
                          <p className="text-xs text-sky-900 m-0 leading-relaxed">
                            Thời hạn dự kiến: <b>{fmtDate(latestRenewal.startDate)}</b> đến{" "}
                            <b>{fmtDate(latestRenewal.endDate)}</b> ({latestRenewal.termMonths} tháng).
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-6 space-y-4">
                      {(latestRenewal?.status === "REJECTED" ||
                        latestRenewal?.status === "CANCELLED" ||
                        renewalAbandoned) && (
                        <div className="rounded-2xl border border-rose-300 bg-rose-50/70 p-5 space-y-2 text-xs text-rose-950">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-rose-900 text-sm">
                              {latestRenewal?.status === "CANCELLED"
                                ? "Bạn đã hủy yêu cầu gia hạn trước đó"
                                : renewalAbandoned
                                  ? "Hợp đồng gia hạn trước đó đã không được ký"
                                  : "Yêu cầu gia hạn bị từ chối"}
                            </span>
                            <span className="cx-badge danger">
                              {latestRenewal?.status === "CANCELLED" ? "Đã hủy" : "Từ chối"}
                            </span>
                          </div>
                          {latestRenewal?.rejectReason && (
                            <p className="m-0 leading-relaxed">
                              Lý do từ ban quản lý: <b>{latestRenewal.rejectReason}</b>
                            </p>
                          )}
                          <p className="m-0 leading-relaxed">
                            Bạn có thể gửi lại yêu cầu gia hạn mới bên dưới.
                          </p>
                        </div>
                      )}
                      {!isEligibleWindow ? (
                        <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-xs text-amber-950 space-y-2">
                          <div className="flex items-center gap-2 font-bold text-amber-900 text-sm">
                            <Icon name="clock" size={18} /> Chưa đến thời hạn gia hạn hợp đồng
                          </div>
                          <p className="m-0 leading-relaxed text-amber-900">
                            Hợp đồng phòng của bạn có hiệu lực đến ngày <b>{fmtDate(activeContract.endDate)}</b> (còn {remainingDays} ngày).
                            Theo quy định hệ thống, chức năng gia hạn hợp đồng chỉ mở trước ngày hết hạn tối đa <b>30 ngày</b> (bắt đầu mở từ ngày <b>{fmtDate(earliestEligibleDate)}</b>).
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className="rounded-xl border border-teal-200 bg-teal-50/80 p-4 text-xs text-teal-950">
                            <div className="font-bold text-teal-950 mb-1">
                              Quy định gia hạn hợp đồng chuẩn: 1 năm (12 tháng)
                            </div>
                            <p className="m-0 leading-relaxed text-teal-800">
                              Hợp đồng phòng mới sẽ tiếp nối từ ngày <b>{fmtDate(activeContract.endDate ? nextDay(activeContract.endDate) : null)}</b> đến ngày <b>{fmtDate(activeContract.endDate ? plusMonths(nextDay(activeContract.endDate), 12) : null)}</b> (12 tháng). Tiền đặt cọc được giữ nguyên giá trị sang hợp đồng mới và ban quản lý có thể điều chỉnh lại khi soạn hợp đồng.
                            </p>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="cx-chip on !cursor-default font-bold !text-teal-900 !border-teal-400">
                              <Icon name="check" size={14} /> Gia hạn thêm 1 năm (12 tháng)
                            </div>
                          </div>

                          <button
                            type="button"
                            className="cx-btn primary !h-10 text-xs font-semibold"
                            disabled={renewalBusy}
                            onClick={handleRequestRenewal}
                          >
                            {renewalBusy ? "Đang gửi yêu cầu gia hạn…" : "Gửi yêu cầu gia hạn 1 năm (12 tháng)"}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </section>
    </>
  );
}
