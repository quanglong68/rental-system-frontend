import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { hasAnyRole, useAuth } from "@/features/auth";
import { errorText } from "@/shared/api/errors";
import {
  Drawer,
  Field,
  Icon,
  MiniStat,
  PageHead,
  Pill,
  Tabs,
  todayVN,
  toVNTime,
  useToast,
  vnd,
  formatMoneyInput,
  parseMoneyInput,
  SignaturePad,
  type Tone,
} from "@/shared/ui";
import { idStr, type Id } from "@/shared/lib/id";
import { useBuildingLookup, useCustomerLookup, useRoomLookup } from "@/shared/lib/refLabels";
import {
  contractsApi,
  type Contract,
  type ContractDetail,
  type ContractStatus,
  type ContractTenant,
  type MoveOutRequest,
  type SignatureStatus,
} from "@/features/contracts/api/contractsApi";
import { CustomerPicker } from "./CustomerPicker";

const statusLabel: Record<ContractStatus, string> = {
  DRAFT: "Nháp",
  ACTIVE: "Hiệu lực",
  TERMINATED: "Đã chấm dứt",
  ENDED: "Đã kết thúc",
};
const statusTone: Record<ContractStatus, Tone> = {
  DRAFT: "violet",
  ACTIVE: "teal",
  TERMINATED: "coral",
  ENDED: "slate",
};

const signatureLabel: Record<SignatureStatus, string> = {
  NOT_READY: "Chưa gửi khách ký",
  AWAITING_TENANT: "Chờ khách ký",
  AWAITING_LESSOR: "Chờ bên cho thuê ký",
  COMPLETED: "Đã ký đủ hai bên",
  DECLINED: "Khách từ chối ký",
  EXPIRED: "Quá hạn ký",
};
const signatureTone: Record<SignatureStatus, Tone> = {
  NOT_READY: "slate",
  AWAITING_TENANT: "amber",
  AWAITING_LESSOR: "sky",
  COMPLETED: "teal",
  DECLINED: "coral",
  EXPIRED: "coral",
};

const paymentMethodLabel: Record<string, string> = { CASH: "Tiền mặt", BANK_TRANSFER: "Chuyển khoản" };
const waterUnitLabel: Record<string, string> = { M3: "theo m³", PERSON: "theo người" };

const TABS: { label: string; status?: ContractStatus }[] = [
  { label: "Tất cả" },
  { label: "Nháp", status: "DRAFT" },
  { label: "Hiệu lực", status: "ACTIVE" },
  { label: "Đã chấm dứt", status: "TERMINATED" },
  { label: "Đã kết thúc", status: "ENDED" },
];

/** Backend trả LocalDate (yyyy-mm-dd); hiển thị nguyên ngày, không đổi múi giờ. */
const fmtDate = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "—");
const errText = (e: unknown) => errorText(e);
const initialsOf = (name?: string) =>
  name?.trim()
    ? name.trim().split(/\s+/).slice(-2).map((word) => word[0]?.toUpperCase() ?? "").join("")
    : null;

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
  const customerOf = useCustomerLookup(contract.tenants.map((t) => t.customerId));
  const defaultJoinedAt = contract.startDate > todayVN() ? contract.startDate : todayVN();
  const [form, setForm] = useState({ customerId: "", joinedAt: defaultJoinedAt });
  const [leaving, setLeaving] = useState<{ tenantId: Id; leftAt: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const active = contract.tenants.filter((t) => !t.leftAt);

  const add = async () => {
    const customerId = form.customerId.trim();
    if (!customerId) return setError("Chọn khách thuê từ danh sách.");
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
        <span className="text-sm text-muted">
          {active.length} người đang ở · {contract.tenants.length} người trong hợp đồng
        </span>
        {canWrite && contract.status === "ACTIVE" && (
          <button className="text-button !text-xs" onClick={() => { setAdding(!adding); setError(""); }}>
            <Icon name="plus" size={14} /> Thêm người ở
          </button>
        )}
      </div>
      {adding && (
        <div className="mb-4 rounded-xl border border-line bg-[#fafbf9] p-4">
          <div className="form-grid">
            <CustomerPicker
              value={form.customerId}
              onChange={(customerId) => setForm({ ...form, customerId })}
            />
            <Field label="Ngày vào ở">
              <input
                type="date"
                value={form.joinedAt}
                min={contract.startDate}
                onChange={(e) => setForm({ ...form, joinedAt: e.target.value })}
              />
            </Field>
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
            <span className="avatar-chip !h-9 !w-9">{initialsOf(customerOf(t.customerId)) ?? String(t.customerId).slice(-2)}</span>
            <div className="min-w-0 flex-1">
              <b className="text-sm">{customerOf(t.customerId) ?? `Khách #${t.customerId}`}</b>{" "}
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
          <Field label="Ngày rời đi">
            <input type="date" value={leaving.leftAt} onChange={(e) => setLeaving({ ...leaving, leftAt: e.target.value })} />
          </Field>
          <div className="mt-3 flex justify-end gap-2">
            <button className="secondary-button !h-9" onClick={() => setLeaving(null)}>Hủy</button>
            <button className="primary-button !h-9" disabled={busy || !leaving.leftAt} onClick={leave}>Xác nhận</button>
          </div>
        </div>
      )}
    </>
  );
}

