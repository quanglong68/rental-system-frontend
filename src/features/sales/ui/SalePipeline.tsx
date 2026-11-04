import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { type Id, sameId, idStr } from "@/shared/lib/id";
import {
  PageHead,
  Tabs,
  MiniStat,
  Pill,
  Icon,
  vnd,
  toVNTime,
  todayVN,
  SignaturePad,
  Field,
} from "@/shared/ui";
import {
  bookingApi,
  type RentalRequest,
  type Appointment,
} from "@/api/booking";
import {
  contractsApi,
  type Contract,
  type MoveOutRequest,
  type MoveOutStatus,
  type RenewalRequest,
} from "@/features/contracts/api/contractsApi";
import { useAuth } from "@/features/auth";
import { useBuildingLookup, useCustomerLookup, useRoomLookup } from "@/shared/lib/refLabels";
import { errorText } from "@/shared/api/errors";
import ChatStartButton from "@/features/chat/ui/ChatStartButton";
import RequestDossierModal from "./RequestDossierModal";

const TAB_REQUESTS = "Yêu cầu thuê phòng";
const TAB_APPOINTMENTS = "Lịch xem phòng";
const TAB_MOVE_OUTS = "Yêu cầu trả phòng";
const TAB_RENEWALS = "Yêu cầu gia hạn hợp đồng";

const errText = (e: unknown) => errorText(e);

const statusLabel: Record<string, string> = {
  SCHEDULED: "Đã đặt lịch",
  CONFIRMED: "Đã xác nhận",
  VIEWED: "Đã xem phòng",
  CANCELLED: "Đã hủy",
};

const moveOutLabel: Record<MoveOutStatus, string> = {
  PENDING: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Từ chối",
  COMPLETED: "Đã hoàn tất",
};

const newestFirst = <T,>(items: T[], getTime: (item: T) => string | null | undefined) =>
  [...items].sort((a, b) => {
    const ta = Date.parse(getTime(a) ?? "") || 0;
    const tb = Date.parse(getTime(b) ?? "") || 0;
    return tb - ta;
  });

const fmtDate = (iso?: string | null) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
};

type RequestFilter = "all" | "open" | "done" | "closed";
type AppointmentFilter = "all" | "open" | "done" | "cancelled";
type MoveOutFilter = "all" | "PENDING" | "APPROVED" | "COMPLETED" | "REJECTED";
type RenewalFilter = "all" | "PENDING" | "APPROVED" | "AWAITING_TENANT" | "AWAITING_LESSOR" | "COMPLETED" | "CLOSED";

const requestFilters: { key: RequestFilter; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "open", label: "Chưa xử lý" },
  { key: "done", label: "Đã xử lý" },
  { key: "closed", label: "Đã hủy / Từ chối" },
];

const appointmentFilters: { key: AppointmentFilter; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "open", label: "Chưa xong" },
  { key: "done", label: "Đã xem" },
  { key: "cancelled", label: "Đã hủy" },
];

const moveOutFilters: { key: MoveOutFilter; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "PENDING", label: "Chờ duyệt" },
  { key: "APPROVED", label: "Đã duyệt (Chờ trả cọc)" },
  { key: "COMPLETED", label: "Đã hoàn cọc" },
  { key: "REJECTED", label: "Từ chối" },
];

const renewalFilters: { key: RenewalFilter; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "PENDING", label: "Chờ duyệt" },
  { key: "APPROVED", label: "Đã duyệt · Chờ soạn/gửi HĐ" },
  { key: "AWAITING_TENANT", label: "Chờ khách ký số" },
  { key: "AWAITING_LESSOR", label: "Khách đã ký · Chờ chủ nhà ký" },
  { key: "COMPLETED", label: "Đã hoàn tất gia hạn" },
  { key: "CLOSED", label: "Từ chối / Hủy" },
];

