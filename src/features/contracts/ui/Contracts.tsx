import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { hasAnyRole, useAuth } from "@/features/auth";
import { ApiError } from "@/shared/api/httpClient";
import { Drawer, Field, Icon, MiniStat, PageHead, Pill, Tabs, todayVN, toVNTime, useToast, vnd, type Tone } from "@/shared/ui";
import {
  contractsApi,
  type Contract,
  type ContractDetail,
  type ContractStatus,
  type ContractTenant,
  type MoveOutRequest,
  type MoveOutStatus,
} from "@/features/contracts/api/contractsApi";

const statusLabel: Record<ContractStatus, string> = {
  DRAFT: "Nháp",
  ACTIVE: "Hiệu lực",
  TERMINATED: "Đã chấm dứt",
  ENDED: "Đã kết thúc",
};
const statusTone: Record<ContractStatus, Tone> = { DRAFT: "violet", ACTIVE: "teal", TERMINATED: "coral", ENDED: "slate" };
const moveOutLabel: Record<MoveOutStatus, string> = { PENDING: "Chờ duyệt", APPROVED: "Đã duyệt", REJECTED: "Từ chối", COMPLETED: "Hoàn tất" };
const moveOutTone: Record<MoveOutStatus, Tone> = { PENDING: "amber", APPROVED: "teal", REJECTED: "coral", COMPLETED: "slate" };

const TABS: { label: string; status?: ContractStatus }[] = [
  { label: "Tất cả" },
  { label: "Nháp", status: "DRAFT" },
  { label: "Hiệu lực", status: "ACTIVE" },
  { label: "Đã chấm dứt", status: "TERMINATED" },
  { label: "Đã kết thúc", status: "ENDED" },
];

/** Backend trả LocalDate (yyyy-mm-dd); hiển thị nguyên ngày, không đổi múi giờ. */
const fmtDate = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "—");
const plusYear = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString().slice(0, 10);
};
const errText = (e: unknown) => (e instanceof ApiError ? `${e.code} · ${e.message}` : e instanceof Error ? e.message : "Đã xảy ra lỗi.");

/** Yêu cầu dọn đi đang chờ duyệt: null = chưa tải xong/không tải được (không phải "0 yêu cầu"). */
type PendingMoveOuts = { items: MoveOutRequest[]; total: number; complete: boolean } | { error: string };

/** Thông báo dùng chung cho stat và drawer, để hai nơi không lệch nhau. */
type MoveOutsNotice =
  | { kind: "error"; message: "Không tải được"; detail: string }
  | { kind: "partial"; message: "Chỉ tải được một phần danh sách" }
  | null;

const MOVE_OUT_PAGE_SIZE = 50;
const MOVE_OUT_MAX_PAGES = 20;

/** Tải mọi trang PENDING cần thiết; `total` lấy từ totalElements nên luôn chính xác. */
async function fetchPendingMoveOuts(): Promise<PendingMoveOuts> {
  try {
    const first = await contractsApi.moveOuts({ status: "PENDING", page: 0, size: MOVE_OUT_PAGE_SIZE });
    const items = [...first.content];
    const total = first.totalElements;
    const maxPages = Math.min(first.totalPages, MOVE_OUT_MAX_PAGES);
    for (let next = 1; next < maxPages && items.length < total; next += 1) {
      const page = await contractsApi.moveOuts({ status: "PENDING", page: next, size: MOVE_OUT_PAGE_SIZE });
      if (page.content.length === 0) break;
      items.push(...page.content);
    }
    return { items, total, complete: items.length >= total };
  } catch (e) {
    return { error: errText(e) };
  }
}

/** Ngày chấm dứt hợp lệ trong khoảng [startDate, endDate]; endDate null = không giới hạn trên. */
function terminationBounds(c: Contract) {
  const min = c.startDate;
  const max = c.endDate ?? "";
  const clamp = (d: string) => (!d ? d : d < min ? min : max && d > max ? max : d);
  const valid = (d: string) => !!d && d >= min && (!max || d <= max);
  return { min, max: max || undefined, clamp, valid };
}