function SignaturePanel({
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
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [depositVerified, setDepositVerified] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const tenantSignature = contract.signatures.find((s) => s.party === "TENANT") ?? null;
  const lessorSignature = contract.signatures.find((s) => s.party === "LESSOR") ?? null;
  const canSignNow = canWrite && contract.status === "DRAFT" && contract.signatureStatus === "AWAITING_LESSOR";

  const openPdf = async () => {
    setOpening(true);
    setError("");
    try {
      const blob = await contractsApi.documentBlob(contract.id);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      setError(`${errorText(e, "Không mở được hợp đồng PDF.")}`);
    } finally {
      setOpening(false);
    }
  };

  const sign = async () => {
    const deposit = contract.depositAmount ?? 0;
    if (deposit > 0 && !depositVerified) {
      return setError(`Vui lòng xác nhận bạn đã đối soát và nhận đủ ${vnd(deposit)} tiền cọc từ khách thuê trước khi ký.`);
    }
    if (!password.trim()) return setError("Nhập mật khẩu đăng nhập để xác nhận chữ ký.");
    if (!file) return setError("Vui lòng vẽ chữ ký bằng chuột hoặc chọn ảnh chữ ký.");
    if (!accepted) return setError("Đọc và đồng ý với nội dung hợp đồng trước khi ký.");
    setBusy(true);
    setError("");
    try {
      const { key } = await contractsApi.uploadSignatureImage(contract.id, file);
      await contractsApi.signElectronic(contract.id, {
        password,
        signatureImageKey: key,
        acceptedTerms: true,
        consentVersion: "v1",
      });
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
      return;
    }
    setBusy(false);
    setPassword("");
    setFile(null);
    setAccepted(false);
    setDepositVerified(false);
    if (fileInput.current) fileInput.current.value = "";
    toast("Đã ký hợp đồng");
    const reloaded = await refresh();
    notify("Đã ký hợp đồng", !reloaded);
  };

  return (
    <div className="mt-4 rounded-xl border border-line bg-[#fafbf9] p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <b>Hợp đồng PDF &amp; chữ ký điện tử</b>
        <Pill tone={signatureTone[contract.signatureStatus]}>{signatureLabel[contract.signatureStatus]}</Pill>
      </div>
      {contract.signatureDeadline && contract.status === "DRAFT" && (
        <p className="mt-1 text-xs text-muted">Hạn ký: {toVNTime(contract.signatureDeadline, true)} (48 giờ)</p>
      )}
      <div className="mt-2 space-y-1 text-xs text-muted">
        <div>
          Bên thuê:{" "}
          {tenantSignature
            ? <>đã ký lúc {toVNTime(tenantSignature.signedAt, true)}{tenantSignature.pdfSha256 ? ` · SHA-256 ${tenantSignature.pdfSha256.slice(0, 12)}…` : ""}</>
            : (contract.status === "ACTIVE" ? "Đã ký điện tử hợp lệ" : "chưa ký")}
        </div>
        <div>
          Bên cho thuê:{" "}
          {lessorSignature
            ? <>đã ký lúc {toVNTime(lessorSignature.signedAt, true)}{lessorSignature.pdfSha256 ? ` · SHA-256 ${lessorSignature.pdfSha256.slice(0, 12)}…` : ""}</>
            : (contract.status === "ACTIVE" ? "Đã ký điện tử hợp lệ" : "chưa ký")}
        </div>
        {contract.latestDocument && (
          <div>Bản PDF v{contract.latestDocument.version} · tạo lúc {toVNTime(contract.latestDocument.generatedAt, true)}</div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="secondary-button !h-9" disabled={opening} onClick={() => void openPdf()}>
          <Icon name="contract" size={15} /> {opening ? "Đang mở…" : "Xem hợp đồng PDF"}
        </button>
      </div>
      {contract.signatureStatus === "AWAITING_TENANT" && (
        <p className="mt-3 text-xs text-muted">Đang chờ khách thuê đọc và ký trước. Hợp đồng chỉ có hiệu lực sau khi cả hai bên ký.</p>
      )}
      {contract.signatureStatus === "DECLINED" && (
        <p className="mt-3 text-xs text-muted">Khách đã từ chối ký. Yêu cầu thuê đã được đưa về trạng thái đã xác minh để xử lý lại.</p>
      )}
      {contract.signatureStatus === "EXPIRED" && (
        <p className="mt-3 text-xs text-muted">Hợp đồng đã quá hạn ký nên bị hủy; phòng được trả về trạng thái có thể cho thuê.</p>
      )}
      {error && <div className="alert alert-error mt-3"><Icon name="shield" size={18} /><div>{error}</div></div>}
      {canSignNow && (
        <div className="mt-4 border-t border-line pt-3">
          <p className="mb-2 text-xs text-muted">Khách đã ký. Bên cho thuê ký sau để hợp đồng có hiệu lực.</p>
          {(contract.depositAmount ?? 0) > 0 && (
            <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              <div className="font-semibold flex items-center gap-1.5 mb-1">
                <Icon name="wallet" size={15} /> Đối soát tiền cọc trước khi ký: {vnd(contract.depositAmount ?? 0)}
              </div>
              <p className="text-amber-800 mb-2">
                Vui lòng kiểm tra biến động số dư tài khoản ngân hàng hoặc phiếu thu tiền mặt trước khi ký hoàn tất hợp đồng.
              </p>
              <label className="flex items-start gap-2 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={depositVerified}
                  onChange={(e) => setDepositVerified(e.target.checked)}
                />
                <span>Đã xác nhận nhận đủ {vnd(contract.depositAmount ?? 0)} tiền cọc từ khách thuê.</span>
              </label>
            </div>
          )}
          <div className="space-y-3">
            <Field label="Mật khẩu đăng nhập để xác nhận chữ ký">
              <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <div>
              <span className="mb-1 block font-semibold text-xs text-text">Chữ ký điện tử của bên cho thuê</span>
              <SignaturePad onChange={(f) => setFile(f)} onExport={(f) => setFile(f)} />
              {file && (
                <div className="mt-2 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-800">
                  <span className="font-medium flex items-center gap-1.5">
                    <Icon name="check" size={14} className="text-emerald-600" /> Đã sẵn sàng chữ ký: <span className="font-semibold underline">{file.name}</span>
                  </span>
                  <button
                    type="button"
                    className="text-xs font-semibold text-rose-600 hover:underline"
                    onClick={() => setFile(null)}
                  >
                    Xóa
                  </button>
                </div>
              )}
            </div>
          </div>
          <label className="mt-3 flex items-start gap-2 text-xs text-muted">
            <input type="checkbox" className="mt-0.5" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
            <span>Tôi đã đọc hợp đồng PDF và đồng ý ký điện tử với nội dung trên.</span>
          </label>
          <div className="mt-3 flex justify-end">
            <button
              className="primary-button !h-9"
              disabled={busy || ((contract.depositAmount ?? 0) > 0 && !depositVerified)}
              onClick={() => void sign()}
            >
              <Icon name="check" size={15} /> {busy ? "Đang ký…" : "Ký hợp đồng"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({
  contract,
  loading,
  error,
  moveOut,
  onNavigateRequests,
}: {
  contract: ContractDetail | null;
  loading: boolean;
  error: string;
  moveOut: MoveOutRequest | null;
  onNavigateRequests: () => void;
}) {
  const [tab, setTab] = useState("Thông tin");
  const [actionError, setActionError] = useState("");
  const [openingPdf, setOpeningPdf] = useState(false);

  const openPdf = async () => {
    if (!contract) return;
    setOpeningPdf(true);
    setActionError("");
    try {
      const blob = await contractsApi.documentBlob(contract.id);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      setActionError(errorText(e, "Không mở được hợp đồng PDF."));
    } finally {
      setOpeningPdf(false);
    }
  };

  const roomOf = useRoomLookup([contract?.roomId]);
  const buildingOf = useBuildingLookup([contract?.buildingId]);
  const customerOf = useCustomerLookup([
    contract?.customerId,
    ...(contract?.tenants ?? []).map((t) => t.customerId),
  ]);

  if (loading) return <div className="py-10 text-center text-sm text-muted">Đang tải chi tiết…</div>;
  if (error) return <div className="alert alert-error"><Icon name="shield" size={18} /><div>{error}</div></div>;
  if (!contract) return null;

  return (
    <>
      <div className="mb-5"><Tabs items={["Thông tin", "Người ở"]} value={tab} onChange={setTab} /></div>
      {actionError && <div className="alert alert-error mb-4"><Icon name="shield" size={18} /><div>{actionError}</div></div>}
      {tab === "Thông tin" && (
        <>
          <div className="kv">
            <div><span>Mã hợp đồng</span><b>#{contract.id}</b></div>
            <div><span>Yêu cầu thuê</span><b>{contract.rentalRequestId ? `#${contract.rentalRequestId}` : "—"}</b></div>
            <div><span>Mã khách đứng tên</span><b>{customerOf(contract.customerId) ?? `#${contract.customerId}`}</b></div>
            <div><span>Phòng</span><b>{roomOf(contract.roomId)?.code ?? `#${contract.roomId}`}</b></div>
            <div><span>Tòa nhà</span><b>{buildingOf(contract.buildingId) ?? `#${contract.buildingId}`}</b></div>
            <div><span>Giá thuê</span><b>{contract.rentAmount == null ? "—" : vnd(contract.rentAmount)}</b></div>
            <div>
              <span>Tiền cọc</span>
              <b>
                {contract.depositAmount == null ? "—" : vnd(contract.depositAmount)}
                <span className="ml-1 text-[11px] font-normal text-muted">(Giữ đến hết HĐ)</span>
              </b>
            </div>
            {contract.electricityPrice != null && <div><span>Giá điện</span><b>{vnd(contract.electricityPrice)}/kWh</b></div>}
            {contract.waterPrice != null && (
              <div><span>Giá nước</span><b>{vnd(contract.waterPrice)}{contract.waterUnit ? ` ${waterUnitLabel[contract.waterUnit] ?? contract.waterUnit}` : ""}</b></div>
            )}
            {contract.paymentMethod && <div><span>Thanh toán</span><b>{paymentMethodLabel[contract.paymentMethod] ?? contract.paymentMethod}</b></div>}
            {contract.paymentDueDay != null && <div><span>Hạn thanh toán</span><b>Ngày {contract.paymentDueDay} hằng tháng</b></div>}
            {contract.minTermMonths != null && <div><span>Thời hạn hợp đồng</span><b>{contract.minTermMonths} tháng</b></div>}
            {contract.availableFrom && <div><span>Có thể vào</span><b>{fmtDate(contract.availableFrom)}</b></div>}
            <div><span>Trạng thái</span><b><StatusPill status={contract.status} /></b></div>
            <div><span>Ký điện tử</span><b><Pill tone={signatureTone[contract.signatureStatus]}>{signatureLabel[contract.signatureStatus]}</Pill></b></div>
            {contract.signatureDeadline && <div><span>Hạn ký</span><b>{toVNTime(contract.signatureDeadline, true)}</b></div>}
            <div><span>Bắt đầu</span><b>{fmtDate(contract.startDate)}</b></div>
            <div><span>Kết thúc</span><b>{fmtDate(contract.endDate)}</b></div>
            <div><span>Tạo lúc</span><b>{toVNTime(contract.createdAt, true)}</b></div>
            {contract.renewedFromContractId != null && (
              <div><span>Gia hạn từ</span><b>Hợp đồng #{contract.renewedFromContractId}</b></div>
            )}
            {contract.terminationReason && <div className="span-2"><span>Lý do chấm dứt</span><b>{contract.terminationReason}</b></div>}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-[#fafbf9] p-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                <Icon name="contract" size={18} />
              </div>
              <div>
                <div className="text-xs font-semibold text-text">Văn bản hợp đồng thuê (PDF)</div>
                <div className="text-[11px] text-muted">
                  {contract.latestDocument
                    ? `Bản PDF v${contract.latestDocument.version} · tạo lúc ${toVNTime(contract.latestDocument.generatedAt, true)}`
                    : (contract.status === "ACTIVE" ? "Đã ký điện tử hợp lệ hai bên" : "Tài liệu số hóa hợp đồng kèm chữ ký điện tử")}
                </div>
              </div>
            </div>
            <button
              type="button"
              className="primary-button !h-8 !px-3.5 text-xs font-medium"
              disabled={openingPdf}
              onClick={() => void openPdf()}
            >
              <Icon name="contract" size={14} /> {openingPdf ? "Đang mở…" : "Xem hợp đồng PDF"}
            </button>
          </div>

          {contract.status === "DRAFT" && contract.signatureStatus === "NOT_READY" && (
            <div className="alert alert-info mt-4">
              <Icon name="contract" size={18} />
              Hợp đồng nháp — kiểm tra và chỉnh sửa đầy đủ điều khoản, thông tin hai bên trước khi bấm “Gửi khách ký”. Sau khi gửi, hợp đồng tạm khóa cho đến khi hai bên ký xong.
            </div>
          )}
          {contract.status === "DRAFT" && contract.signatureStatus !== "NOT_READY" && (
            <div className="alert alert-info mt-4">
              <Icon name="contract" size={18} />
              Hợp đồng nháp điện tử — xem PDF, hai bên ký lần lượt (khách trước, bên cho thuê sau). Hợp đồng chỉ có hiệu lực sau khi cả hai bên ký.
            </div>
          )}
          {contract.status === "ACTIVE" && contract.terminationReason && (
            <div className="alert alert-info mt-4">
              <Icon name="contract" size={18} />
              Đã lên lịch chấm dứt vào {fmtDate(contract.endDate)}. Hợp đồng chỉ chuyển sang “Đã chấm dứt” khi tới ngày này.
            </div>
          )}

          {moveOut && (
            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-950 flex flex-wrap items-center justify-between gap-3 shadow-xs">
              <div>
                <div className="font-bold text-amber-900 flex items-center gap-1.5 text-sm">
                  <Icon name="door" size={16} />
                  Hợp đồng có yêu cầu trả phòng #{moveOut.id}
                </div>
                <div className="text-amber-800 mt-1">
                  Ngày hẹn dọn đi: <b>{fmtDate(moveOut.expectedMoveOutDate)}</b>
                  {moveOut.reason ? ` · Lý do: “${moveOut.reason}”` : ""}
                </div>
              </div>
              <button
                type="button"
                className="primary-button !h-8 !px-3 text-xs font-semibold !bg-teal-700 hover:!bg-teal-800 text-white"
                onClick={onNavigateRequests}
              >
                Xét duyệt &amp; Hoàn cọc tại trang Yêu cầu →
              </button>
            </div>
          )}
        </>
      )}
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
  const [counts, setCounts] = useState<{ active: number | null; draft: number | null; terminated: number | null; ended: number | null } | null>(null);
  const [allMoveOuts, setAllMoveOuts] = useState<MoveOutRequest[]>([]);
  const [openId, setOpenId] = useState<Id | null>(null);
  const [detail, setDetail] = useState<ContractDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [confirm, setConfirm] = useState<"draft" | "terminate" | null>(null);
  const [form, setForm] = useState({
    startDate: "",
    endDate: "",
    rentAmount: "",
    depositAmount: "",
    electricityPrice: "",
    waterPrice: "",
    waterUnit: "",
    paymentMethod: "",
    paymentDueDay: "",
    minTermMonths: "",
    availableFrom: "",
    roomNumber: "",
    buildingName: "",
    roomAddress: "",
    lessorName: "",
    lessorDateOfBirth: "",
    lessorIdNumber: "",
    lessorIdIssueDate: "",
    lessorIdIssuePlace: "",
    lessorPhone: "",
    lessorAddress: "",
    tenantFullName: "",
    tenantDateOfBirth: "",
    tenantGender: "",
    tenantPhone: "",
    tenantEmail: "",
    tenantPermanentAddress: "",
    tenantOccupation: "",
    tenantCccdNumber: "",
    tenantCccdIssueDate: "",
    tenantCccdIssuePlace: "",
    terminationDate: todayVN(),
    reason: "",
  });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [reloadWarning, setReloadWarning] = useState("");
  const [toast, show] = useToast();

  const roomOf = useRoomLookup([...rows.map((r) => r.roomId), detail?.roomId]);
  const buildingOf = useBuildingLookup([...rows.map((r) => r.buildingId), detail?.buildingId]);
  const customerOf = useCustomerLookup([
    ...rows.map((r) => r.customerId),
    detail?.customerId,
    ...(detail?.tenants ?? []).map((t) => t.customerId),
  ]);

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
      const [active, draft, term, ended] = await Promise.all([
        contractsApi.list({ status: "ACTIVE", page: 0, size: 1 }),
        contractsApi.list({ status: "DRAFT", page: 0, size: 1 }),
        contractsApi.list({ status: "TERMINATED", page: 0, size: 1 }),
        contractsApi.list({ status: "ENDED", page: 0, size: 1 }),
      ]);
      setCounts({
        active: active.totalElements,
        draft: draft.totalElements,
        terminated: term.totalElements,
        ended: ended.totalElements,
      });
    } catch {
      setCounts(null);
      ok = false;
    }

    if (canWrite) {
      try {
        const moRes = await contractsApi.moveOuts({ size: 100 });
        setAllMoveOuts(moRes.content);
      } catch {
        setAllMoveOuts([]);
      }
    }
    return ok;
  }, [canWrite]);

  const loadDetail = useCallback(async (id: Id, keepOnError = false) => {
    setDetailLoading(true);
    setDetailError("");
    try {
      setDetail(await contractsApi.detail(id));
      return true;
    } catch (e) {
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

  const refresh = useCallback(async () => {
    const tasks: Promise<unknown>[] = [loadList(), loadSide()];
    if (openId != null) tasks.push(loadDetail(openId, true));
    const results = await Promise.all(tasks);
    return results.every(Boolean);
  }, [loadList, loadSide, loadDetail, openId]);

  const notify = (message: string, reloadFailed: boolean) => {
    if (reloadFailed) setReloadWarning(`${message}, nhưng dữ liệu chưa tải lại được.`);
    else setReloadWarning("");
  };

  const closeDrawer = () => {
    setOpenId(null);
    setDetail(null);
    setConfirm(null);
    setActionError("");
    setReloadWarning("");
  };

  const formFromContract = (c: Contract): typeof form => {
    const d = c as Partial<ContractDetail>;
    return {
      startDate: c.startDate ?? "",
      endDate: c.endDate ?? "",
      rentAmount: formatMoneyInput(c.rentAmount),
      depositAmount: formatMoneyInput(c.depositAmount),
      electricityPrice: formatMoneyInput(d.electricityPrice ?? null),
      waterPrice: formatMoneyInput(d.waterPrice ?? null),
      waterUnit: d.waterUnit ?? "",
      paymentMethod: d.paymentMethod ?? "",
      paymentDueDay: d.paymentDueDay?.toString() ?? "",
      minTermMonths: d.minTermMonths?.toString() ?? "",
      availableFrom: d.availableFrom ?? "",
      roomNumber: d.roomNumber ?? "",
      buildingName: d.buildingName ?? "",
      roomAddress: d.roomAddress ?? "",
      lessorName: d.lessorName ?? "",
      lessorDateOfBirth: d.lessorDateOfBirth ?? "",
      lessorIdNumber: d.lessorIdNumber ?? "",
      lessorIdIssueDate: d.lessorIdIssueDate ?? "",
      lessorIdIssuePlace: d.lessorIdIssuePlace ?? "",
      lessorPhone: d.lessorPhone ?? "",
      lessorAddress: d.lessorAddress ?? "",
      tenantFullName: d.tenantFullName ?? "",
      tenantDateOfBirth: d.tenantDateOfBirth ?? "",
      tenantGender: d.tenantGender ?? "",
      tenantPhone: d.tenantPhone ?? "",
      tenantEmail: d.tenantEmail ?? "",
      tenantPermanentAddress: d.tenantPermanentAddress ?? "",
      tenantOccupation: d.tenantOccupation ?? "",
      tenantCccdNumber: d.tenantCccdNumber ?? "",
      tenantCccdIssueDate: d.tenantCccdIssueDate ?? "",
      tenantCccdIssuePlace: d.tenantCccdIssuePlace ?? "",
      terminationDate: terminationBounds(c).clamp(todayVN()),
      reason: "",
    };
  };

  const openDetail = (c: Contract) => {
    setConfirm(null);
    setActionError("");
    setReloadWarning("");
    setForm(formFromContract(c));
    setOpenId(c.id);
  };

  // After the detail request returns, refill the form with the full snapshot (identity, address,
  // utility terms). The list row is only a summary and would otherwise blank those fields.
  useEffect(() => {
    if (detail) setForm(formFromContract(detail));
  }, [detail]);

  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const contractId = searchParams.get("contractId");
    if (!contractId) return;
    setOpenId(contractId);
    const next = new URLSearchParams(searchParams);
    next.delete("contractId");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const runAction = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true);
    setActionError("");
    const ok = await runMutation(fn, refresh, (reloadFailed) => { setConfirm(null); show(msg); notify(msg, reloadFailed); }, setActionError);
    if (ok) setConfirm(null);
    setBusy(false);
  };

  const bounds = detail ? terminationBounds(detail) : null;
  const terminationDate = form.terminationDate;
  const terminationValid = !!bounds && bounds.valid(terminationDate);
  const rentAmount = parseMoneyInput(form.rentAmount);
  const depositAmount = form.depositAmount.trim() ? parseMoneyInput(form.depositAmount) : null;
  const optionalNumber = (raw: string) => (raw.trim() ? Number(raw) : null);
  const optionalMoney = (raw: string) => (raw.trim() ? parseMoneyInput(raw) : null);
  const electricityPrice = optionalMoney(form.electricityPrice);
  const waterPrice = optionalMoney(form.waterPrice);
  const paymentDueDay = optionalNumber(form.paymentDueDay);
  const minTermMonths = optionalNumber(form.minTermMonths);
  const positiveOrNull = (value: number | null) => value == null || (Number.isInteger(value) && value >= 0);
  const draftValid = !!form.startDate
    && (!form.endDate || form.endDate > form.startDate)
    && Number.isInteger(rentAmount) && rentAmount > 0
    && (depositAmount == null || (Number.isInteger(depositAmount) && depositAmount >= 0))
    && positiveOrNull(electricityPrice)
    && positiveOrNull(waterPrice)
    && (paymentDueDay == null || (Number.isInteger(paymentDueDay) && paymentDueDay >= 1 && paymentDueDay <= 28))
    && (minTermMonths == null || (Number.isInteger(minTermMonths) && minTermMonths > 0));

  const updateDraft = () => {
    if (!detail) return;
    const textOrNull = (value: string) => (value.trim() ? value.trim() : null);
    return runAction(
      () => contractsApi.updateDraft(detail.id, {
        startDate: form.startDate,
        endDate: form.endDate || null,
        rentAmount,
        depositAmount,
        electricityPrice,
        waterPrice,
        waterUnit: form.waterUnit || null,
        paymentMethod: form.paymentMethod || null,
        paymentDueDay,
        minTermMonths,
        availableFrom: form.availableFrom || null,
        roomNumber: textOrNull(form.roomNumber),
        buildingName: textOrNull(form.buildingName),
        roomAddress: textOrNull(form.roomAddress),
        lessorName: textOrNull(form.lessorName),
        lessorDateOfBirth: form.lessorDateOfBirth || null,
        lessorIdNumber: textOrNull(form.lessorIdNumber),
        lessorIdIssueDate: form.lessorIdIssueDate || null,
        lessorIdIssuePlace: textOrNull(form.lessorIdIssuePlace),
        lessorPhone: textOrNull(form.lessorPhone),
        lessorAddress: textOrNull(form.lessorAddress),
        tenantFullName: textOrNull(form.tenantFullName),
        tenantDateOfBirth: form.tenantDateOfBirth || null,
        tenantGender: textOrNull(form.tenantGender),
        tenantPhone: textOrNull(form.tenantPhone),
        tenantEmail: textOrNull(form.tenantEmail),
        tenantPermanentAddress: textOrNull(form.tenantPermanentAddress),
        tenantOccupation: textOrNull(form.tenantOccupation),
        tenantCccdNumber: textOrNull(form.tenantCccdNumber),
        tenantCccdIssueDate: form.tenantCccdIssueDate || null,
        tenantCccdIssuePlace: textOrNull(form.tenantCccdIssuePlace),
      }),
      "Đã cập nhật hợp đồng nháp",
    );
  };

  const currentMoveOut = detail ? allMoveOuts.find((m) => idStr(m.contractId) === idStr(detail.id)) ?? null : null;

  return (
    <>
      <PageHead
        eyebrow="Pháp lý"
        title="Quản lý hợp đồng"
        desc="Theo dõi và quản lý toàn bộ hợp đồng thuê phòng: nháp, đang hiệu lực, đã kết thúc, đã thanh lý. Các yêu cầu trả phòng và gia hạn được tập trung xét duyệt tại trang Yêu cầu."
        actions={canCreateDraft ? (
          <button className="cx-btn" onClick={() => navigate("/admin/contracts/new-draft")}>
            <Icon name="plus" size={16} /> Tạo hợp đồng nháp
          </button>
        ) : undefined}
      />

      <section className="stats-grid mb-6">
        <MiniStat
          label="Tất cả hợp đồng"
          value={counts ? String((counts.active ?? 0) + (counts.draft ?? 0) + (counts.terminated ?? 0) + (counts.ended ?? 0)) : "—"}
          note="Toàn bộ hợp đồng trên hệ thống"
        />
        <MiniStat
          label="Đang hiệu lực (ACTIVE)"
          value={counts?.active != null ? String(counts.active) : "—"}
          note="Hợp đồng đang thực hiện"
          tone="teal"
        />
        <MiniStat
          label="Hợp đồng nháp (DRAFT)"
          value={counts?.draft != null ? String(counts.draft) : "—"}
          note="Chờ hoàn tất ký kết"
          tone="violet"
        />
        <MiniStat
          label="Đã kết thúc / Chấm dứt"
          value={counts ? String((counts.terminated ?? 0) + (counts.ended ?? 0)) : "—"}
          note="Đã thanh lý hoặc hết hạn"
          tone="slate"
        />
      </section>

      <article className="panel">
        <div className="toolbar">
          <Tabs items={TABS.map((t) => t.label)} value={tab} onChange={(v) => { setTab(v); setPage(0); }} />
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Mã HĐ</th>
                <th>Khách thuê</th>
                <th>Phòng · Tòa</th>
                <th>Thời hạn</th>
                <th className="text-right">Giá thuê</th>
                <th className="text-right">Tiền cọc</th>
                <th>Trạng thái</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={8} className="py-8 text-center text-sm text-muted">Đang tải hợp đồng…</td></tr>}
              {!loading && error && (
                <tr>
                  <td colSpan={8} className="py-6">
                    <div className="alert alert-error"><Icon name="shield" size={18} /><div>{error}</div></div>
                    <div className="mt-3 text-center"><button className="secondary-button !h-9" onClick={() => void loadList()}>Thử lại</button></div>
                  </td>
                </tr>
              )}
              {!loading && !error && rows.length === 0 && (
                <tr><td colSpan={8} className="py-10 text-center text-sm text-muted">Không có hợp đồng nào ở trạng thái này.</td></tr>
              )}
              {!loading && !error && rows.map((r) => {
                const mo = allMoveOuts.find((m) => idStr(m.contractId) === idStr(r.id));
                return (
                  <tr key={r.id} className="cursor-pointer" onClick={() => openDetail(r)}>
                    <td className="font-mono text-xs font-bold">
                      #{r.id}
                      {r.renewedFromContractId != null && (
                        <span className="block mt-1 text-[10px] font-semibold text-teal-800 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded w-fit">
                          Gia hạn từ #{r.renewedFromContractId}
                        </span>
                      )}
                    </td>
                    <td>
                      <b>{customerOf(r.customerId) ?? `Khách #${r.customerId}`}</b>
                      {r.rentalRequestId != null && (
                        <div className="sub text-[11px] text-muted">Từ yêu cầu thuê #{r.rentalRequestId}</div>
                      )}
                      {mo && (
                        <div className="text-[11px] font-semibold text-amber-700 mt-0.5">
                          Có YC trả phòng ({mo.status})
                        </div>
                      )}
                    </td>
                    <td className="text-[13px]">
                      Phòng {roomOf(r.roomId)?.code ?? `#${r.roomId}`} · {buildingOf(r.buildingId) ?? `Tòa #${r.buildingId}`}
                    </td>
                    <td className="whitespace-nowrap text-xs font-medium">
                      {fmtDate(r.startDate)} → {fmtDate(r.endDate)}
                    </td>
                    <td className="text-right font-bold text-text">
                      {r.rentAmount == null ? "—" : vnd(r.rentAmount)}
                    </td>
                    <td className="text-right text-muted">
                      <div>{r.depositAmount == null ? "—" : vnd(r.depositAmount)}</div>
                      <span className="text-[10px] text-slate-500">Giữ đến hết HĐ</span>
                    </td>
                    <td>
                      <div className="flex flex-col gap-1 items-start">
                        <StatusPill status={r.status} />
                        {r.status === "DRAFT" && (
                          <span className="text-[10px] font-medium text-slate-600">
                            {signatureLabel[r.signatureStatus]}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <button className="text-button">
                        Chi tiết <Icon name="chevron" size={13} />
                      </button>
                    </td>
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
        eyebrow={detail ? `Phòng ${roomOf(detail.roomId)?.code ?? `#${detail.roomId}`} · ${buildingOf(detail.buildingId) ?? `Tòa #${detail.buildingId}`}` : undefined}
        title={`Hợp đồng #${openId ?? ""}`}
        onClose={closeDrawer}
        footer={detail && canWrite ? (
          confirm ? (
            <>
              <div className="mr-auto self-center">
                {confirm === "draft" ? (
                  <div className="form-grid">
                    <p className="span-2 text-xs text-muted">
                      Chỉ cập nhật điều khoản của hợp đồng nháp #{detail.id}. Sau khi cập nhật, hai bên sẽ ký theo nội dung mới.
                    </p>
                    <Field label="Ngày bắt đầu">
                      <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
                    </Field>
                    <Field label="Ngày kết thúc" error={form.endDate && form.endDate <= form.startDate ? "Ngày kết thúc phải sau ngày bắt đầu." : undefined}>
                      <input type="date" value={form.endDate} min={form.startDate || undefined} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
                    </Field>
                    <Field label="Giá thuê (VNĐ)" hint={form.rentAmount ? `${parseMoneyInput(form.rentAmount).toLocaleString("vi-VN")} ₫` : undefined}>
                      <input inputMode="numeric" value={form.rentAmount} onChange={(e) => setForm({ ...form, rentAmount: formatMoneyInput(e.target.value) })} />
                    </Field>
                    <Field label="Tiền cọc (VNĐ)" hint={form.depositAmount ? `${parseMoneyInput(form.depositAmount).toLocaleString("vi-VN")} ₫ (giữ đến khi hết HĐ)` : undefined}>
                      <input inputMode="numeric" value={form.depositAmount} onChange={(e) => setForm({ ...form, depositAmount: formatMoneyInput(e.target.value) })} />
                    </Field>
                    <Field label="Giá điện (VNĐ/kWh)" hint={form.electricityPrice ? `${parseMoneyInput(form.electricityPrice).toLocaleString("vi-VN")} ₫` : undefined}>
                      <input inputMode="numeric" value={form.electricityPrice} onChange={(e) => setForm({ ...form, electricityPrice: formatMoneyInput(e.target.value) })} />
                    </Field>
                    <Field label="Giá nước (VNĐ)" hint={form.waterPrice ? `${parseMoneyInput(form.waterPrice).toLocaleString("vi-VN")} ₫` : undefined}>
                      <input inputMode="numeric" value={form.waterPrice} onChange={(e) => setForm({ ...form, waterPrice: formatMoneyInput(e.target.value) })} />
                    </Field>
                    <Field label="Đơn vị nước">
                      <select value={form.waterUnit} onChange={(e) => setForm({ ...form, waterUnit: e.target.value })}>
                        <option value="">— Giữ nguyên —</option>
                        <option value="M3">Theo m³</option>
                        <option value="PERSON">Theo người</option>
                      </select>
                    </Field>
                    <Field label="Hình thức trả">
                      <select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
                        <option value="">— Giữ nguyên —</option>
                        <option value="CASH">Tiền mặt</option>
                        <option value="BANK_TRANSFER">Chuyển khoản</option>
                      </select>
                    </Field>
                    <Field label="Ngày đến hạn (1–28)">
                      <input type="number" min="1" max="28" step="1" value={form.paymentDueDay} onChange={(e) => setForm({ ...form, paymentDueDay: e.target.value })} />
                    </Field>
                    <Field label="Thời hạn hợp đồng (tháng)">
                      <input type="number" min="1" step="1" value={form.minTermMonths || 12} onChange={(e) => setForm({ ...form, minTermMonths: e.target.value })} />
                    </Field>
                    <Field label="Có hiệu lực từ ngày (availableFrom)">
                      <input type="date" value={form.availableFrom} onChange={(e) => setForm({ ...form, availableFrom: e.target.value })} />
                    </Field>

                    <p className="span-2 m-0 mt-2 text-xs font-bold uppercase tracking-wide text-teal-800">
                      Phòng &amp; địa chỉ in trên hợp đồng
                    </p>
                    <Field label="Số phòng">
                      <input value={form.roomNumber} onChange={(e) => setForm({ ...form, roomNumber: e.target.value })} placeholder="Ví dụ: P101" />
                    </Field>
                    <Field label="Tên tòa nhà">
                      <input value={form.buildingName} onChange={(e) => setForm({ ...form, buildingName: e.target.value })} />
                    </Field>
                    <Field label="Địa chỉ phòng / tòa nhà">
                      <input value={form.roomAddress} onChange={(e) => setForm({ ...form, roomAddress: e.target.value })} />
                    </Field>

                    <p className="span-2 m-0 mt-2 text-xs font-bold uppercase tracking-wide text-teal-800">
                      Bên A – Bên cho thuê
                    </p>
                    <Field label="Họ tên Bên A">
                      <input value={form.lessorName} onChange={(e) => setForm({ ...form, lessorName: e.target.value })} />
                    </Field>
                    <Field label="Ngày sinh Bên A">
                      <input type="date" value={form.lessorDateOfBirth} onChange={(e) => setForm({ ...form, lessorDateOfBirth: e.target.value })} />
                    </Field>
                    <Field label="Số CCCD Bên A">
                      <input value={form.lessorIdNumber} onChange={(e) => setForm({ ...form, lessorIdNumber: e.target.value })} />
                    </Field>
                    <Field label="Ngày cấp CCCD Bên A">
                      <input type="date" value={form.lessorIdIssueDate} onChange={(e) => setForm({ ...form, lessorIdIssueDate: e.target.value })} />
                    </Field>
                    <Field label="Nơi cấp CCCD Bên A">
                      <input value={form.lessorIdIssuePlace} onChange={(e) => setForm({ ...form, lessorIdIssuePlace: e.target.value })} />
                    </Field>
                    <Field label="Số điện thoại Bên A">
                      <input value={form.lessorPhone} onChange={(e) => setForm({ ...form, lessorPhone: e.target.value })} />
                    </Field>
                    <Field label="Địa chỉ thường trú Bên A">
                      <input value={form.lessorAddress} onChange={(e) => setForm({ ...form, lessorAddress: e.target.value })} />
                    </Field>

                    <p className="span-2 m-0 mt-2 text-xs font-bold uppercase tracking-wide text-teal-800">
                      Bên B – Bên thuê
                    </p>
                    <Field label="Họ tên Bên B">
                      <input value={form.tenantFullName} onChange={(e) => setForm({ ...form, tenantFullName: e.target.value })} />
                    </Field>
                    <Field label="Ngày sinh Bên B">
                      <input type="date" value={form.tenantDateOfBirth} onChange={(e) => setForm({ ...form, tenantDateOfBirth: e.target.value })} />
                    </Field>
                    <Field label="Giới tính Bên B">
                      <input value={form.tenantGender} onChange={(e) => setForm({ ...form, tenantGender: e.target.value })} />
                    </Field>
                    <Field label="Số điện thoại Bên B">
                      <input value={form.tenantPhone} onChange={(e) => setForm({ ...form, tenantPhone: e.target.value })} />
                    </Field>
                    <Field label="Email Bên B">
                      <input type="email" value={form.tenantEmail} onChange={(e) => setForm({ ...form, tenantEmail: e.target.value })} />
                    </Field>
                    <Field label="Nghề nghiệp Bên B">
                      <input value={form.tenantOccupation} onChange={(e) => setForm({ ...form, tenantOccupation: e.target.value })} />
                    </Field>
                    <Field label="Địa chỉ thường trú Bên B">
                      <input value={form.tenantPermanentAddress} onChange={(e) => setForm({ ...form, tenantPermanentAddress: e.target.value })} />
                    </Field>
                    <Field label="Số CCCD Bên B">
                      <input value={form.tenantCccdNumber} onChange={(e) => setForm({ ...form, tenantCccdNumber: e.target.value })} />
                    </Field>
                    <Field label="Ngày cấp CCCD Bên B">
                      <input type="date" value={form.tenantCccdIssueDate} onChange={(e) => setForm({ ...form, tenantCccdIssueDate: e.target.value })} />
                    </Field>
                    <Field label="Nơi cấp CCCD Bên B">
                      <input value={form.tenantCccdIssuePlace} onChange={(e) => setForm({ ...form, tenantCccdIssuePlace: e.target.value })} />
                    </Field>
                  </div>
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
                disabled={busy || (confirm === "draft" ? !draftValid : !terminationValid || !form.reason.trim())}
                onClick={() =>
                  confirm === "draft"
                    ? updateDraft()
                    : runAction(() => contractsApi.terminate(detail.id, form.terminationDate, form.reason.trim()), "Đã ghi nhận ngày chấm dứt hợp đồng")
                }
              >
                Xác nhận
              </button>
            </>
          ) : (
            <>
              {detail.status === "DRAFT" && (
                <>
                  {detail.signatureStatus === "NOT_READY" && (
                    <button
                      className="secondary-button"
                      disabled={busy}
                      title="Chỉnh sửa điều khoản trước khi gửi khách ký"
                      onClick={() => {
                        setActionError("");
                        setForm((f) => ({
                          ...f,
                          rentAmount: formatMoneyInput(detail.rentAmount),
                          depositAmount: formatMoneyInput(detail.depositAmount),
                          electricityPrice: formatMoneyInput(detail.electricityPrice),
                          waterPrice: formatMoneyInput(detail.waterPrice),
                          waterUnit: detail.waterUnit ?? "",
                          paymentMethod: detail.paymentMethod ?? "",
                          paymentDueDay: detail.paymentDueDay?.toString() ?? "",
                          minTermMonths: detail.minTermMonths?.toString() ?? "",
                        }));
                        setConfirm("draft");
                      }}
                    >
                      Cập nhật điều khoản nháp
                    </button>
                  )}
                  {detail.signatureStatus === "NOT_READY" && detail.renewalRequestId != null && (
                    <button
                      className="primary-button"
                      disabled={busy}
                      title="Gửi bản hợp đồng gia hạn cho khách thuê ký điện tử"
                      onClick={() => runAction(() => contractsApi.sendRenewalDraft(detail.id), "Đã gửi hợp đồng gia hạn cho khách thuê ký")}
                    >
                      <Icon name="contract" size={15} /> Gửi khách ký
                    </button>
                  )}
                  {detail.signatureStatus === "NOT_READY" && detail.renewalRequestId == null && (
                    <>
                      <button
                        className="primary-button"
                        disabled={busy}
                        title="Gửi hợp đồng cho khách thuê ký điện tử (hạn ký 48 giờ)"
                        onClick={() =>
                          runAction(() => contractsApi.sendDraftForSignature(detail.id), "Đã gửi hợp đồng cho khách thuê ký")
                        }
                      >
                        <Icon name="contract" size={15} /> Gửi khách ký
                      </button>
                      <button
                        className="secondary-button"
                        disabled={busy}
                        title="Dùng khi khách đã ký bản giấy ngoài hệ thống"
                        onClick={() => runAction(() => contractsApi.sign(detail.id), "Hợp đồng đã được xác nhận ký thủ công")}
                      >
                        <Icon name="check" size={15} /> Xác nhận ký giấy
                      </button>
                    </>
                  )}
                </>
              )}
              {detail.status === "ACTIVE" && (
                <button
                  type="button"
                  className="secondary-button !text-rose-600 hover:!bg-rose-50"
                  onClick={() => {
                    setActionError("");
                    setConfirm("terminate");
                  }}
                >
                  Chấm dứt hợp đồng sớm…
                </button>
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
          moveOut={currentMoveOut}
          onNavigateRequests={() => {
            closeDrawer();
            navigate("/leads");
          }}
        />
        {detail && (
          <Occupants
            contract={detail}
            canWrite={canWrite}
            refresh={refresh}
            notify={notify}
            toast={show}
          />
        )}
        {detail && (
          <SignaturePanel
            contract={detail}
            canWrite={canWrite}
            refresh={refresh}
            notify={notify}
            toast={show}
          />
        )}
        {actionError && <div className="alert alert-error mt-4"><Icon name="shield" size={18} /><div>{actionError}</div></div>}
        {!canWrite && <div className="alert alert-info mt-4"><Icon name="shield" size={18} />Vai trò SALE chỉ được xem. Ký, gia hạn, chấm dứt và quản lý người ở do QUẢN LÝ/ADMIN thực hiện.</div>}
      </Drawer>
      {toast}
    </>
  );
}