function FilterBar<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onChange(item.key)}
          className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
            value === item.key
              ? "border-teal-600 bg-teal-600 text-white"
              : "border-line bg-white text-muted hover:border-teal-400 hover:text-text"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export default function SalePipeline() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canVerify = user?.role === "SALE" || user?.role === "QUAN_LY" || user?.role === "ADMIN";
  // Duyệt hồ sơ / tạo hợp đồng nháp là quyền của Quản lý hoặc Admin, Sale chỉ xác minh.
  const canDecide = user?.role === "QUAN_LY" || user?.role === "ADMIN";
  const canManageTenancy = canDecide;

  const [activeTab, setActiveTab] = useState(TAB_REQUESTS);
  const [requestFilter, setRequestFilter] = useState<RequestFilter>("all");
  const [appointmentFilter, setAppointmentFilter] = useState<AppointmentFilter>("all");
  const [moveOutFilter, setMoveOutFilter] = useState<MoveOutFilter>("all");
  const [renewalFilter, setRenewalFilter] = useState<RenewalFilter>("all");

  const [requests, setRequests] = useState<RentalRequest[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [moveOuts, setMoveOuts] = useState<MoveOutRequest[]>([]);
  const [contractsList, setContractsList] = useState<Contract[]>([]);
  const [renewalRequests, setRenewalRequests] = useState<RenewalRequest[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);

  // Dossier modal state
  const [dossierFor, setDossierFor] = useState<RentalRequest | null>(null);

  // Reject rental request modal state
  const [rejectId, setRejectId] = useState<Id | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Reject move-out request modal state
  const [rejectMoveOutId, setRejectMoveOutId] = useState<Id | null>(null);
  const [rejectMoveOutReason, setRejectMoveOutReason] = useState("");

  // Move-out settlement modal state
  const [settleMoveOutTarget, setSettleMoveOutTarget] = useState<MoveOutRequest | null>(null);
  const [settleDeposit, setSettleDeposit] = useState(0);
  const [settleRefund, setSettleRefund] = useState("");
  const [settleDeduction, setSettleDeduction] = useState("0");
  const [settleReason, setSettleReason] = useState("");
  const [settleReceipt, setSettleReceipt] = useState<File | null>(null);

  // Reject renewal request modal state
  const [rejectRenewalTarget, setRejectRenewalTarget] = useState<RenewalRequest | null>(null);
  const [rejectRenewalReason, setRejectRenewalReason] = useState("");

  // Lessor signing modal state
  const [signingContract, setSigningContract] = useState<Contract | null>(null);
  const [signPassword, setSignPassword] = useState("");
  const [signFile, setSignFile] = useState<File | null>(null);
  const [signAccepted, setSignAccepted] = useState(false);

  const [actionLoading, setActionLoading] = useState(false);

  // All IDs for lookups
  const allRoomIds = useMemo(() => [
    ...requests.map((r) => r.roomId),
    ...appointments.map((a) => a.roomId),
    ...contractsList.map((c) => c.roomId),
  ], [requests, appointments, contractsList]);

  const allBuildingIds = useMemo(() => [
    ...requests.map((r) => r.buildingId),
    ...appointments.map((a) => a.buildingId),
    ...contractsList.map((c) => c.buildingId),
  ], [requests, appointments, contractsList]);

  const allCustomerIds = useMemo(() => [
    ...requests.map((r) => r.customerId),
    ...appointments.map((a) => a.customerId),
    ...moveOuts.map((m) => m.requestedBy),
    ...contractsList.map((c) => c.customerId),
  ], [requests, appointments, moveOuts, contractsList]);

  const roomOf = useRoomLookup(allRoomIds);
  const buildingOf = useBuildingLookup(allBuildingIds);
  const customerOf = useCustomerLookup(allCustomerIds);

  const loadData = async () => {
    setLoading(true);
    setLoadError("");
    const [reqRes, apptRes, cRes] = await Promise.allSettled([
      bookingApi.manageRentalRequests({ size: 100 }),
      bookingApi.searchAppointments({ size: 100 }),
      contractsApi.list({ size: 100 }),
    ]);
    const tenancyResults = canManageTenancy
      ? await Promise.allSettled([
          contractsApi.moveOuts({ size: 100 }),
          contractsApi.renewalRequests({ size: 100 }),
        ])
      : null;
    const moRes = tenancyResults?.[0];
    const renewalRes = tenancyResults?.[1];

    const problems: string[] = [];

    if (reqRes.status === "fulfilled") {
      setRequests(newestFirst(reqRes.value?.content ?? [], (r) => r.requestedAt));
    } else {
      problems.push(`yêu cầu thuê: ${errText(reqRes.reason)}`);
    }

    if (apptRes.status === "fulfilled") {
      setAppointments(newestFirst(apptRes.value?.content ?? [], (a) => a.createdAt));
    } else {
      problems.push(`lịch xem phòng: ${errText(apptRes.reason)}`);
    }

    if (moRes?.status === "fulfilled") {
      setMoveOuts(newestFirst(moRes.value?.content ?? [], (m) => m.createdAt));
    } else if (moRes) {
      problems.push(`yêu cầu trả phòng: ${errText(moRes.reason)}`);
    }

    if (cRes.status === "fulfilled") {
      setContractsList(cRes.value?.content ?? []);
    } else {
      problems.push(`danh sách hợp đồng: ${errText(cRes.reason)}`);
    }

    if (renewalRes?.status === "fulfilled") {
      setRenewalRequests(newestFirst(renewalRes.value?.content ?? [], (r) => r.createdAt));
    } else if (renewalRes) {
      problems.push(`yêu cầu gia hạn: ${errText(renewalRes.reason)}`);
    }

    setLoadError(problems.length > 0 ? `Không tải được ${problems.join(" · ")}` : "");
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  const showToast = (text: string, error = false) => {
    setMsg({ text, error });
    window.setTimeout(() => setMsg(null), 4000);
  };

  const markRequestRead = async (request: RentalRequest) => {
    if (request.readAt) return;
    try {
      await bookingApi.markRentalRequestRead(request.id);
      setRequests((prev) => prev.map((r) => (r.id === request.id ? { ...r, readAt: new Date().toISOString() } : r)));
    } catch {
      // Ignored
    }
  };

  const markAppointmentRead = async (appointment: Appointment) => {
    if (appointment.readAt) return;
    try {
      await bookingApi.markAppointmentRead(appointment.id);
      setAppointments((prev) =>
        prev.map((a) => (a.id === appointment.id ? { ...a, readAt: new Date().toISOString() } : a)),
      );
    } catch {
      // Ignored
    }
  };

  const handleVerifyRequest = async (request: RentalRequest) => {
    setActionLoading(true);
    try {
      await bookingApi.verifyRentalRequest(request.id);
      showToast("Đã xác minh hồ sơ thành công.");
      await loadData();
    } catch (err) {
      showToast(errText(err), true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptRequest = async (id: Id) => {
    setActionLoading(true);
    try {
      await bookingApi.acceptRentalRequest(id);
      showToast("Đã duyệt yêu cầu. Hệ thống đã tạo hợp đồng nháp và mở ký điện tử (hạn 48 giờ)!");
      await loadData();
    } catch (err) {
      showToast(errText(err), true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectRequest = async () => {
    if (!rejectId || !rejectReason.trim()) {
      showToast("Vui lòng nhập lý do từ chối", true);
      return;
    }
    setActionLoading(true);
    try {
      await bookingApi.rejectRentalRequest(rejectId, rejectReason.trim());
      showToast("Đã từ chối yêu cầu thuê phòng.");
      setRejectId(null);
      setRejectReason("");
      await loadData();
    } catch (err) {
      showToast(errText(err), true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateAppt = async (id: Id, status: "CONFIRMED" | "VIEWED" | "CANCELLED") => {
    setActionLoading(true);
    try {
      await bookingApi.updateAppointmentStatus(id, status);
      showToast(`Đã cập nhật lịch hẹn: ${statusLabel[status] ?? status}`);
      await loadData();
    } catch (err) {
      showToast(errText(err), true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveMoveOut = async (mo: MoveOutRequest) => {
    setActionLoading(true);
    try {
      await contractsApi.approveMoveOut(mo.id);
      showToast("Đã duyệt trả phòng. Phòng chuyển Sắp trống; tiếp theo bấm “Quyết toán hoàn cọc”.");
      await loadData();
    } catch (err) {
      showToast(errText(err), true);
    } finally {
      setActionLoading(false);
    }
  };

  const openSettleMoveOut = async (mo: MoveOutRequest) => {
    let deposit = contractsList.find((c) => idStr(c.id) === idStr(mo.contractId))?.depositAmount ?? 0;
    if (deposit === 0) {
      try {
        deposit = (await contractsApi.detail(mo.contractId)).depositAmount ?? 0;
      } catch {
        deposit = 0;
      }
    }
    setSettleMoveOutTarget(mo);
    setSettleDeposit(deposit);
    setSettleRefund(String(deposit));
    setSettleDeduction("0");
    setSettleReason("");
    setSettleReceipt(null);
  };

  const handleSettleMoveOut = async () => {
    if (!settleMoveOutTarget) return;
    const refund = Number(settleRefund);
    const deduction = Number(settleDeduction || "0");
    if (!Number.isFinite(refund) || refund < 0 || !Number.isFinite(deduction) || deduction < 0) {
      showToast("Số tiền hoàn và số tiền khấu trừ phải là số không âm.", true);
      return;
    }
    if (deduction > 0 && !settleReason.trim()) {
      showToast("Vui lòng nhập lý do khấu trừ tiền cọc.", true);
      return;
    }
    setActionLoading(true);
    try {
      if (settleReceipt) {
        await contractsApi.uploadMoveOutRefundReceipt(settleMoveOutTarget.id, settleReceipt);
      }
      await contractsApi.settleMoveOutRefund(settleMoveOutTarget.id, {
        refundAmount: refund,
        deductionAmount: deduction,
        deductionReason: settleReason.trim() || undefined,
        refundStatus: "REFUNDED",
      });
      showToast(`Đã quyết toán hoàn cọc ${vnd(refund)} cho phòng đã trả.`);
      setSettleMoveOutTarget(null);
      await loadData();
    } catch (err) {
      showToast(errText(err), true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectMoveOut = async () => {
    if (!rejectMoveOutId || !rejectMoveOutReason.trim()) {
      showToast("Vui lòng nhập lý do từ chối trả phòng", true);
      return;
    }
    setActionLoading(true);
    try {
      await contractsApi.rejectMoveOut(rejectMoveOutId, rejectMoveOutReason.trim());
      showToast("Đã từ chối yêu cầu trả phòng.");
      setRejectMoveOutId(null);
      setRejectMoveOutReason("");
      await loadData();
    } catch (err) {
      showToast(errText(err), true);
    } finally {
      setActionLoading(false);
    }
  };

  // Renewal actions: request PENDING -> duyệt -> soạn hợp đồng -> gửi khách ký -> chủ nhà ký
  const handleApproveRenewal = async (request: RenewalRequest) => {
    setActionLoading(true);
    try {
      await contractsApi.approveRenewalRequest(request.id);
      showToast("Đã duyệt yêu cầu gia hạn. Bấm “Soạn hợp đồng” để tạo bản nháp có thể chỉnh sửa.");
      await loadData();
    } catch (err) {
      showToast(errText(err), true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectRenewal = async () => {
    if (!rejectRenewalTarget || !rejectRenewalReason.trim()) {
      showToast("Vui lòng nhập lý do từ chối", true);
      return;
    }
    setActionLoading(true);
    try {
      await contractsApi.rejectRenewalRequest(rejectRenewalTarget.id, rejectRenewalReason.trim());
      showToast("Đã từ chối yêu cầu gia hạn.");
      setRejectRenewalTarget(null);
      setRejectRenewalReason("");
      await loadData();
    } catch (err) {
      showToast(errText(err), true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateRenewalDraft = async (request: RenewalRequest) => {
    setActionLoading(true);
    try {
      const draft = await contractsApi.createRenewalDraft(request.id);
      showToast(`Đã tạo hợp đồng nháp #${draft.id}. Kiểm tra, chỉnh sửa đầy đủ thông tin rồi gửi khách ký.`);
      navigate(`/admin/contracts?contractId=${idStr(draft.id)}`);
    } catch (err) {
      showToast(errText(err), true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendRenewalDraft = async (contractId: Id) => {
    setActionLoading(true);
    try {
      await contractsApi.sendRenewalDraft(contractId);
      showToast("Đã gửi hợp đồng cho khách ký điện tử (hạn 48 giờ).");
      await loadData();
    } catch (err) {
      showToast(errText(err), true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleLessorSign = async () => {
    if (!signingContract) return;
    if (!signPassword.trim()) {
      showToast("Vui lòng nhập mật khẩu tài khoản để ký", true);
      return;
    }
    if (!signFile) {
      showToast("Vui lòng vẽ chữ ký bằng chuột hoặc tải ảnh chữ ký", true);
      return;
    }
    if (!signAccepted) {
      showToast("Vui lòng tích xác nhận đồng ý với điều khoản hợp đồng", true);
      return;
    }

    setActionLoading(true);
    try {
      const { key } = await contractsApi.uploadSignatureImage(signingContract.id, signFile);
      await contractsApi.signElectronic(signingContract.id, {
        password: signPassword,
        signatureImageKey: key,
        acceptedTerms: true,
        consentVersion: "v1",
      });
      showToast(`Đã ký hợp đồng gia hạn thành công! Hợp đồng mới #${signingContract.id} đã chính thức có hiệu lực.`);
      setSigningContract(null);
      setSignPassword("");
      setSignFile(null);
      setSignAccepted(false);
      await loadData();
    } catch (err) {
      showToast(errText(err), true);
    } finally {
      setActionLoading(false);
    }
  };

  const openContractPdf = async (contractId: Id) => {
    try {
      const blob = await contractsApi.documentBlob(contractId);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      showToast("Không thể mở văn bản hợp đồng PDF: " + errText(err), true);
    }
  };

  // Renewal requests + the draft contract once "Soạn hợp đồng" has run.
  const linkedContractOf = (request: RenewalRequest) =>
    request.renewalContractId
      ? contractsList.find((c) => sameId(c.id, request.renewalContractId)) ?? null
      : null;

  const renewalStage = (request: RenewalRequest): Exclude<RenewalFilter, "all"> => {
    if (request.status === "PENDING") return "PENDING";
    if (request.status === "REJECTED" || request.status === "CANCELLED") return "CLOSED";
    const contract = linkedContractOf(request);
    const signature = contract?.signatureStatus ?? request.renewalSignatureStatus;
    if (contract?.status === "ACTIVE" || signature === "COMPLETED" || request.renewalContractStatus === "ACTIVE") {
      return "COMPLETED";
    }
    if (signature === "DECLINED" || signature === "EXPIRED") return "CLOSED";
    if (signature === "AWAITING_TENANT") return "AWAITING_TENANT";
    if (signature === "AWAITING_LESSOR") return "AWAITING_LESSOR";
    return "APPROVED";
  };

  // Counts for Stats & Badges
  const pendingReqsCount = requests.filter((r) => r.status === "PENDING").length;
  const scheduledApptsCount = appointments.filter((a) => a.status === "SCHEDULED" || a.status === "CONFIRMED").length;
  const pendingMoveOutsCount = moveOuts.filter((m) => m.status === "PENDING").length;
  const pendingRenewalsCount = renewalRequests.filter((r) =>
    ["PENDING", "APPROVED", "AWAITING_LESSOR"].includes(renewalStage(r)),
  ).length;

  // Filtered lists
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

  const filteredMoveOuts = moveOuts.filter((m) => {
    if (moveOutFilter === "all") return true;
    return m.status === moveOutFilter;
  });

  const filteredRenewals = renewalRequests.filter((r) => {
    if (renewalFilter === "all") return true;
    return renewalStage(r) === renewalFilter;
  });

  const getStatusPill = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Pill tone="amber">Chờ xác minh</Pill>;
      case "VERIFIED":
        return <Pill tone="sky">Đã xác minh · chờ duyệt</Pill>;
      case "ACCEPTED":
        return <Pill tone="teal">Đã duyệt · chờ ký</Pill>;
      case "SCHEDULED":
        return <Pill tone="amber">Chờ xác nhận lịch</Pill>;
      case "CONFIRMED":
        return <Pill tone="teal">Đã xác nhận lịch</Pill>;
      case "VIEWED":
        return <Pill tone="sky">Đã xem phòng</Pill>;
      case "REJECTED":
        return <Pill tone="coral">Đã từ chối</Pill>;
      case "CANCELLED":
        return <Pill tone="slate">Đã hủy</Pill>;
      default:
        return <Pill tone="slate">{status}</Pill>;
    }
  };

  const getRenewalStatusPill = (stage: Exclude<RenewalFilter, "all">, request: RenewalRequest) => {
    switch (stage) {
      case "PENDING":
        return <Pill tone="violet">Khách đã gửi · Chờ duyệt</Pill>;
      case "APPROVED":
        return <Pill tone="sky">Đã duyệt · Chưa gửi khách ký</Pill>;
      case "AWAITING_TENANT":
        return <Pill tone="amber">Đã gửi bản ký · Chờ khách ký (48h)</Pill>;
      case "AWAITING_LESSOR":
        return <Pill tone="sky">Khách đã ký · Chờ chủ nhà ký</Pill>;
      case "COMPLETED":
        return <Pill tone="teal">Đã hoàn tất · Đang hiệu lực</Pill>;
      case "CLOSED":
        return request.status === "CANCELLED"
          ? <Pill tone="slate">Khách đã hủy yêu cầu</Pill>
          : <Pill tone="coral">Đã từ chối / Không ký</Pill>;
      default:
        return <Pill tone="slate">{stage}</Pill>;
    }
  };

  return (
    <>
      <PageHead
        eyebrow={`${user?.role ?? "SALE"} · Trung tâm xử lý yêu cầu`}
        title="Quản lý yêu cầu &amp; Đề nghị từ khách thuê"
        desc={
          canManageTenancy
            ? "Trung tâm tập trung toàn bộ yêu cầu thuê phòng, lịch xem phòng, yêu cầu trả phòng và yêu cầu gia hạn hợp đồng. Mọi thông tin hiển thị rõ ràng ngày giờ và tự động làm mới tức thì."
            : "Tiếp nhận yêu cầu thuê phòng và lịch xem phòng. Sale xác minh hồ sơ CCCD; việc duyệt hồ sơ và tạo hợp đồng nháp do Quản lý tòa nhà thực hiện."
        }
      />

      {msg && (
        <div
          className={`mb-6 rounded-xl border p-4 text-sm font-medium ${
            msg.error
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {msg.text}
        </div>
      )}

      {loadError && (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <span>{loadError}</span>
          <button className="btn-outline !py-1 text-xs" onClick={() => void loadData()}>
            Thử lại
          </button>
        </div>
      )}

      {/* Thông báo nổi bật nếu có yêu cầu trả phòng hoặc gia hạn đang chờ */}
      {canManageTenancy && (pendingMoveOutsCount > 0 || pendingRenewalsCount > 0) && (
        <div className="mb-6 rounded-2xl border-2 border-amber-300 bg-amber-50/90 p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-800 shrink-0">
              <Icon name="clock" size={20} />
            </span>
            <div>
              <h4 className="m-0 font-bold text-amber-950 text-sm">
                Có yêu cầu mới cần xử lý từ khách thuê!
              </h4>
              <p className="m-0 text-xs text-amber-800 mt-0.5">
                {pendingMoveOutsCount > 0 && (
                  <span className="mr-3 font-semibold">
                    • <b>{pendingMoveOutsCount}</b> yêu cầu trả phòng chờ duyệt
                  </span>
                )}
                {pendingRenewalsCount > 0 && (
                  <span className="font-semibold">
                    • <b>{pendingRenewalsCount}</b> yêu cầu gia hạn hợp đồng chờ duyệt / ký
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {pendingMoveOutsCount > 0 && (
              <button
                type="button"
                className="h-8 px-3 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 shadow-xs"
                onClick={() => setActiveTab(TAB_MOVE_OUTS)}
              >
                Xem trả phòng ({pendingMoveOutsCount})
              </button>
            )}
            {pendingRenewalsCount > 0 && (
              <button
                type="button"
                className="h-8 px-3 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 shadow-xs"
                onClick={() => setActiveTab(TAB_RENEWALS)}
              >
                Xem gia hạn ({pendingRenewalsCount})
              </button>
            )}
          </div>
        </div>
      )}

      {/* MiniStats tổng hợp */}
      <div className={`mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 ${canManageTenancy ? "lg:grid-cols-4" : ""}`}>
        <div className="cursor-pointer transition hover:-translate-y-0.5" onClick={() => setActiveTab(TAB_REQUESTS)}>
          <MiniStat
            label="Yêu cầu thuê phòng"
            value={String(requests.length)}
            note={pendingReqsCount > 0 ? `${pendingReqsCount} yêu cầu chưa xử lý` : "Tất cả đã xử lý"}
            tone={pendingReqsCount > 0 ? "amber" : "teal"}
          />
        </div>
        <div className="cursor-pointer transition hover:-translate-y-0.5" onClick={() => setActiveTab(TAB_APPOINTMENTS)}>
          <MiniStat
            label="Lịch xem phòng"
            value={String(appointments.length)}
            note={scheduledApptsCount > 0 ? `${scheduledApptsCount} lịch sắp tới` : "Không có lịch mới"}
            tone={scheduledApptsCount > 0 ? "sky" : "teal"}
          />
        </div>
        {canManageTenancy && (
          <>
            <div className="cursor-pointer transition hover:-translate-y-0.5" onClick={() => setActiveTab(TAB_MOVE_OUTS)}>
              <MiniStat
                label="Yêu cầu trả phòng"
                value={String(moveOuts.length)}
                note={pendingMoveOutsCount > 0 ? `${pendingMoveOutsCount} yêu cầu chờ duyệt` : "Đã hoàn tất duyệt"}
                tone={pendingMoveOutsCount > 0 ? "coral" : "teal"}
              />
            </div>
            <div className="cursor-pointer transition hover:-translate-y-0.5" onClick={() => setActiveTab(TAB_RENEWALS)}>
              <MiniStat
                label="Yêu cầu gia hạn (1 năm)"
                value={String(renewalRequests.length)}
                note={pendingRenewalsCount > 0 ? `${pendingRenewalsCount} yêu cầu chờ duyệt/ký` : "Tất cả đã xử lý"}
                tone={pendingRenewalsCount > 0 ? "violet" : "teal"}
              />
            </div>
          </>
        )}
      </div>

      {/* 4 Tabs Điều Hướng Cấp Cao */}
      <div className="mb-6 flex flex-wrap gap-2.5 border-b border-line pb-3">
        <button
          type="button"
          className={`cx-chip ${activeTab === TAB_REQUESTS ? "on font-bold !bg-teal-700 !text-white !border-teal-700" : ""}`}
          onClick={() => setActiveTab(TAB_REQUESTS)}
        >
          <Icon name="home" size={15} /> 1. Yêu cầu thuê phòng ({requests.length})
          {pendingReqsCount > 0 && (
            <span className="ml-1.5 rounded-full bg-amber-400 text-slate-900 px-1.5 py-0.2 text-[10px] font-bold">
              {pendingReqsCount}
            </span>
          )}
        </button>

        <button
          type="button"
          className={`cx-chip ${activeTab === TAB_APPOINTMENTS ? "on font-bold !bg-teal-700 !text-white !border-teal-700" : ""}`}
          onClick={() => setActiveTab(TAB_APPOINTMENTS)}
        >
          <Icon name="calendar" size={15} /> 2. Lịch xem phòng ({appointments.length})
          {scheduledApptsCount > 0 && (
            <span className="ml-1.5 rounded-full bg-sky-400 text-slate-900 px-1.5 py-0.2 text-[10px] font-bold">
              {scheduledApptsCount}
            </span>
          )}
        </button>

        {canManageTenancy && (
          <>
            <button
              type="button"
              className={`cx-chip ${activeTab === TAB_MOVE_OUTS ? "on font-bold !bg-rose-700 !text-white !border-rose-700" : "text-rose-700 border-rose-300"}`}
              onClick={() => setActiveTab(TAB_MOVE_OUTS)}
            >
              <Icon name="contract" size={15} /> 3. Yêu cầu trả phòng ({moveOuts.length})
              {pendingMoveOutsCount > 0 && (
                <span className="ml-1.5 rounded-full bg-rose-500 text-white px-1.5 py-0.2 text-[10px] font-bold animate-pulse">
                  {pendingMoveOutsCount} chờ duyệt
                </span>
              )}
            </button>

            <button
              type="button"
              className={`cx-chip ${activeTab === TAB_RENEWALS ? "on font-bold !bg-indigo-700 !text-white !border-indigo-700" : "text-indigo-800 border-indigo-300"}`}
              onClick={() => setActiveTab(TAB_RENEWALS)}
            >
              <Icon name="contract" size={15} /> 4. Yêu cầu gia hạn hợp đồng ({renewalRequests.length})
              {pendingRenewalsCount > 0 && (
                <span className="ml-1.5 rounded-full bg-amber-400 text-slate-900 px-1.5 py-0.2 text-[10px] font-bold animate-pulse">
                  {pendingRenewalsCount} cần xử lý
                </span>
              )}
            </button>
          </>
        )}
      </div>

      {loading ? (
        <div className="py-20 text-center text-muted">Đang tải dữ liệu yêu cầu…</div>
      ) : activeTab === TAB_REQUESTS ? (
        /* ========================================================================= */
        /* TAB 1: YÊU CẦU THUÊ PHÒNG */
        /* ========================================================================= */
        <>
          <FilterBar items={requestFilters} value={requestFilter} onChange={setRequestFilter} />
          {filteredRequests.length === 0 ? (
            <div className="rounded-2xl border border-line bg-white p-12 text-center">
              <h3 className="text-base font-bold text-text">Chưa có yêu cầu thuê nào</h3>
              <p className="mt-1 text-sm text-muted">Yêu cầu thuê phòng khách gửi từ website sẽ xuất hiện tại đây.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-surface/50 text-xs font-semibold uppercase text-muted">
                  <tr>
                    <th className="px-6 py-4">Mã YC</th>
                    <th className="px-6 py-4">Khách hàng</th>
                    <th className="px-6 py-4">Phòng / Tòa nhà</th>
                    <th className="px-6 py-4">Thời gian gửi &amp; Ngày dọn vào</th>
                    <th className="px-6 py-4">Trạng thái</th>
                    <th className="px-6 py-4">Ghi chú</th>
                    <th className="px-6 py-4 text-right min-w-[340px] w-[340px]">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredRequests.map((r) => (
                    <tr
                      key={r.id}
                      className="cursor-pointer transition-colors hover:bg-slate-50/70"
                      onClick={() => void markRequestRead(r)}
                    >
                      <td className="px-6 py-4 font-bold text-text">
                        <span className="flex items-center gap-2">
                          #{r.id}
                          {!r.readAt && (
                            <span className="inline-block h-2.5 w-2.5 rounded-full bg-sky-500 animate-pulse" title="Chưa đọc" />
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-text">
                        {r.fullName || customerOf(r.customerId) || `Khách #${r.customerId}`}
                        {r.phone && <div className="text-xs text-muted font-normal">{r.phone}</div>}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-text">Phòng {roomOf(r.roomId)?.code ?? `#${r.roomId}`}</span>
                        <div className="text-xs text-muted">Tòa nhà {buildingOf(r.buildingId) ?? `#${r.buildingId}`}</div>
                      </td>
                      <td className="px-6 py-4 text-muted text-xs">
                        <div>Vào: <b className="text-slate-800">{r.moveInDate ? fmtDate(r.moveInDate) : "Thỏa thuận"}</b></div>
                        <div className="text-[11px] text-muted">{r.requestedAt ? toVNTime(r.requestedAt, true) : ""}</div>
                      </td>
                      <td className="px-6 py-4">{getStatusPill(r.status)}</td>
                      <td className="max-w-xs truncate px-6 py-4 text-xs text-muted" title={r.note || r.rejectReason || ""}>
                        {r.rejectReason ? (
                          <span className="font-medium text-rose-600">{r.rejectReason}</span>
                        ) : (
                          r.note || "—"
                        )}
                      </td>
                      <td className="px-6 py-4 text-right min-w-[340px] whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-nowrap items-center justify-end gap-1.5 whitespace-nowrap">
                          {user?.role === "SALE" && (
                            <ChatStartButton
                              contextType="BOOKING"
                              contextId={r.id}
                              label="Nhắn khách"
                              className="h-8 px-3 rounded-lg border border-teal-300 bg-white text-xs font-semibold text-teal-700 shadow-xs hover:bg-teal-50 transition-colors shrink-0"
                            />
                          )}
                          <button
                            type="button"
                            className="h-8 px-3 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 hover:border-slate-400 active:bg-slate-100 transition-colors shrink-0"
                            onClick={() => { void markRequestRead(r); setDossierFor(r); }}
                            title="Xem chi tiết hồ sơ và ảnh CCCD"
                          >
                            Xem hồ sơ
                          </button>
                          {r.status === "PENDING" && canVerify && (
                            <button
                              type="button"
                              className="h-8 px-3 rounded-lg bg-sky-600 text-xs font-semibold text-white shadow-xs hover:bg-sky-700 active:bg-sky-800 transition-colors shrink-0"
                              disabled={actionLoading}
                              onClick={() => void handleVerifyRequest(r)}
                              title="Xác minh tính hợp lệ của hồ sơ CCCD"
                            >
                              Xác minh
                            </button>
                          )}
                          {r.status === "VERIFIED" && canDecide && (
                            <button
                              type="button"
                              className="h-8 px-3 rounded-lg bg-emerald-600 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 active:bg-emerald-800 transition-colors shrink-0"
                              disabled={actionLoading}
                              onClick={() => void handleAcceptRequest(r.id)}
                              title="Duyệt yêu cầu và tạo hợp đồng nháp"
                            >
                              Duyệt
                            </button>
                          )}
                          {(r.status === "PENDING" || r.status === "VERIFIED") && (
                            <button
                              type="button"
                              className="h-8 px-3 rounded-lg border border-rose-300 bg-white text-xs font-semibold text-rose-600 shadow-xs hover:bg-rose-50 hover:border-rose-400 active:bg-rose-100 transition-colors shrink-0"
                              disabled={actionLoading}
                              onClick={() => { void markRequestRead(r); setRejectId(r.id); setRejectReason(""); }}
                              title="Từ chối yêu cầu thuê phòng"
                            >
                              Từ chối
                            </button>
                          )}
                          {(r.status === "REJECTED" || r.status === "CANCELLED") && (
                            <span className="inline-flex items-center h-8 px-2 text-xs text-muted font-medium shrink-0">Đã kết thúc</span>
                          )}
                          {r.status === "ACCEPTED" && (
                            <span className="inline-flex items-center h-8 px-2 text-xs text-emerald-700 font-semibold shrink-0">Đã duyệt · Chờ ký</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : activeTab === TAB_APPOINTMENTS ? (
        /* ========================================================================= */
        /* TAB 2: LỊCH XEM PHÒNG */
        /* ========================================================================= */
        <>
          <FilterBar items={appointmentFilters} value={appointmentFilter} onChange={setAppointmentFilter} />
          {filteredAppointments.length === 0 ? (
            <div className="rounded-2xl border border-line bg-white p-12 text-center">
              <h3 className="text-base font-bold text-text">Chưa có lịch hẹn xem phòng nào</h3>
              <p className="mt-1 text-sm text-muted">Lịch hẹn khách đăng ký xem phòng sẽ được hiển thị tại đây.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-surface/50 text-xs font-semibold uppercase text-muted">
                  <tr>
                    <th className="px-6 py-4">Mã hẹn</th>
                    <th className="px-6 py-4">Khách hàng</th>
                    <th className="px-6 py-4">Phòng / Tòa nhà</th>
                    <th className="px-6 py-4">Thời gian hẹn</th>
                    <th className="px-6 py-4">Trạng thái</th>
                    <th className="px-6 py-4 text-right min-w-[260px] w-[260px]">Cập nhật</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredAppointments.map((a) => {
                    const linkedRequest = a.rentalRequestId
                      ? requests.find((r) => sameId(r.id, a.rentalRequestId))
                      : null;
                    const roomId = a.roomId ?? linkedRequest?.roomId ?? null;
                    const buildingId = a.buildingId ?? linkedRequest?.buildingId ?? null;
                    return (
                    <tr
                      key={a.id}
                      className="cursor-pointer transition-colors hover:bg-slate-50/70"
                      onClick={() => void markAppointmentRead(a)}
                    >
                      <td className="px-6 py-4 font-bold text-text">
                        <span className="flex items-center gap-2">
                          #{a.id}
                          {!a.readAt && (
                            <span className="inline-block h-2.5 w-2.5 rounded-full bg-sky-500 animate-pulse" title="Chưa đọc" />
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-text">{customerOf(a.customerId) ?? `Khách #${a.customerId}`}</td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-text">
                          {roomId ? `Phòng ${roomOf(roomId)?.code ?? `#${roomId}`}` : "Chưa gắn phòng"}
                        </span>
                        <div className="text-xs text-muted">
                          {buildingId ? `Tòa nhà ${buildingOf(buildingId) ?? `#${buildingId}`}` : ""}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 font-semibold text-text">
                        {a.appointmentDate ? toVNTime(a.appointmentDate, true) : "—"}
                      </td>
                      <td className="px-6 py-4">{getStatusPill(a.status)}</td>
                      <td className="px-6 py-4 text-right min-w-[320px] whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-nowrap items-center justify-end gap-1.5 whitespace-nowrap">
                          {user?.role === "SALE" && (
                            <ChatStartButton
                              contextType="VIEWING"
                              contextId={a.id}
                              label="Nhắn khách"
                              className="h-8 px-3 rounded-lg border border-teal-300 bg-white text-xs font-semibold text-teal-700 shadow-xs hover:bg-teal-50 transition-colors shrink-0"
                            />
                          )}
                          {a.status === "SCHEDULED" && (
                            <>
                              <button
                                type="button"
                                className="h-8 px-3 rounded-lg bg-sky-600 text-xs font-semibold text-white shadow-xs hover:bg-sky-700 active:bg-sky-800 transition-colors shrink-0"
                                disabled={actionLoading}
                                onClick={() => handleUpdateAppt(a.id, "CONFIRMED")}
                              >
                                Xác nhận lịch
                              </button>
                              <button
                                type="button"
                                className="h-8 px-3 rounded-lg border border-rose-300 bg-white text-xs font-semibold text-rose-600 shadow-xs hover:bg-rose-50 hover:border-rose-400 active:bg-rose-100 transition-colors shrink-0"
                                disabled={actionLoading}
                                onClick={() => handleUpdateAppt(a.id, "CANCELLED")}
                              >
                                Hủy
                              </button>
                            </>
                          )}
                          {a.status === "CONFIRMED" && (
                            <>
                              <button
                                type="button"
                                className="h-8 px-3 rounded-lg bg-emerald-600 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 active:bg-emerald-800 transition-colors shrink-0"
                                disabled={actionLoading}
                                onClick={() => handleUpdateAppt(a.id, "VIEWED")}
                              >
                                Đã xem xong
                              </button>
                              <button
                                type="button"
                                className="h-8 px-3 rounded-lg border border-rose-300 bg-white text-xs font-semibold text-rose-600 shadow-xs hover:bg-rose-50 hover:border-rose-400 active:bg-rose-100 transition-colors shrink-0"
                                disabled={actionLoading}
                                onClick={() => handleUpdateAppt(a.id, "CANCELLED")}
                              >
                                Hủy
                              </button>
                            </>
                          )}
                          {(a.status === "VIEWED" || a.status === "CANCELLED") && (
                            <span className="inline-flex items-center h-8 px-2 text-xs text-muted font-medium shrink-0">Hoàn tất</span>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : activeTab === TAB_MOVE_OUTS ? (
        /* ========================================================================= */
        /* TAB 3: YÊU CẦU TRẢ PHÒNG */
        /* ========================================================================= */
        <>
          <FilterBar items={moveOutFilters} value={moveOutFilter} onChange={setMoveOutFilter} />
          {filteredMoveOuts.length === 0 ? (
            <div className="rounded-2xl border border-line bg-white p-12 text-center">
              <h3 className="text-base font-bold text-text">Không có yêu cầu trả phòng nào</h3>
              <p className="mt-1 text-sm text-muted">Khi người thuê gửi yêu cầu trả phòng từ trang cá nhân, thông tin sẽ hiển thị tại đây.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-surface/50 text-xs font-semibold uppercase text-muted">
                  <tr>
                    <th className="px-6 py-4">Mã YC</th>
                    <th className="px-6 py-4">Khách hàng</th>
                    <th className="px-6 py-4">Phòng / Tòa nhà &amp; HĐ</th>
                    <th className="px-6 py-4">Thời gian gửi</th>
                    <th className="px-6 py-4">Ngày hẹn trả phòng</th>
                    <th className="px-6 py-4">Lý do</th>
                    <th className="px-6 py-4">Trạng thái</th>
                    <th className="px-6 py-4">Quyết toán cọc</th>
                    <th className="px-6 py-4 text-right min-w-[280px] w-[280px]">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredMoveOuts.map((mo) => {
                    const contract = contractsList.find((c) => idStr(c.id) === idStr(mo.contractId));
                    const deposit = contract?.depositAmount ?? 0;

                    return (
                      <tr key={mo.id} className="transition-colors hover:bg-slate-50/70">
                        <td className="px-6 py-4 font-bold text-text">#{mo.id}</td>
                        <td className="px-6 py-4 font-medium text-text">
                          {customerOf(mo.requestedBy) ?? `Khách #${mo.requestedBy}`}
                          {mo.autoGenerated && (
                            <div className="text-[11px] text-amber-700 font-normal">Hệ thống tự tạo do hết hạn</div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-semibold text-text">
                            Phòng {contract?.roomId ? (roomOf(contract.roomId)?.code ?? `#${contract.roomId}`) : "—"}
                          </span>
                          <div className="text-xs text-muted">
                            {contract?.buildingId ? (buildingOf(contract.buildingId) ?? `Tòa #${contract.buildingId}`) : ""} · HĐ #{mo.contractId}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-700 font-medium">
                          {mo.createdAt ? toVNTime(mo.createdAt, true) : fmtDate(mo.requestDate)}
                        </td>
                        <td className="px-6 py-4 font-bold text-teal-900 text-xs whitespace-nowrap">
                          {fmtDate(mo.expectedMoveOutDate)}
                        </td>
                        <td className="max-w-xs truncate px-6 py-4 text-xs text-muted" title={mo.reason || ""}>
                          {mo.reason || "—"}
                        </td>
                        <td className="px-6 py-4">
                          <Pill tone={mo.status === "APPROVED" ? "teal" : mo.status === "PENDING" ? "amber" : mo.status === "COMPLETED" ? "slate" : "coral"}>
                            {moveOutLabel[mo.status] ?? mo.status}
                          </Pill>
                        </td>
                        <td className="px-6 py-4 text-xs">
                          {mo.refundStatus === "REFUNDED" ? (
                            <div>
                              <b className="text-emerald-700">{vnd(mo.refundAmount ?? deposit)}</b>
                              <div className="text-[10px] text-emerald-600 font-semibold">Đã hoàn cọc 100%</div>
                            </div>
                          ) : mo.refundStatus === "FORFEITED" ? (
                            <span className="text-rose-600 font-semibold">Không hoàn cọc</span>
                          ) : mo.status === "APPROVED" ? (
                            <div>
                              <b className="text-amber-800">{vnd(deposit)}</b>
                              <div className="text-[10px] text-amber-700 font-medium">Chờ hoàn cọc</div>
                            </div>
                          ) : (
                            <span className="text-muted">Cọc: {vnd(deposit)}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right min-w-[280px] whitespace-nowrap">
                          <div className="flex flex-nowrap items-center justify-end gap-1.5 whitespace-nowrap">
                            {mo.status === "PENDING" && (
                              <>
                                <button
                                  type="button"
                                  className="h-8 px-3 rounded-lg bg-emerald-600 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 active:bg-emerald-800 transition-colors shrink-0"
                                  disabled={actionLoading}
                                  onClick={() => void handleApproveMoveOut(mo)}
                                  title="Duyệt yêu cầu trả phòng. Quyết toán tiền cọc thực hiện ở bước tiếp theo."
                                >
                                  Duyệt yêu cầu
                                </button>
                                <button
                                  type="button"
                                  className="h-8 px-2.5 rounded-lg border border-rose-300 bg-white text-xs font-semibold text-rose-600 shadow-xs hover:bg-rose-50 hover:border-rose-400 active:bg-rose-100 transition-colors shrink-0"
                                  disabled={actionLoading}
                                  onClick={() => {
                                    setRejectMoveOutId(mo.id);
                                    setRejectMoveOutReason("");
                                  }}
                                  title="Từ chối yêu cầu trả phòng"
                                >
                                  Từ chối
                                </button>
                              </>
                            )}
                            {mo.status === "APPROVED" && (
                              <>
                                {mo.refundStatus !== "REFUNDED" ? (
                                  <button
                                    type="button"
                                    className="h-8 px-3 rounded-lg bg-emerald-600 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 active:bg-emerald-800 transition-colors shrink-0"
                                    disabled={actionLoading}
                                    onClick={() => void openSettleMoveOut(mo)}
                                    title="Nhập tiền hoàn, khấu trừ, lý do và tải biên lai hoàn cọc"
                                  >
                                    Quyết toán hoàn cọc
                                  </button>
                                ) : (
                                  <span className="inline-flex items-center h-8 px-2 text-xs text-emerald-700 font-semibold shrink-0">
                                    Đã hoàn cọc
                                  </span>
                                )}
                              </>
                            )}
                            {mo.status === "COMPLETED" && (
                              <span className="inline-flex items-center h-8 px-2 text-xs text-muted font-medium shrink-0">
                                Đã hoàn tất trả phòng
                              </span>
                            )}
                            {mo.status === "REJECTED" && (
                              <span className="inline-flex items-center h-8 px-2 text-xs text-rose-600 font-medium shrink-0">
                                Đã từ chối
                              </span>
                            )}
                            <button
                              type="button"
                              className="h-8 px-2.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors shrink-0"
                              onClick={() => void openContractPdf(mo.contractId)}
                              title="Xem văn bản hợp đồng PDF"
                            >
                              Xem HĐ
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        /* ========================================================================= */
        /* TAB 4: YÊU CẦU GIA HẠN HỢP ĐỒNG (1 NĂM / 12 THÁNG) */
        /* ========================================================================= */
        <>
          <FilterBar items={renewalFilters} value={renewalFilter} onChange={setRenewalFilter} />
          {filteredRenewals.length === 0 ? (
            <div className="rounded-2xl border border-line bg-white p-12 text-center">
              <h3 className="text-base font-bold text-text">Không có yêu cầu gia hạn hợp đồng nào</h3>
              <p className="mt-1 text-sm text-muted">
                Khi khách thuê gửi yêu cầu gia hạn 1 năm từ trang cá nhân, thông tin sẽ lập tức xuất hiện tại đây.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-surface/50 text-xs font-semibold uppercase text-muted">
                  <tr>
                    <th className="px-6 py-4">Mã yêu cầu</th>
                    <th className="px-6 py-4">Khách hàng</th>
                    <th className="px-6 py-4">Phòng / Tòa nhà</th>
                    <th className="px-6 py-4">Thời gian gửi</th>
                    <th className="px-6 py-4">Hợp đồng gốc</th>
                    <th className="px-6 py-4">Kỳ hạn đề xuất</th>
                    <th className="px-6 py-4">Trạng thái tiến trình</th>
                    <th className="px-6 py-4 text-right min-w-[320px] w-[320px]">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredRenewals.map((r) => {
                    const contract = linkedContractOf(r);
                    const stage = renewalStage(r);
                    const baseContract = contractsList.find((base) => sameId(base.id, r.contractId));

                    return (
                      <tr key={r.id} className="transition-colors hover:bg-slate-50/70">
                        <td className="px-6 py-4 font-bold text-text">
                          <span className="flex items-center gap-1.5">
                            #{r.id}
                            <span className="cx-badge info !text-[10px]">Gia hạn</span>
                          </span>
                          {contract && (
                            <div className="text-[11px] font-medium text-slate-500">HĐ nháp #{contract.id}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 font-medium text-text">
                          {customerOf(r.customerId) ?? `Khách #${r.customerId}`}
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-semibold text-text">
                            Phòng {r.roomNumber ?? roomOf(r.roomId)?.code ?? `#${r.roomId}`}
                          </span>
                          <div className="text-xs text-muted">
                            {r.buildingName ?? buildingOf(r.buildingId) ?? `Tòa #${r.buildingId}`}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs font-medium text-slate-800">
                          {r.createdAt ? toVNTime(r.createdAt, true) : "—"}
                        </td>
                        <td className="px-6 py-4 text-xs text-muted">
                          <div>HĐ #{r.contractId}</div>
                          {baseContract?.endDate && (
                            <div className="text-[11px] text-slate-500">Hết hạn: {fmtDate(baseContract.endDate)}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs">
                          <div className="font-bold text-teal-900">
                            {fmtDate(r.startDate)} → {fmtDate(r.endDate)}
                          </div>
                          <div className="text-[11px] text-muted">
                            {r.termMonths} tháng tiếp nối
                            {r.note ? ` · Ghi chú: ${r.note}` : ""}
                          </div>
                        </td>
                        <td className="px-6 py-4">{getRenewalStatusPill(stage, r)}</td>
                        <td className="px-6 py-4 text-right min-w-[320px] whitespace-nowrap">
                          <div className="flex flex-nowrap items-center justify-end gap-1.5 whitespace-nowrap">
                            {r.status === "PENDING" && (
                              <>
                                <button
                                  type="button"
                                  className="h-8 px-3 rounded-lg bg-emerald-600 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 active:bg-emerald-800 transition-colors shrink-0"
                                  disabled={actionLoading}
                                  onClick={() => void handleApproveRenewal(r)}
                                  title="Duyệt yêu cầu. Chưa tạo hợp đồng ở bước này."
                                >
                                  Duyệt
                                </button>
                                <button
                                  type="button"
                                  className="h-8 px-3 rounded-lg border border-rose-300 bg-white text-xs font-semibold text-rose-700 shadow-xs hover:bg-rose-50 transition-colors shrink-0"
                                  disabled={actionLoading}
                                  onClick={() => {
                                    setRejectRenewalTarget(r);
                                    setRejectRenewalReason("");
                                  }}
                                  title="Từ chối yêu cầu gia hạn kèm lý do"
                                >
                                  Từ chối
                                </button>
                              </>
                            )}

                            {stage === "APPROVED" && !contract && (
                              <button
                                type="button"
                                className="h-8 px-3 rounded-lg bg-teal-700 text-xs font-semibold text-white shadow-xs hover:bg-teal-800 transition-colors shrink-0"
                                disabled={actionLoading}
                                onClick={() => void handleCreateRenewalDraft(r)}
                                title="Tạo bản nháp hợp đồng mới với đầy đủ thông tin để chỉnh sửa"
                              >
                                Soạn hợp đồng
                              </button>
                            )}

                            {stage === "APPROVED" && contract && (
                              <>
                                <button
                                  type="button"
                                  className="h-8 px-3 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors shrink-0"
                                  onClick={() => navigate(`/admin/contracts?contractId=${idStr(contract.id)}`)}
                                  title="Mở form sửa hợp đồng nháp: giá thuê, cọc, điện nước và thông tin hai bên"
                                >
                                  <span className="flex items-center gap-1">
                                    <Icon name="edit" size={13} /> Sửa hợp đồng
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  className="h-8 px-3 rounded-lg bg-emerald-600 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 active:bg-emerald-800 transition-colors shrink-0"
                                  disabled={actionLoading}
                                  onClick={() => void handleSendRenewalDraft(contract.id)}
                                  title="Gửi bản nháp đã kiểm tra cho khách ký điện tử (hạn 48 giờ)"
                                >
                                  Gửi khách ký
                                </button>
                              </>
                            )}

                            {stage === "AWAITING_TENANT" && (
                              <span className="inline-flex items-center h-8 px-2 text-xs text-amber-700 font-semibold shrink-0">
                                Đang chờ khách ký
                              </span>
                            )}

                            {stage === "AWAITING_LESSOR" && contract && (
                              <button
                                type="button"
                                className="h-8 px-3 rounded-lg bg-indigo-600 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 active:bg-indigo-800 transition-colors shrink-0 animate-pulse"
                                disabled={actionLoading}
                                onClick={() => {
                                  setSigningContract(contract);
                                  setSignPassword("");
                                  setSignFile(null);
                                  setSignAccepted(false);
                                }}
                                title="Khách đã ký số. Bên cho thuê ký để hoàn tất hợp đồng"
                              >
                                Ký hợp đồng (Chủ nhà)
                              </button>
                            )}

                            {stage === "COMPLETED" && (
                              <span className="inline-flex items-center h-8 px-2 text-xs text-emerald-700 font-bold shrink-0">
                                Đã có hiệu lực
                              </span>
                            )}

                            {r.status === "REJECTED" && r.rejectReason && (
                              <span className="text-xs text-rose-600 max-w-[180px] truncate" title={r.rejectReason}>
                                Lý do: {r.rejectReason}
                              </span>
                            )}

                            {contract && (
                              <button
                                type="button"
                                className="h-8 px-3 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors shrink-0"
                                onClick={() => void openContractPdf(contract.id)}
                                title="Mở và đọc văn bản hợp đồng PDF gia hạn"
                              >
                                <span className="flex items-center gap-1">
                                  <Icon name="contract" size={13} /> Xem PDF
                                </span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Modal Dossier */}
      {dossierFor && (
        <RequestDossierModal
          request={dossierFor}
          roomCode={roomOf(dossierFor.roomId)?.code ?? `#${dossierFor.roomId}`}
          buildingName={buildingOf(dossierFor.buildingId) ?? `#${dossierFor.buildingId}`}
          customerName={customerOf(dossierFor.customerId) ?? `Khách #${dossierFor.customerId}`}
          onClose={() => setDossierFor(null)}
          canVerify={canVerify}
          canDecide={canDecide}
          onVerify={handleVerifyRequest}
          onAccept={handleAcceptRequest}
          onReject={(id) => {
            setRejectId(id);
            setRejectReason("");
          }}
          actionLoading={actionLoading}
        />
      )}

      {/* Reject Rental Request Modal */}
      {rejectId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-text">Từ chối yêu cầu thuê #{rejectId}</h3>
            <p className="mt-1 text-xs text-muted">
              Lý do sẽ được gửi tới khách hàng qua thông báo trong ứng dụng:
            </p>
            <div className="mt-4">
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Ví dụ: Hồ sơ CCCD chưa rõ, hoặc phòng đã có khách đặt cọc trước..."
                className="w-full rounded-lg border border-line p-2 text-sm"
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                className="btn-outline !py-1.5 text-xs"
                onClick={() => setRejectId(null)}
              >
                Hủy
              </button>
              <button
                className="btn-danger !py-1.5 text-xs"
                disabled={actionLoading}
                onClick={handleRejectRequest}
              >
                {actionLoading ? "Đang xử lý…" : "Xác nhận từ chối"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Move-Out Request Modal */}
      {rejectMoveOutId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-text">Từ chối yêu cầu trả phòng #{rejectMoveOutId}</h3>
            <p className="mt-1 text-xs text-muted">
              Vui lòng nhập lý do từ chối để thông báo cho khách thuê:
            </p>
            <div className="mt-4">
              <textarea
                rows={3}
                value={rejectMoveOutReason}
                onChange={(e) => setRejectMoveOutReason(e.target.value)}
                placeholder="Ví dụ: Chưa thanh toán hóa đơn điện nước kỳ cuối, hoặc chưa bàn giao đủ chìa khóa..."
                className="w-full rounded-lg border border-line p-2 text-sm"
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                className="btn-outline !py-1.5 text-xs"
                onClick={() => setRejectMoveOutId(null)}
              >
                Hủy
              </button>
              <button
                className="btn-danger !py-1.5 text-xs"
                disabled={actionLoading}
                onClick={handleRejectMoveOut}
              >
                {actionLoading ? "Đang xử lý…" : "Xác nhận từ chối trả phòng"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move-Out Settlement Modal */}
      {settleMoveOutTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-text">
              Quyết toán hoàn cọc — yêu cầu trả phòng #{settleMoveOutTarget.id}
            </h3>
            <p className="mt-1 text-sm text-muted">
              Tiền cọc hợp đồng: <b className="text-slate-800">{vnd(settleDeposit)}</b>. Nhập số tiền hoàn thực tế,
              khấu trừ hư hao (nếu có) và tải lên biên lai chuyển khoản / ủy nhiệm chi.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Tiền hoàn cho khách (₫)">
                <input
                  type="number"
                  min={0}
                  value={settleRefund}
                  onChange={(e) => setSettleRefund(e.target.value)}
                  className="h-10 w-full rounded-lg border border-line px-3 text-sm"
                />
              </Field>
              <Field label="Khấu trừ (₫)">
                <input
                  type="number"
                  min={0}
                  value={settleDeduction}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSettleDeduction(value);
                    const deduction = Number(value || "0");
                    if (Number.isFinite(deduction) && settleDeposit > 0) {
                      setSettleRefund(String(Math.max(settleDeposit - deduction, 0)));
                    }
                  }}
                  className="h-10 w-full rounded-lg border border-line px-3 text-sm"
                />
              </Field>
            </div>
            <div className="mt-3">
              <Field label="Lý do khấu trừ" hint="Bắt buộc khi khấu trừ lớn hơn 0.">
                <input
                  type="text"
                  value={settleReason}
                  onChange={(e) => setSettleReason(e.target.value)}
                  placeholder="Ví dụ: Dặm vá sơn tường trầy xước"
                  className="h-10 w-full rounded-lg border border-line px-3 text-sm"
                />
              </Field>
            </div>
            <div className="mt-3">
              <Field label="Biên lai hoàn cọc" hint="Ảnh hoặc PDF ủy nhiệm chi ngân hàng (không bắt buộc).">
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setSettleReceipt(e.target.files?.[0] ?? null)}
                  className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-teal-800"
                />
              </Field>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                className="btn-outline !py-1.5 text-xs"
                onClick={() => setSettleMoveOutTarget(null)}
              >
                Hủy
              </button>
              <button
                className="cx-btn primary !h-9 text-xs"
                disabled={actionLoading}
                onClick={handleSettleMoveOut}
              >
                {actionLoading ? "Đang xử lý…" : "Xác nhận quyết toán"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Renewal Request Modal */}
      {rejectRenewalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-text">
              Từ chối yêu cầu gia hạn #{rejectRenewalTarget.id}
            </h3>
            <p className="mt-1 text-sm text-muted">
              Khách thuê sẽ thấy lý do này và có thể gửi lại yêu cầu gia hạn mới.
            </p>
            <div className="mt-4">
              <textarea
                rows={3}
                value={rejectRenewalReason}
                onChange={(e) => setRejectRenewalReason(e.target.value)}
                placeholder="Ví dụ: Cần bàn giao phòng cho khách khác đã đặt cọc, hoặc chưa thống nhất được giá thuê mới..."
                className="w-full rounded-lg border border-line p-2 text-sm"
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                className="btn-outline !py-1.5 text-xs"
                onClick={() => setRejectRenewalTarget(null)}
              >
                Hủy
              </button>
              <button
                className="btn-danger !py-1.5 text-xs"
                disabled={actionLoading}
                onClick={handleRejectRenewal}
              >
                {actionLoading ? "Đang xử lý…" : "Xác nhận từ chối gia hạn"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lessor Signing Modal for Renewals */}
      {signingContract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base m-0">
                  Ký điện tử hợp đồng gia hạn #{signingContract.id}
                </h3>
                <p className="text-xs text-muted m-0 mt-0.5">
                  Khách thuê đã ký xong. Bên cho thuê ký xác nhận để hoàn tất hợp đồng.
                </p>
              </div>
              <button
                type="button"
                className="rounded-full p-1.5 text-muted hover:bg-slate-100"
                onClick={() => setSigningContract(null)}
              >
                <Icon name="close" size={16} />
              </button>
            </div>

            <div className="rounded-xl bg-slate-50 p-3.5 text-xs space-y-1.5 border border-line">
              <div className="flex justify-between">
                <span className="text-muted">Khách thuê:</span>
                <b>{customerOf(signingContract.customerId) ?? `Khách #${signingContract.customerId}`}</b>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Phòng / Tòa nhà:</span>
                <b>Phòng {roomOf(signingContract.roomId)?.code} · {buildingOf(signingContract.buildingId)}</b>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Thời hạn gia hạn:</span>
                <b className="text-teal-800">{fmtDate(signingContract.startDate)} → {fmtDate(signingContract.endDate)} (1 năm)</b>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Giá thuê:</span>
                <b>{signingContract.rentAmount != null ? `${vnd(signingContract.rentAmount)}/tháng` : "Theo hợp đồng"}</b>
              </div>
            </div>

            <div className="flex justify-start">
              <button
                type="button"
                className="text-xs font-semibold text-teal-700 underline flex items-center gap-1"
                onClick={() => void openContractPdf(signingContract.id)}
              >
                <Icon name="contract" size={14} /> Xem văn bản hợp đồng PDF trước khi ký
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Chữ ký điện tử của Bên cho thuê (Vẽ hoặc chọn ảnh):
              </label>
              <SignaturePad
                width={360}
                height={140}
                penColor="#0f766e"
                onChange={(f) => setSignFile(f)}
                onExport={(f) => setSignFile(f)}
              />
              {signFile && (
                <div className="mt-2 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-800">
                  <span className="font-medium flex items-center gap-1.5">
                    <Icon name="check" size={14} className="text-emerald-600" /> Đã sẵn sàng chữ ký: <span className="font-semibold underline">{signFile.name}</span>
                  </span>
                  <button
                    type="button"
                    className="text-xs font-semibold text-rose-600 hover:underline"
                    onClick={() => setSignFile(null)}
                  >
                    Xóa
                  </button>
                </div>
              )}
            </div>

            <div>
              <Field label="Mật khẩu đăng nhập của bạn để xác thực ký">
                <input
                  type="password"
                  autoComplete="current-password"
                  value={signPassword}
                  onChange={(e) => setSignPassword(e.target.value)}
                  placeholder="Nhập mật khẩu tài khoản Quản lý / Admin"
                  className="w-full rounded-lg border border-line p-2 text-sm"
                />
              </Field>
            </div>

            <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={signAccepted}
                onChange={(e) => setSignAccepted(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Tôi xác nhận đã kiểm tra hợp đồng PDF và đồng ý ký điện tử gia hạn hợp đồng phòng này thêm 1 năm (12 tháng).
              </span>
            </label>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <button
                type="button"
                className="btn-outline !py-2 text-xs"
                onClick={() => setSigningContract(null)}
              >
                Hủy
              </button>
              <button
                type="button"
                className="h-9 px-4 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 shadow-sm disabled:opacity-50"
                disabled={actionLoading || !signPassword || !signFile || !signAccepted}
                onClick={() => void handleLessorSign()}
              >
                {actionLoading ? "Đang xử lý…" : "Xác nhận ký hợp đồng"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