/**
 * Mutation và refresh tách rời: mutation lỗi → báo lỗi; mutation xong mà refresh lỗi
 * → vẫn báo thành công, kèm cảnh báo dữ liệu chưa tải lại được.
 */
async function runMutation(
  fn: () => Promise<unknown>,
  refresh: () => Promise<boolean>,
  onSuccess: (reloadFailed: boolean) => void,
  onError: (message: string) => void,
): Promise<boolean> {
  try {
    await fn();
  } catch (e) {
    onError(errText(e));
    return false;
  }
  const reloaded = await refresh();
  onSuccess(!reloaded);
  return true;
}

function StatusPill({ status }: { status: ContractStatus }) {
  return <Pill tone={statusTone[status]}>{statusLabel[status]}</Pill>;
}

function Occupants({
  contract,
  canWrite,
  refresh,
  notify,
  toast,
}: {
  contract: ContractDetail;
  canWrite: boolean;
  refresh: () => Promise<boolean>;
  notify: (message: string, reloadFailed: boolean) => void;
  toast: (m: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  // joinedAt phải >= startDate của hợp đồng (backend chặn), nên mặc định lấy mốc muộn hơn.
  const defaultJoinedAt = contract.startDate > todayVN() ? contract.startDate : todayVN();
  const [form, setForm] = useState({ customerId: "", joinedAt: defaultJoinedAt });
  const [leaving, setLeaving] = useState<{ tenantId: number; leftAt: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const active = contract.tenants.filter((t) => !t.leftAt);

  const add = async () => {
    const customerId = Number(form.customerId);
    if (!Number.isInteger(customerId) || customerId <= 0) return setError("Nhập customerId (số) của khách thuê.");
    if (!form.joinedAt) return setError("Chọn ngày vào ở.");
    setBusy(true);
    setError("");
    await runMutation(
      () => contractsApi.addTenant(contract.id, customerId, form.joinedAt),
      refresh,
      (reloadFailed) => {
        setAdding(false);
        setForm({ customerId: "", joinedAt: defaultJoinedAt });
        toast("Đã thêm người ở");
        notify("Đã thêm người ở", reloadFailed);
      },
      setError,
    );
    setBusy(false);
  };

  const leave = async () => {
    if (!leaving) return;
    setBusy(true);
    setError("");
    await runMutation(
      () => contractsApi.leaveTenant(contract.id, leaving.tenantId, leaving.leftAt),
      refresh,
      (reloadFailed) => {
        setLeaving(null);
        toast("Đã ghi nhận ngày rời đi");
        notify("Đã ghi nhận ngày rời đi", reloadFailed);
      },
      setError,
    );
    setBusy(false);
  };

  const setRep = async (t: ContractTenant) => {
    setBusy(true);
    setError("");
    await runMutation(
      () => contractsApi.setRepresentative(contract.id, t.id),
      refresh,
      (reloadFailed) => {
        toast("Đã đổi người đại diện");
        notify("Đã đổi người đại diện", reloadFailed);
      },
      setError,
    );
    setBusy(false);
  };

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm text-muted">{active.length} người đang ở · {contract.tenants.length} người trong hợp đồng</span>
        {canWrite && contract.status === "ACTIVE" && (
          <button className="text-button !text-xs" onClick={() => { setAdding(!adding); setError(""); }}>
            <Icon name="plus" size={14} /> Thêm người ở
          </button>
        )}
      </div>
      {adding && (
        <div className="mb-4 rounded-xl border border-line bg-[#fafbf9] p-4">
          <div className="form-grid">
            <Field label="Mã khách thuê (customerId)" hint="Backend chỉ nhận ID, tên khách do dịch vụ người dùng trả">
              <input inputMode="numeric" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} />
            </Field>
            <Field label="Ngày vào ở"><input type="date" value={form.joinedAt} min={contract.startDate} onChange={(e) => setForm({ ...form, joinedAt: e.target.value })} /></Field>
          </div>
          {error && <div className="alert alert-error mt-3"><Icon name="shield" size={18} /><div>{error}</div></div>}
          <div className="mt-3 flex justify-end gap-2">
            <button className="secondary-button !h-9" onClick={() => { setAdding(false); setError(""); }}>Hủy</button>
            <button className="primary-button !h-9" disabled={busy} onClick={add}>Thêm</button>
          </div>
        </div>
      )}
      {!adding && error && <div className="alert alert-error mb-3"><Icon name="shield" size={18} /><div>{error}</div></div>}
      <div className="divide-y divide-line rounded-xl border border-line">
        {contract.tenants.length === 0 && <div className="p-4 text-sm text-muted">Hợp đồng chưa có người ở.</div>}
        {contract.tenants.map((t) => (
          <div key={t.id} className="flex flex-wrap items-center gap-3 p-3.5">
            <span className="avatar-chip !h-9 !w-9">{String(t.customerId).slice(-2)}</span>
            <div className="min-w-0 flex-1">
              <b className="text-sm">Khách #{t.customerId}</b>{" "}
              {t.isRepresentative && <Pill tone="teal">Đại diện phòng</Pill>} {t.leftAt && <Pill tone="slate">Đã rời</Pill>}
              <div className="sub text-xs text-muted">Vào {fmtDate(t.joinedAt)}{t.leftAt && ` · Rời ${fmtDate(t.leftAt)}`}</div>
            </div>
            {canWrite && !t.leftAt && !t.isRepresentative && contract.status === "ACTIVE" && (
              <>
                <button className="text-button" disabled={busy} onClick={() => setRep(t)}>Đặt làm đại diện</button>
                <button className="text-button !text-[#a63e28]" onClick={() => { setLeaving({ tenantId: t.id, leftAt: todayVN() }); setError(""); }}>Ghi nhận rời đi</button>
              </>
            )}
          </div>
        ))}
      </div>
      {leaving && (
        <div className="mt-3 rounded-xl border border-line bg-[#fafbf9] p-4">
          <Field label="Ngày rời đi"><input type="date" value={leaving.leftAt} onChange={(e) => setLeaving({ ...leaving, leftAt: e.target.value })} /></Field>
          <div className="mt-3 flex justify-end gap-2">
            <button className="secondary-button !h-9" onClick={() => setLeaving(null)}>Hủy</button>
            <button className="primary-button !h-9" disabled={busy || !leaving.leftAt} onClick={leave}>Xác nhận</button>
          </div>
        </div>
      )}
    </>
  );
}

function Detail({
  contract,
  loading,
  error,
  refresh,
  moveOut,
  moveOutsNotice,
  canWrite,
  notify,
  toast,
}: {
  contract: ContractDetail | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<boolean>;
  moveOut: MoveOutRequest | null;
  moveOutsNotice: MoveOutsNotice;
  canWrite: boolean;
  notify: (message: string, reloadFailed: boolean) => void;
  toast: (m: string) => void;
}) {
  const [tab, setTab] = useState("Thông tin");
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  if (loading) return <div className="py-10 text-center text-sm text-muted">Đang tải chi tiết…</div>;
  if (error) return <div className="alert alert-error"><Icon name="shield" size={18} /><div>{error}</div></div>;
  if (!contract) return null;

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true);
    setActionError("");
    await runMutation(fn, refresh, (reloadFailed) => { toast(msg); notify(msg, reloadFailed); }, setActionError);
    setBusy(false);
  };

  return (
    <>
      <div className="mb-5"><Tabs items={["Thông tin", "Người ở"]} value={tab} onChange={setTab} /></div>
      {actionError && <div className="alert alert-error mb-4"><Icon name="shield" size={18} /><div>{actionError}</div></div>}
      {tab === "Thông tin" && (
        <>
          <div className="kv">
            <div><span>Mã hợp đồng</span><b>#{contract.id}</b></div>
            <div><span>Yêu cầu thuê</span><b>{contract.rentalRequestId ? `#${contract.rentalRequestId}` : "—"}</b></div>
            <div><span>Mã khách đứng tên</span><b>#{contract.customerId}</b></div>
            <div><span>Phòng</span><b>#{contract.roomId}</b></div>
            <div><span>Tòa nhà</span><b>#{contract.buildingId}</b></div>
            <div><span>Giá thuê</span><b>{contract.rentAmount == null ? "—" : vnd(contract.rentAmount)}</b></div>
            <div><span>Tiền cọc</span><b>{contract.depositAmount == null ? "—" : vnd(contract.depositAmount)}</b></div>
            <div><span>Trạng thái</span><b><StatusPill status={contract.status} /></b></div>
            <div><span>Bắt đầu</span><b>{fmtDate(contract.startDate)}</b></div>
            <div><span>Kết thúc</span><b>{fmtDate(contract.endDate)}</b></div>
            <div><span>Tạo lúc</span><b>{toVNTime(contract.createdAt, true)}</b></div>
            {contract.terminationReason && <div className="span-2"><span>Lý do chấm dứt</span><b>{contract.terminationReason}</b></div>}
          </div>
          {contract.status === "DRAFT" && (
            <div className="alert alert-info mt-4"><Icon name="contract" size={18} />Hợp đồng nháp — chỉnh giá qua luồng chốt giá của quản lý trước khi ký. Sau khi ký, giá thuê được cố định suốt thời hạn.</div>
          )}
          {moveOutsNotice?.kind === "error" && (
            <div className="alert alert-error mt-4"><Icon name="shield" size={18} /><div><b>Không tải được</b> danh sách yêu cầu dọn đi ({moveOutsNotice.detail}). Trạng thái dọn đi của hợp đồng này chưa xác định.</div></div>
          )}
          {moveOutsNotice?.kind === "partial" && (
            <div className="alert alert-info mt-4"><Icon name="shield" size={18} /><div><b>Chỉ tải được một phần danh sách</b> yêu cầu dọn đi, nên trạng thái dọn đi của hợp đồng này có thể chưa chính xác.</div></div>
          )}
          {moveOut && (
            <>
              <div className="section-title">Yêu cầu dọn đi</div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <b>Khách #{moveOut.requestedBy} muốn dọn đi ngày {fmtDate(moveOut.expectedMoveOutDate)}</b>
                  <Pill tone={moveOutTone[moveOut.status]}>{moveOutLabel[moveOut.status]}</Pill>
                </div>
                {moveOut.reason && <p className="mt-1 text-muted">“{moveOut.reason}”</p>}
                {canWrite && moveOut.status === "PENDING" && (
                  <>
                    {rejecting ? (
                      <div className="mt-3">
                        <Field label="Lý do từ chối"><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ví dụ: chưa bàn giao phòng" /></Field>
                        <div className="mt-2 flex gap-2">
                          <button className="secondary-button !h-9" onClick={() => setRejecting(false)}>Hủy</button>
                          <button
                            className="danger-button !h-9"
                            disabled={busy || !reason.trim()}
                            onClick={() => act(() => contractsApi.rejectMoveOut(moveOut.id, reason.trim()), "Đã từ chối yêu cầu dọn đi")}
                          >
                            Xác nhận từ chối
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 flex gap-2">
                        <button className="primary-button !h-9" disabled={busy} onClick={() => act(() => contractsApi.approveMoveOut(moveOut.id), "Đã duyệt yêu cầu dọn đi")}>Duyệt</button>
                        <button className="secondary-button !h-9" disabled={busy} onClick={() => setRejecting(true)}>Từ chối</button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </>
      )}
      {tab === "Người ở" && <Occupants contract={contract} canWrite={canWrite} refresh={refresh} notify={notify} toast={toast} />}
    </>
  );
}

export default function Contracts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canWrite = hasAnyRole(user, ["QUAN_LY", "ADMIN"]);
  const canCreateDraft = hasAnyRole(user, ["SALE", "QUAN_LY", "ADMIN"]);
  const [tab, setTab] = useState("Tất cả");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<Contract[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingMoveOuts, setPendingMoveOuts] = useState<PendingMoveOuts | null>(null);
  const [counts, setCounts] = useState<{ active: number | null; draft: number | null } | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ContractDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [confirm, setConfirm] = useState<"draft" | "renew" | "terminate" | null>(null);
  const [form, setForm] = useState({
    startDate: "", endDate: "", rentAmount: "", depositAmount: "",
    newEndDate: "", terminationDate: todayVN(), reason: "",
  });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [reloadWarning, setReloadWarning] = useState("");
  const [toast, show] = useToast();

  const status = TABS.find((t) => t.label === tab)?.status;

  const loadList = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await contractsApi.list({ status, page, size: 20 });
      setRows(res.content);
      setTotalPages(res.totalPages);
      setTotalElements(res.totalElements);
      return true;
    } catch (e) {
      setRows([]);
      setTotalPages(0);
      setTotalElements(0);
      setError(errText(e));
      return false;
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  const loadSide = useCallback(async () => {
    let ok = true;
    try {
      const [active, draft] = await Promise.all([
        contractsApi.list({ status: "ACTIVE", page: 0, size: 1 }),
        contractsApi.list({ status: "DRAFT", page: 0, size: 1 }),
      ]);
      setCounts({ active: active.totalElements, draft: draft.totalElements });
    } catch {
      setCounts(null);
      ok = false;
    }
    // GET /move-out-requests chỉ cho QUAN_LY/ADMIN — SALE không gọi để tránh 403.
    if (!canWrite) {
      setPendingMoveOuts({ items: [], total: 0, complete: true });
      return ok;
    }
    const result = await fetchPendingMoveOuts();
    setPendingMoveOuts(result);
    return ok && !("error" in result);
  }, [canWrite]);

  const loadDetail = useCallback(async (id: number, keepOnError = false) => {
    setDetailLoading(true);
    setDetailError("");
    try {
      setDetail(await contractsApi.detail(id));
      return true;
    } catch (e) {
      // Khi refresh sau mutation: giữ chi tiết cũ, chỉ cảnh báo chưa tải lại được.
      if (!keepOnError) {
        setDetail(null);
        setDetailError(errText(e));
      }
      return false;
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => { void loadList(); }, [loadList]);
  useEffect(() => { void loadSide(); }, [loadSide]);
  useEffect(() => { if (openId != null) void loadDetail(openId); }, [openId, loadDetail]);

  /** Trả về true nếu mọi phần tải lại thành công — dùng để tách lỗi mutation khỏi lỗi refresh. */
  const refresh = useCallback(async () => {
    const results = await Promise.all([loadList(), loadSide()]);
    if (openId != null) results.push(await loadDetail(openId, true));
    return results.every(Boolean);
  }, [loadList, loadSide, loadDetail, openId]);

  const notify = (message: string, reloadFailed: boolean) => {
    if (reloadFailed) setReloadWarning(`${message}, nhưng dữ liệu chưa tải lại được. Đóng và mở lại, hoặc dùng "Thử lại" để xem trạng thái mới.`);
    else setReloadWarning("");
  };

  const closeDrawer = () => { setOpenId(null); setDetail(null); setConfirm(null); setActionError(""); setReloadWarning(""); };

  const openDetail = (c: Contract) => {
    const bounds = terminationBounds(c);
    setConfirm(null);
    setActionError("");
    setReloadWarning("");
    setForm({
      startDate: c.startDate, endDate: c.endDate ?? "", rentAmount: c.rentAmount?.toString() ?? "", depositAmount: c.depositAmount?.toString() ?? "",
      newEndDate: plusYear(c.endDate), terminationDate: bounds.clamp(todayVN()), reason: "",
    });
    setOpenId(c.id);
  };

  const runAction = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true);
    setActionError("");
    const ok = await runMutation(fn, refresh, (reloadFailed) => { setConfirm(null); show(msg); notify(msg, reloadFailed); }, setActionError);
    if (ok) setConfirm(null);
    setBusy(false);
  };

  const pending = useMemo(() => {
    if (!pendingMoveOuts || "error" in pendingMoveOuts) return null;
    const byContract = new Map<number, MoveOutRequest>();
    for (const m of pendingMoveOuts.items) if (!byContract.has(m.contractId)) byContract.set(m.contractId, m);
    return byContract;
  }, [pendingMoveOuts]);

  /** Lỗi tải hoàn toàn khác với chỉ tải được một phần (chạm giới hạn số trang). */
  const moveOutsNotice: MoveOutsNotice = !pendingMoveOuts
    ? null
    : "error" in pendingMoveOuts
      ? { kind: "error", message: "Không tải được", detail: pendingMoveOuts.error ?? "Lỗi không xác định" }
      : pendingMoveOuts.complete
        ? null
        : { kind: "partial", message: "Chỉ tải được một phần danh sách" };
  const currentMoveOut = detail && pending ? pending.get(detail.id) ?? null : null;

  const bounds = detail ? terminationBounds(detail) : null;
  const terminationDate = form.terminationDate;
  const terminationValid = !!bounds && bounds.valid(terminationDate);
  const rentAmount = Number(form.rentAmount);
  const depositAmount = form.depositAmount.trim() ? Number(form.depositAmount) : null;
  const draftValid = !!form.startDate
    && (!form.endDate || form.endDate > form.startDate)
    && Number.isInteger(rentAmount) && rentAmount > 0
    && (depositAmount == null || (Number.isInteger(depositAmount) && depositAmount >= 0));
  const updateDraft = () => {
    if (!detail) return;
    return runAction(
      () => contractsApi.updateDraft(detail.id, {
        startDate: form.startDate,
        endDate: form.endDate || null,
        rentAmount,
        depositAmount,
      }),
      "Đã cập nhật hợp đồng nháp",
    );
  };

  return (
    <>
      <PageHead
        eyebrow="Pháp lý"
        title="Hợp đồng thuê"
        desc="Theo dõi vòng đời hợp đồng: ký, gia hạn, chấm dứt, quản lý người ở và duyệt yêu cầu dọn đi. Ngày hiển thị theo dữ liệu backend (YYYY-MM-DD)."
        actions={canCreateDraft ? (
          <button className="cx-btn" onClick={() => navigate("/admin/contracts/new-draft")}>
            <Icon name="plus" size={16} /> Tạo hợp đồng nháp
          </button>
        ) : undefined}
      />
      <section className="stats-grid mb-6">
        <MiniStat label="Đang hiệu lực" value={counts?.active != null ? String(counts.active) : "—"} note={counts ? "Hợp đồng ACTIVE" : "Không tải được"} />
        <MiniStat label="Nháp" value={counts?.draft != null ? String(counts.draft) : "—"} note={counts ? "Chờ chốt giá & ký" : "Không tải được"} tone="sky" />
        {canWrite && (
          <MiniStat
            label="Yêu cầu dọn đi"
            value={pendingMoveOuts && !("error" in pendingMoveOuts) ? String(pendingMoveOuts.total) : "—"}
            note={moveOutsNotice ? moveOutsNotice.message : pendingMoveOuts ? "Chờ quản lý duyệt" : "Đang tải…"}
            tone={moveOutsNotice?.kind === "error" ? "coral" : "amber"}
          />
        )}
      </section>
      <article className="panel">
        <div className="toolbar">
          <Tabs items={TABS.map((t) => t.label)} value={tab} onChange={(v) => { setTab(v); setPage(0); }} />
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Mã HĐ</th><th>Khách thuê</th><th>Phòng · Tòa</th><th>Thời hạn</th><th className="text-right">Giá thuê</th><th className="text-right">Cọc</th><th>Trạng thái</th><th></th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={8} className="py-8 text-center text-sm text-muted">Đang tải hợp đồng…</td></tr>}
              {!loading && error && (
                <tr><td colSpan={8} className="py-6">
                  <div className="alert alert-error"><Icon name="shield" size={18} /><div>{error}</div></div>
                  <div className="mt-3 text-center"><button className="secondary-button !h-9" onClick={() => void loadList()}>Thử lại</button></div>
                </td></tr>
              )}
              {!loading && !error && rows.length === 0 && (
                <tr><td colSpan={8} className="py-10 text-center text-sm text-muted">Không có hợp đồng nào ở trạng thái này.</td></tr>
              )}
              {!loading && !error && rows.map((r) => {
                const mo = pending?.get(r.id);
                return (
                  <tr key={r.id} className="cursor-pointer" onClick={() => openDetail(r)}>
                    <td className="font-mono text-xs font-bold">#{r.id}</td>
                    <td><b>Khách #{r.customerId}</b><div className="sub">{mo ? `Có yêu cầu dọn đi (${moveOutLabel[mo.status]})` : `Khách đứng tên #${r.customerId}`}</div></td>
                    <td className="text-[13px]">#{r.roomId} · #{r.buildingId}</td>
                    <td className="whitespace-nowrap text-xs">{fmtDate(r.startDate)} → {fmtDate(r.endDate)}</td>
                    <td className="text-right font-bold">{r.rentAmount == null ? "—" : vnd(r.rentAmount)}</td>
                    <td className="text-right text-muted">{r.depositAmount == null ? "—" : vnd(r.depositAmount)}</td>
                    <td><StatusPill status={r.status} /></td>
                    <td><button className="text-button">Chi tiết <Icon name="chevron" size={13} /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!loading && !error && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-line px-4 py-3 text-xs text-muted">
            <span>Trang {page + 1}/{totalPages} · {totalElements} hợp đồng</span>
            <div className="flex gap-2">
              <button className="secondary-button !h-8" disabled={page === 0} onClick={() => setPage(page - 1)}>Trước</button>
              <button className="secondary-button !h-8" disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)}>Sau</button>
            </div>
          </div>
        )}
      </article>

      <Drawer
        open={openId != null}
        wide
        eyebrow={detail ? `Phòng #${detail.roomId} · Tòa #${detail.buildingId}` : undefined}
        title={`Hợp đồng #${openId ?? ""}`}
        onClose={closeDrawer}
        footer={detail && canWrite ? (
          confirm ? (
            <>
              <div className="mr-auto self-center">
                {confirm === "draft" ? (
                  <div className="form-grid">
                    <p className="span-2 text-xs text-muted">
                      Chỉ cập nhật điều khoản của hợp đồng nháp #{detail.id}. Không tạo hợp đồng mới;
                      hợp đồng mới do contract-tenant-service tạo từ event <code>RentalRequestAccepted</code>.
                    </p>
                    <Field label="Ngày bắt đầu"><input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></Field>
                    <Field label="Ngày kết thúc" error={form.endDate && form.endDate <= form.startDate ? "Ngày kết thúc phải sau ngày bắt đầu." : undefined}><input type="date" value={form.endDate} min={form.startDate || undefined} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></Field>
                    <Field label="Giá thuê (VNĐ)"><input type="number" min="1" step="1" value={form.rentAmount} onChange={(e) => setForm({ ...form, rentAmount: e.target.value })} /></Field>
                    <Field label="Tiền cọc (VNĐ)"><input type="number" min="0" step="1" value={form.depositAmount} onChange={(e) => setForm({ ...form, depositAmount: e.target.value })} /></Field>
                  </div>
                ) : confirm === "renew" ? (
                  <Field label="Ngày kết thúc mới">
                    <input type="date" value={form.newEndDate} onChange={(e) => setForm({ ...form, newEndDate: e.target.value })} />
                  </Field>
                ) : (
                  <div className="form-grid">
                    <Field
                      label="Ngày chấm dứt"
                      hint={bounds ? `Trong khoảng ${fmtDate(bounds.min)}${bounds.max ? ` – ${fmtDate(bounds.max)}` : ""}` : undefined}
                      error={terminationDate && !terminationValid ? "Ngày phải nằm trong thời hạn hợp đồng." : undefined}
                    >
                      <input
                        type="date"
                        value={form.terminationDate}
                        min={bounds?.min}
                        max={bounds?.max}
                        onChange={(e) => setForm({ ...form, terminationDate: e.target.value })}
                      />
                    </Field>
                    <Field label="Lý do">
                      <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Ví dụ: khách chuyển đi" />
                    </Field>
                  </div>
                )}
              </div>
              <button className="secondary-button" onClick={() => setConfirm(null)}>Hủy</button>
              <button
                className={confirm === "terminate" ? "danger-button" : "primary-button"}
                disabled={busy || (confirm === "draft" ? !draftValid : confirm === "renew" ? !form.newEndDate : !terminationValid || !form.reason.trim())}
                onClick={() =>
                  confirm === "draft"
                    ? updateDraft()
                    : confirm === "renew"
                      ? runAction(() => contractsApi.renew(detail.id, form.newEndDate), "Đã gia hạn hợp đồng")
                      : runAction(() => contractsApi.terminate(detail.id, form.terminationDate, form.reason.trim()), "Đã chấm dứt hợp đồng")
                }
              >
                Xác nhận
              </button>
            </>
          ) : (
            <>
              {detail.status === "DRAFT" && (
                <>
                  <button className="secondary-button" disabled={busy} title="Chỉ sửa hợp đồng nháp hiện có, không tạo hợp đồng mới" onClick={() => { setActionError(""); setConfirm("draft"); }}>
                    Cập nhật điều khoản nháp
                  </button>
                  <button className="primary-button" disabled={busy} onClick={() => runAction(() => contractsApi.sign(detail.id), "Hợp đồng đã được ký")}>
                    <Icon name="check" size={15} /> Xác nhận đã ký
                  </button>
                </>
              )}
              {detail.status === "ACTIVE" && (
                <>
                  <button
                    className="danger-button"
                    onClick={() => {
                      setActionError("");
                      setForm((f) => ({ ...f, terminationDate: bounds ? bounds.clamp(f.terminationDate || todayVN()) : f.terminationDate }));
                      setConfirm("terminate");
                    }}
                  >
                    Chấm dứt / thanh lý
                  </button>
                  <button className="primary-button" onClick={() => { setActionError(""); setConfirm("renew"); }}>Gia hạn</button>
                </>
              )}
            </>
          )
        ) : undefined}
      >
        {reloadWarning && <div className="alert alert-info mb-4"><Icon name="shield" size={18} /><div>{reloadWarning}</div></div>}
        <Detail
          contract={detail}
          loading={detailLoading}
          error={detailError}
          refresh={refresh}
          moveOut={currentMoveOut}
          moveOutsNotice={moveOutsNotice}
          canWrite={canWrite}
          notify={notify}
          toast={show}
        />
        {actionError && <div className="alert alert-error mt-4"><Icon name="shield" size={18} /><div>{actionError}</div></div>}
        {!canWrite && <div className="alert alert-info mt-4"><Icon name="shield" size={18} />Vai trò SALE chỉ được xem. Ký, gia hạn, chấm dứt và quản lý người ở do QUẢN LÝ/ADMIN thực hiện.</div>}
      </Drawer>
      {toast}
    </>
  );
}
