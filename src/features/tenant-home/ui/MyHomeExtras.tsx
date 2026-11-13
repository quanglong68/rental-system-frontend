import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { todayVN, vnd, useToast, SignaturePad, Icon } from "@/shared/ui";
import { errorText } from "@/shared/api/errors";
import { useAuth } from "@/features/auth";
import { contractsApi, type Contract, type ContractDetail, type MoveOutRequest, type RenewalRequest, type SignatureStatus } from "@/features/contracts/api/contractsApi";
import { billingApi, type Invoice, type RoomInvoice, type ContractService } from "@/api/billing";
import { bookingApi, type RoommatePost, type RoommateApplication } from "@/api/booking";
import { propertyApi } from "@/features/properties/api/propertyApi";
import { idStr, sameId, type Id } from "@/shared/lib/id";
import { useBuildingLookup, useCustomerLookup, useRoomLookup } from "@/shared/lib/refLabels";
import ChatStartButton from "@/features/chat/ui/ChatStartButton";

const ease = [0.22, 1, 0.36, 1] as const;
const initialsOf = (name?: string) =>
  name?.trim().split(/\s+/).slice(-2).map((word) => word[0]?.toUpperCase() ?? "").join("") || "?";
const reasons = ["Chuyển nơi làm việc", "Tìm phòng khác phù hợp hơn", "Về quê", "Lý do cá nhân", "Khác"];

const statusLabel: Record<Contract["status"], string> = {
  DRAFT: "Nháp",
  ACTIVE: "Đang hiệu lực",
  TERMINATED: "Đã chấm dứt",
  ENDED: "Đã kết thúc",
};
const statusClass: Record<Contract["status"], string> = {
  DRAFT: "mute",
  ACTIVE: "ok",
  TERMINATED: "bad",
  ENDED: "mute",
};
const moveOutLabel: Record<MoveOutRequest["status"], string> = {
  PENDING: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Bị từ chối",
  COMPLETED: "Đã hoàn tất",
};
const moveOutClass: Record<MoveOutRequest["status"], string> = {
  PENDING: "info",
  APPROVED: "ok",
  REJECTED: "bad",
  COMPLETED: "mute",
};
const invoiceStatusLabel: Record<Invoice["status"], string> = {
  UNPAID: "Chưa thanh toán",
  PARTIALLY_PAID: "Đã trả một phần",
  PAID: "Đã thanh toán",
  OVERDUE: "Quá hạn",
};
const invoiceStatusClass: Record<Invoice["status"], string> = {
  UNPAID: "info",
  PARTIALLY_PAID: "info",
  PAID: "ok",
  OVERDUE: "bad",
};
const signatureLabel: Record<SignatureStatus, string> = {
  NOT_READY: "Chờ bên cho thuê gửi hợp đồng",
  AWAITING_TENANT: "Chờ bạn ký",
  AWAITING_LESSOR: "Chờ bên cho thuê ký",
  COMPLETED: "Đã ký đủ hai bên",
  DECLINED: "Bạn đã từ chối ký",
  EXPIRED: "Quá hạn ký",
};
const signatureClass: Record<SignatureStatus, string> = {
  NOT_READY: "mute",
  AWAITING_TENANT: "info",
  AWAITING_LESSOR: "ok",
  COMPLETED: "ok",
  DECLINED: "bad",
  EXPIRED: "bad",
};
const paymentMethodLabel: Record<string, string> = { CASH: "Tiền mặt", BANK_TRANSFER: "Chuyển khoản", VNPAY: "VNPay" };
const waterUnitLabel: Record<string, string> = { M3: "theo m³", PERSON: "theo người" };

/** YYYY-MM-DD -> DD/MM/YYYY */
const fmtDate = (iso: string | null | undefined) => (iso ? iso.split("-").reverse().join("/") : "—");
const fmtDateField = (value: string | null | undefined) => {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString("vi-VN");
};
const fmtMoney = (n: number | null | undefined) => (n == null ? "—" : vnd(n));
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);

const addMonthsToISO = (isoDate: string, months: number) => {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + months, d));
  return date.toISOString().slice(0, 10);
};

const addDaysToISO = (isoDate: string, days: number) => {
  const date = new Date(Date.parse(`${isoDate}T00:00:00Z`) + days * 86400000);
  return date.toISOString().slice(0, 10);
};

export function CustomerSignatureCard({
  contract,
  toast,
  onChanged,
}: {
  contract: ContractDetail;
  toast: (m: string) => void;
  onChanged: () => Promise<void>;
}) {
  const [password, setPassword] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [depositConfirmed, setDepositConfirmed] = useState(false);
  const [showDepositVnpayModal, setShowDepositVnpayModal] = useState(false);
  const [payingDepositVnpay, setPayingDepositVnpay] = useState(false);
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");
  const [errorModal, setErrorModal] = useState<string | null>(null);
  const [declining, setDeclining] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const fileInput = useRef<HTMLInputElement | null>(null);

  const showErrorDialog = (msg: string) => {
    setError(msg);
    setErrorModal(msg);
  };

  const canSign = contract.status === "DRAFT" && contract.signatureStatus === "AWAITING_TENANT";
  const tenantSignature = contract.signatures.find((s) => s.party === "TENANT") ?? null;
  const lessorSignature = contract.signatures.find((s) => s.party === "LESSOR") ?? null;

  const openPdf = async () => {
    setOpening(true);
    setError("");
    setErrorModal(null);
    try {
      const blob = await contractsApi.documentBlob(contract.id);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      showErrorDialog(errorText(e, "Không mở được hợp đồng PDF."));
    } finally {
      setOpening(false);
    }
  };

  const sign = async () => {
    if (contract.depositAmount && contract.depositAmount > 0 && !contract.depositPaid && !depositConfirmed) {
      return showErrorDialog("Vui lòng thanh toán tiền cọc qua VNPay hoặc xác nhận đã chuyển tiền trước khi ký.");
    }
    if (!password.trim()) return showErrorDialog("Vui lòng nhập mật khẩu đăng nhập của bạn để xác nhận ký điện tử.");
    if (!file) return showErrorDialog("Vui lòng vẽ chữ ký bằng chuột hoặc chọn ảnh chữ ký.");
    if (!accepted) return showErrorDialog("Vui lòng đọc và tích đồng ý với nội dung hợp đồng trước khi ký.");
    setBusy(true);
    setError("");
    setErrorModal(null);
    try {
      const { key } = await contractsApi.uploadSignatureImage(contract.id, file);
      await contractsApi.signElectronic(contract.id, {
        password: password.trim(),
        signatureImageKey: key,
        acceptedTerms: accepted,
        depositConfirmed: depositConfirmed || undefined,
      });
      toast("Đã ký hợp đồng điện tử thành công!");
      setPassword("");
      setFile(null);
      setAccepted(false);
      setDepositConfirmed(false);
      await onChanged();
    } catch (e) {
      showErrorDialog(errorText(e, "Không ký được hợp đồng. Vui lòng kiểm tra lại mật khẩu hoặc liên hệ ban quản lý."));
    } finally {
      setBusy(false);
    }
  };

  const decline = async () => {
    if (!declineReason.trim()) {
      showErrorDialog("Vui lòng nhập lý do bạn từ chối ký hợp đồng.");
      return;
    }
    setBusy(true);
    setError("");
    setErrorModal(null);
    try {
      await contractsApi.declineSignature(contract.id, declineReason.trim());
      toast("Bạn đã từ chối ký hợp đồng.");
      setDeclining(false);
      setDeclineReason("");
      await onChanged();
    } catch (e) {
      showErrorDialog(errorText(e, "Không gửi được từ chối ký. Vui lòng thử lại sau."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Dialog Báo Lỗi To Rõ Nổi Bật Ra Màn Hình */}
      <AnimatePresence>
        {errorModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <motion.div
              className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-rose-200"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
            >
              <div className="flex items-center gap-3 text-rose-600">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-rose-100">
                  <Icon name="close" size={24} />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-slate-900">Thông báo ký hợp đồng</h4>
                  <span className="text-xs text-rose-500 font-medium">Chưa hoàn tất thao tác</span>
                </div>
              </div>

              <div className="mt-4 rounded-xl bg-rose-50/80 p-4 text-sm leading-relaxed text-rose-900 border border-rose-100">
                {errorModal}
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  className="cx-btn !h-10 !px-6 bg-slate-900 text-white hover:bg-slate-800"
                  onClick={() => setErrorModal(null)}
                >
                  Đã hiểu, thử lại
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
        <div>
          <span className="text-xs text-[#6b777d]">Trạng thái chữ ký:</span>
          <div className="font-semibold">{signatureLabel[contract.signatureStatus]}</div>
        </div>
        <button
          type="button"
          className="cx-btn ghost !h-9 text-xs"
          onClick={() => void openPdf()}
          disabled={opening}
        >
          {opening ? "Đang mở..." : "Xem văn bản hợp đồng PDF"}
        </button>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-[#6b777d]">Bên thuê (Bạn):</span>
          <span>{tenantSignature ? `Đã ký (${fmtDateField(tenantSignature.signedAt)})` : "Chưa ký"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[#6b777d]">Bên cho thuê (Chủ nhà):</span>
          <span>
            {lessorSignature
              ? `Đã ký (${fmtDateField(lessorSignature.signedAt)})`
              : contract.signatureStatus === "AWAITING_LESSOR"
                ? "Đang chờ bên cho thuê ký"
                : "Chờ bạn ký trước"}
          </span>
        </div>
        {(contract.depositAmount ?? 0) > 0 && (
          <div className="flex items-center justify-between pt-1 border-t border-line/60">
            <span className="text-[#6b777d]">Tiền đặt cọc ({vnd(contract.depositAmount ?? 0)}):</span>
            {contract.depositPaid ? (
              contract.depositPaymentMethod === "VNPAY" ? (
                <span className="font-semibold text-emerald-700">
                  Đã thanh toán qua VNPay{contract.depositTxnRef ? ` (${contract.depositTxnRef})` : ""}
                </span>
              ) : (
                <span className="font-semibold text-amber-700">
                  {contract.status === "ACTIVE" ? "Đã xác nhận chuyển khoản" : "Đã xác nhận CK · chờ quản lý đối soát"}
                </span>
              )
            ) : (
              <span className="font-semibold text-rose-700">Chưa thanh toán tiền cọc</span>
            )}
          </div>
        )}
      </div>

      {canSign && (
        <div className="mt-4 space-y-4 rounded-xl border border-teal-200 bg-teal-50/40 p-4">
          <h4 className="m-0 text-sm font-bold text-teal-900">Ký hợp đồng trực tuyến</h4>

          {contract.depositAmount && contract.depositAmount > 0 && (
            contract.depositPaid ? (
              <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-900">
                <div className="flex items-center justify-between font-semibold">
                  <span className="flex items-center gap-1.5">
                    <Icon name="check" size={15} className="text-emerald-600" />
                    {contract.depositPaymentMethod === "VNPAY"
                      ? "Đã thanh toán tiền cọc qua VNPay"
                      : "Đã ghi nhận xác nhận tiền cọc"}
                  </span>
                  <span className="text-emerald-700 text-sm">{vnd(contract.depositAmount)}</span>
                </div>
                <p className="mt-1 text-[11px] text-emerald-700 m-0">
                  Hệ thống đã xác nhận tiền cọc giữ phòng{contract.depositTxnRef ? ` (Mã GD: ${contract.depositTxnRef})` : ""}. Bạn có thể ký hợp đồng điện tử ngay bên dưới.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                <div className="flex items-center justify-between font-semibold">
                  <span>Tiền đặt cọc giữ phòng (giữ đến khi hết hợp đồng):</span>
                  <span className="text-amber-700 text-sm">{vnd(contract.depositAmount)}</span>
                </div>
                <p className="mt-1 text-[11px] text-amber-700 m-0">
                  Vui lòng thanh toán cọc trong vòng <b>2 ngày (48 giờ)</b> kể từ khi tạo nháp để hoàn tất ký kết và giữ phòng.
                </p>

                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    className="cx-btn !h-8 !px-3.5 text-xs bg-teal-700 hover:bg-teal-800 text-white font-semibold flex items-center gap-1.5"
                    onClick={() => setShowDepositVnpayModal(true)}
                  >
                    <Icon name="wallet" size={14} /> Thanh toán tiền cọc
                  </button>
                  <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                    <input
                      type="checkbox"
                      checked={depositConfirmed}
                      onChange={(e) => setDepositConfirmed(e.target.checked)}
                    />
                    <span>Tôi đã chuyển tiền cọc</span>
                  </label>
                </div>
              </div>
            )
          )}

          {showDepositVnpayModal && contract.depositAmount && contract.depositAmount > 0 && (
            <div
              className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in"
              role="dialog"
              aria-modal="true"
            >
              <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-100">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center shadow-inner">
                      <Icon name="wallet" size={18} />
                    </div>
                    <div>
                      <h3 className="m-0 text-base font-bold text-slate-900">
                        Thanh toán tiền cọc
                      </h3>
                      <p className="text-xs text-slate-500 m-0">
                        Hợp đồng #{contract.id} {contract.roomNumber ? `· Phòng ${contract.roomNumber}` : ""}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer border-0 bg-transparent"
                    onClick={() => setShowDepositVnpayModal(false)}
                  >
                    <Icon name="close" size={16} />
                  </button>
                </div>

                <div className="my-5 space-y-3">
                  <div className="rounded-2xl bg-teal-50/70 border border-teal-200/80 p-4 text-center">
                    <span className="text-xs font-medium text-teal-800 block mb-0.5">Số tiền đặt cọc cần thanh toán</span>
                    <span className="text-2xl font-black text-teal-950 tracking-tight">
                      {vnd(contract.depositAmount)}
                    </span>
                  </div>

                  <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3.5 space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Mã hợp đồng:</span>
                      <span className="font-mono font-bold text-slate-800">#{contract.id}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Nội dung:</span>
                      <b>Đặt cọc giữ phòng hợp đồng #{contract.id}</b>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-slate-200/60">
                      <span className="text-slate-500">Cổng thanh toán:</span>
                      <div className="flex items-center gap-1.5 font-bold text-teal-800">
                        <span className="w-2 h-2 rounded-full bg-teal-500" /> VNPay
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    disabled={payingDepositVnpay}
                    className="cx-btn !h-11 w-full bg-teal-700 hover:bg-teal-800 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-teal-800/20 disabled:opacity-60 cursor-pointer"
                    onClick={async () => {
                      try {
                        setPayingDepositVnpay(true);
                        const returnUrl =
                          (import.meta.env.VITE_VNPAY_RETURN_URL as string | undefined) ||
                          `${window.location.origin}/payment/vnpay-return`;
                        const res = await billingApi.createDepositVnpayUrl({
                          contractId: contract.id,
                          returnUrl,
                        });
                        if (res?.paymentUrl) {
                          window.location.href = res.paymentUrl;
                        } else {
                          setShowDepositVnpayModal(false);
                          showErrorDialog("Không thể khởi tạo đường dẫn thanh toán VNPay");
                        }
                      } catch (e) {
                        setShowDepositVnpayModal(false);
                        showErrorDialog("Không thể khởi tạo thanh toán VNPay: " + errorText(e, "Vui lòng thử lại."));
                      } finally {
                        setPayingDepositVnpay(false);
                      }
                    }}
                  >
                    {payingDepositVnpay ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Đang kết nối tới VNPay...</span>
                      </>
                    ) : (
                      <>
                        <Icon name="wallet" size={16} /> Thanh toán tiền cọc
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    className="cx-btn ghost !h-9 text-xs text-slate-500 hover:text-slate-700"
                    onClick={() => setShowDepositVnpayModal(false)}
                  >
                    Đóng
                  </button>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Chữ ký điện tử của bạn (Vẽ chuột hoặc tải ảnh chữ ký):
            </label>
            <SignaturePad
              width={360}
              height={140}
              penColor="#0f766e"
              onChange={(f) => setFile(f)}
              onExport={(f) => setFile(f)}
            />
            {file && (
              <div className="mt-2 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
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

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Mật khẩu đăng nhập để xác nhận:
            </label>
            <input
              type="password"
              className="cx-input w-full bg-white text-sm"
              placeholder="Nhập mật khẩu tài khoản của bạn"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Tôi đã đọc kỹ toàn bộ điều khoản hợp đồng và đồng ý ký kết điện tử với bên cho thuê.
            </span>
          </label>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              className="cx-btn flex-1 !h-10 text-sm bg-teal-700 hover:bg-teal-800"
              disabled={busy}
              onClick={() => void sign()}
            >
              {busy ? "Đang xử lý..." : "Xác nhận ký hợp đồng"}
            </button>
            <button
              type="button"
              className="cx-btn ghost !h-10 text-xs text-rose-700 hover:bg-rose-50"
              disabled={busy}
              onClick={() => setDeclining(!declining)}
            >
              Từ chối ký
            </button>
          </div>

          {declining && (
            <div className="mt-3 space-y-2 border-t border-rose-200 pt-3">
              <label className="block text-xs font-semibold text-rose-800">
                Lý do từ chối ký:
              </label>
              <textarea
                className="cx-input w-full bg-white text-xs"
                rows={2}
                placeholder="Nhập lý do không đồng ý điều khoản..."
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
              />
              <button
                type="button"
                className="cx-btn danger !h-8 text-xs"
                disabled={busy}
                onClick={() => void decline()}
              >
                Gửi từ chối ký
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function HomeExtras({
  activeTab = "billing",
  onTabChange,
}: {
  activeTab?: "billing" | "contracts" | "roommates";
  onTabChange?: (tab: "billing" | "contracts" | "roommates") => void;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [contracts, setContracts] = useState<Contract[] | null>(null);
  const [contractsError, setContractsError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<Id | null>(null);
  const [detail, setDetail] = useState<ContractDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const detailReq = useRef(0);

  const [contractServicesList, setContractServicesList] = useState<ContractService[]>([]);

  const [moveOuts, setMoveOuts] = useState<MoveOutRequest[] | null>(null);
  const [moveOutsError, setMoveOutsError] = useState<string | null>(null);
  const [renewalRequests, setRenewalRequests] = useState<RenewalRequest[]>([]);

  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [invoicesError, setInvoicesError] = useState<string | null>(null);
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
  const [roomInvoices, setRoomInvoices] = useState<RoomInvoice[] | null>(null);
  const [roomInvoicesError, setRoomInvoicesError] = useState<string | null>(null);

  const [roomCapacity, setRoomCapacity] = useState<number | null>(null);
  const [roomCapacityError, setRoomCapacityError] = useState<string | null>(null);
  const [payingVnpay, setPayingVnpay] = useState(false);

  // Roommate host state
  const [myRoommatePosts, setMyRoommatePosts] = useState<RoommatePost[]>([]);
  const [roommateApps, setRoommateApps] = useState<Record<string, RoommateApplication[]>>({});
  const [roommateBusyId, setRoommateBusyId] = useState<Id | null>(null);

  const roomOf = useRoomLookup((contracts ?? []).map((c) => c.roomId));
  const buildingOf = useBuildingLookup((contracts ?? []).map((c) => c.buildingId));

  const [date, setDate] = useState(todayVN);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [reloadWarning, setReloadWarning] = useState("");
  const [toast, show] = useToast();

  const loadRenewalRequests = useCallback(async () => {
    try {
      setRenewalRequests(await contractsApi.renewalRequestsMine());
    } catch {
      setRenewalRequests([]);
    }
  }, []);

  const loadContracts = useCallback(async () => {
    setContractsError(null);
    try {
      const list = await contractsApi.mine();
      setContracts(list);
      const urlParams = new URLSearchParams(window.location.search);
      const targetContractId = urlParams.get("contractId");
      const wantsSign = urlParams.get("action") === "sign";
      setSelectedId((current) => {
        if (targetContractId && list.some((c) => sameId(c.id, targetContractId))) {
          return list.find((c) => sameId(c.id, targetContractId))!.id;
        }
        if (current && list.some((c) => sameId(c.id, current))) {
          return current;
        }
        if (wantsSign) {
          const awaiting =
            list.find((c) => c.status === "DRAFT" && c.signatureStatus === "AWAITING_TENANT")
            ?? list.find((c) => c.status === "DRAFT");
          if (awaiting) return awaiting.id;
        }
        return (list.find((c) => c.status === "ACTIVE" && c.renewedFromContractId == null)
          ?? list.find((c) => c.status === "ACTIVE")
          ?? list[0])?.id ?? null;
      });
    } catch (e) {
      setContracts([]);
      setContractsError(errorText(e));
    }
  }, []);

  const loadMoveOuts = useCallback(async () => {
    setMoveOutsError(null);
    try {
      setMoveOuts(await contractsApi.moveOutsMine());
      return true;
    } catch (e) {
      setMoveOuts(null);
      setMoveOutsError(errorText(e));
      return false;
    }
  }, []);

  const loadInvoices = useCallback(async () => {
    setInvoicesError(null);
    try {
      const all: Invoice[] = [];
      let page = 0;
      while (page < 20) {
        const res = await billingApi.myInvoices({ page, size: 100 });
        all.push(...res.content);
        if (res.content.length === 0 || page + 1 >= res.totalPages) break;
        page += 1;
      }
      all.sort((a, b) => b.year - a.year || b.month - a.month);
      setInvoices(all);
    } catch (e) {
      setInvoices([]);
      setInvoicesError(errorText(e));
    }
  }, []);

  const loadRoomInvoices = useCallback(async () => {
    setRoomInvoicesError(null);
    try {
      const res = await billingApi.myRoomInvoices({ page: 0, size: 50 });
      const masters = [...res.content].sort((a, b) => b.year - a.year || b.month - a.month);
      const detailed = await Promise.all(
        masters.map(async (master) => {
          try {
            return await billingApi.roomInvoiceDetail(master.id);
          } catch {
            return master;
          }
        }),
      );
      setRoomInvoices(detailed);
    } catch (e) {
      setRoomInvoices([]);
      setRoomInvoicesError(errorText(e));
    }
  }, []);

  const loadRoommatesData = useCallback(async () => {
    try {
      const posts = await bookingApi.myRoommatePosts();
      setMyRoommatePosts(posts || []);
      for (const p of posts || []) {
        try {
          const appsRes = await bookingApi.postRoommateApplications(p.id);
          setRoommateApps((prev) => ({ ...prev, [String(p.id)]: appsRes.content || [] }));
        } catch {
          // Ignored
        }
      }
    } catch {
      // Ignored
    }
  }, []);

  useEffect(() => {
    void loadContracts();
    void loadMoveOuts();
    void loadRenewalRequests();
    void loadInvoices();
    void loadRoomInvoices();
    void loadRoommatesData();
  }, [loadContracts, loadMoveOuts, loadRenewalRequests, loadInvoices, loadRoomInvoices, loadRoommatesData]);

  const loadDetail = useCallback(async (id: Id) => {
    const req = ++detailReq.current;
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const d = await contractsApi.detail(id);
      if (detailReq.current !== req) return;
      setDetail(d);

      // Tải danh sách dịch vụ tòa nhà kèm theo hợp đồng
      try {
        const s = await billingApi.contractServices(id);
        setContractServicesList(s || []);
      } catch {
        setContractServicesList([]);
      }
    } catch (e) {
      if (detailReq.current !== req) return;
      setDetailError(errorText(e));
    } finally {
      if (detailReq.current === req) setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId == null) {
      detailReq.current += 1;
      setDetail(null);
      setDetailError(null);
      setDetailLoading(false);
      return;
    }
    setConfirming(false);
    setFormError("");
    void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const selected = useMemo(() => contracts?.find((c) => sameId(c.id, selectedId)) ?? null, [contracts, selectedId]);
  const latestMoveOut = useMemo(() => moveOuts?.find((r) => sameId(r.contractId, selectedId)) ?? null, [moveOuts, selectedId]);
  const latestRenewal = useMemo(
    () => renewalRequests.find((r) => sameId(r.contractId, selectedId)) ?? null,
    [renewalRequests, selectedId],
  );
  const renewalContract = useMemo(
    () =>
      latestRenewal?.renewalContractId
        ? contracts?.find((c) => sameId(c.id, latestRenewal.renewalContractId)) ?? null
        : null,
    [contracts, latestRenewal],
  );
  const pending = useMemo(() => moveOuts?.find((r) => sameId(r.contractId, selectedId) && r.status === "PENDING") ?? null, [moveOuts, selectedId]);
  const history = useMemo(() => (moveOuts ?? []).filter((r) => sameId(r.contractId, selectedId) && r.status !== "PENDING"), [moveOuts, selectedId]);

  // Map customerId sang tenant name từ contract detail
  const tenantMap = useMemo(() => {
    const map = new Map<string, { fullName: string; phone?: string; isRepresentative?: boolean }>();
    if (detail?.tenants) {
      for (const t of detail.tenants) {
        map.set(String(t.customerId), {
          fullName: t.fullName || `Khách #${t.customerId}`,
          phone: t.phone ?? undefined,
          isRepresentative: t.isRepresentative,
        });
      }
    }
    return map;
  }, [detail]);

  const remainingDays = selected?.endDate ? daysBetween(todayVN(), selected.endDate) : null;
  const isRenewalWindow = remainingDays != null && remainingDays <= 30 && remainingDays >= 0;
  const earliestEligibleDate = selected?.endDate
    ? (() => {
      const d = new Date(`${selected.endDate}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() - 30);
      return d.toISOString().slice(0, 10);
    })()
    : null;

  const minDate = todayVN();
  const maxDate = selected?.endDate ?? undefined;
  const dateErr = !date
    ? "Chọn ngày muốn trả phòng."
    : !isRenewalWindow
      ? `Chưa đến thời hạn gia hạn hoặc trả phòng. Bạn chỉ có thể gửi yêu cầu trước ngày kết thúc hợp đồng tối đa 30 ngày (từ ngày ${fmtDate(earliestEligibleDate)}).`
      : date < minDate
        ? `Ngày trả phòng không được trước hôm nay (${fmtDate(minDate)}).`
        : maxDate && date > maxDate
          ? `Ngày trả phòng không được vượt quá ngày kết thúc hợp đồng (${fmtDate(maxDate)}).`
          : "";

  const myTenant = useMemo(
    () => (user ? (detail?.tenants.find((t) => sameId(t.customerId, user.id)) ?? null) : null),
    [detail, user],
  );
  const isRepresentative = myTenant != null && myTenant.leftAt == null && myTenant.isRepresentative === true;
  const permissionReady = !!user && detail != null && detailError == null;
  const canRequest = !!selected && selected.status === "ACTIVE" && !pending && permissionReady && isRepresentative && isRenewalWindow;

  const awaitingSignContract = useMemo(
    () => contracts?.find((c) => c.status === "DRAFT" && c.signatureStatus === "AWAITING_TENANT") ?? null,
    [contracts],
  );

  // Tự động cuộn mượt xuống card ký hợp đồng điện tử khi có hash hoặc URL action
  useEffect(() => {
    const hash = window.location.hash;
    const urlParams = new URLSearchParams(window.location.search);
    if (hash === "#contract-signing-section" || urlParams.get("action") === "sign") {
      onTabChange?.("contracts");
      const timer = setTimeout(() => {
        const el = document.getElementById("contract-signing-section");
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.classList.add("ring-4", "ring-emerald-400", "transition-all", "duration-500");
          setTimeout(() => {
            el.classList.remove("ring-4", "ring-emerald-400");
          }, 3000);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [selectedId, detail, onTabChange]);

  async function submit() {
    if (!selected || !canRequest) return;
    if (!isRenewalWindow) {
      setFormError(`Chưa đến thời hạn gia hạn hoặc trả phòng. Bạn chỉ có thể gửi yêu cầu trước ngày kết thúc hợp đồng tối đa 30 ngày (từ ngày ${fmtDate(earliestEligibleDate)}).`);
      return;
    }
    if (dateErr) {
      setFormError(dateErr);
      return;
    }
    const reasonText = [reason, note.trim()].filter(Boolean).join(" · ");
    setBusy(true);
    setFormError("");
    setReloadWarning("");
    try {
      await contractsApi.createMoveOut({ contractId: selected.id, expectedMoveOutDate: date, ...(reasonText ? { reason: reasonText } : {}) });
    } catch (e) {
      setFormError(errorText(e));
      setBusy(false);
      return;
    }
    setBusy(false);
    setConfirming(false);
    setReason("");
    setNote("");
    show("Đã gửi yêu cầu trả phòng");
    const reloaded = await loadMoveOuts();
    if (!reloaded) setReloadWarning("Yêu cầu đã được gửi, nhưng chưa tải lại được danh sách. Vui lòng tải lại trang để xem trạng thái.");
  }

  const progress = (() => {
    if (!selected?.endDate) return null;
    const total = daysBetween(selected.startDate, selected.endDate);
    if (total <= 0) return 100;
    const used = daysBetween(selected.startDate, todayVN());
    return Math.min(100, Math.max(0, Math.round((used / total) * 100)));
  })();

  const activeTenantsCount = detail?.tenants
    ? detail.tenants.filter((t) => !t.leftAt).length
    : null;

  useEffect(() => {
    let cancelled = false;
    setRoomCapacity(null);
    setRoomCapacityError(null);
    if (!selected?.roomId) return;
    propertyApi.room(String(selected.roomId))
      .then((room) => {
        if (!cancelled) setRoomCapacity(room.maxCapacity);
      })
      .catch((error) => {
        if (!cancelled) setRoomCapacityError(errorText(error, "Không tải được sức chứa phòng"));
      });
    return () => { cancelled = true; };
  }, [selected?.roomId]);
  const maxRoomCapacity = roomCapacity;
  const isRoomFull = maxRoomCapacity != null && activeTenantsCount != null && activeTenantsCount >= maxRoomCapacity;

  // Active master room invoice (mới nhất)
  const activeMasterInvoice = roomInvoices && roomInvoices.length > 0 ? roomInvoices[0] : null;

  // Thành viên đang đăng nhập có nợ hóa đơn nào chưa trả không
  const myPendingInvoice = useMemo(() => {
    if (!invoices) return null;
    return invoices.find((inv) => inv.status !== "PAID") || null;
  }, [invoices]);

  const myTenantInfo = useMemo(() => {
    if (!detail?.tenants || !user) return null;
    return detail.tenants.find((t) => sameId(t.customerId, user.id)) || null;
  }, [detail?.tenants, user]);

  const isRoommateMember = myTenantInfo ? !myTenantInfo.isRepresentative : false;
  const activeTenantsList = useMemo(() => {
    return (detail?.tenants || []).filter((t) => !t.leftAt);
  }, [detail?.tenants]);
  const isSharedRoom = isRoommateMember || activeTenantsList.length > 1;

  return (
    <div className="mt-8">
      {/* ========================================================================= */}
      {/* TAB 1: HÓA ĐƠN & THU CHI PHÒNG (BILLING) */}
      {/* ========================================================================= */}
      {activeTab === "billing" && (
        <motion.div
          key="billing-tab"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-8"
        >
          {/* 1. HERO MASTER ROOM INVOICE (HÓA ĐƠN TỔNG PHÒNG MINH BẠCH) */}
          {activeMasterInvoice ? (
            <div className="rounded-3xl border border-teal-200 bg-gradient-to-br from-white via-teal-50/20 to-white p-6 md:p-8 shadow-sm">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center border-b border-teal-100 pb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="cx-badge success">Kỳ thanh toán Tháng {activeMasterInvoice.month}/{activeMasterInvoice.year}</span>
                    <span className={`cx-status ${invoiceStatusClass[activeMasterInvoice.status]}`}>
                      {invoiceStatusLabel[activeMasterInvoice.status]}
                    </span>
                  </div>
                  <h3 className="mt-2 text-2xl font-extrabold text-slate-900">
                    Phòng {roomOf(activeMasterInvoice.roomId)?.code ?? `#${activeMasterInvoice.roomId}`} · Hóa đơn tổng hợp
                  </h3>
                  <p className="text-xs text-muted mt-1">
                    Hạn thanh toán: <b className="text-rose-600">{fmtDateField(activeMasterInvoice.dueDate)}</b>
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-xs text-muted block">Tổng hóa đơn toàn phòng:</span>
                  <span className="text-3xl font-extrabold text-teal-800">{fmtMoney(activeMasterInvoice.totalAmount)}</span>
                </div>
              </div>

              {/* Progress bar thu tiền cả phòng */}
              <div className="mt-6 rounded-2xl bg-white p-4 border border-teal-100 shadow-xs">
                <div className="flex justify-between text-xs font-semibold text-slate-700 mb-2">
                  <span>Tiến độ thanh toán toàn phòng:</span>
                  <span className="text-teal-700">
                    Đã thu {fmtMoney(activeMasterInvoice.paidAmount || 0)} / {fmtMoney(activeMasterInvoice.totalAmount)} (
                    {Math.round(((activeMasterInvoice.paidAmount || 0) / (activeMasterInvoice.totalAmount || 1)) * 100)}%)
                  </span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full bg-teal-600 transition-all duration-1000"
                    style={{
                      width: `${Math.min(100, Math.round(((activeMasterInvoice.paidAmount || 0) / (activeMasterInvoice.totalAmount || 1)) * 100))}%`,
                    }}
                  />
                </div>
              </div>

              {/* BẢNG PHÂN RÃ CHI PHÍ MINH BẠCH (COST BREAKDOWN TABLE) */}
              <div className="mt-6">
                <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <Icon name="check" size={16} className="text-teal-600" />
                  Bảng phân rã chi phí & công thức chia đều ({activeMasterInvoice.shareCount || activeMasterInvoice.shares.length} thành viên)
                </h4>
                <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider border-b border-line">
                      <tr>
                        <th className="p-3.5">Khoản mục chi phí</th>
                        <th className="p-3.5">Tổng cả phòng</th>
                        <th className="p-3.5">Công thức chia sẻ</th>
                        <th className="p-3.5 text-right font-extrabold text-teal-800">Phần mỗi thành viên</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/60 text-slate-700 font-medium">
                      <tr>
                        <td className="p-3.5 font-bold">1. Tiền thuê phòng</td>
                        <td className="p-3.5 font-semibold text-slate-900">{fmtMoney(activeMasterInvoice.rentAmount)}</td>
                        <td className="p-3.5 text-muted">Chia đều {activeMasterInvoice.shareCount || 2} người</td>
                        <td className="p-3.5 text-right font-bold text-teal-700">
                          {fmtMoney(Math.round((activeMasterInvoice.rentAmount || 0) / (activeMasterInvoice.shareCount || 2)))}
                        </td>
                      </tr>
                      <tr>
                        <td className="p-3.5 font-bold">2. Tiền điện sinh hoạt (theo công tơ)</td>
                        <td className="p-3.5 font-semibold text-slate-900">{fmtMoney(activeMasterInvoice.electricAmount)}</td>
                        <td className="p-3.5 text-muted">Chia đều {activeMasterInvoice.shareCount || 2} người</td>
                        <td className="p-3.5 text-right font-bold text-teal-700">
                          {fmtMoney(Math.round((activeMasterInvoice.electricAmount || 0) / (activeMasterInvoice.shareCount || 2)))}
                        </td>
                      </tr>
                      <tr>
                        <td className="p-3.5 font-bold">3. Tiền nước sinh hoạt</td>
                        <td className="p-3.5 font-semibold text-slate-900">{fmtMoney(activeMasterInvoice.waterAmount)}</td>
                        <td className="p-3.5 text-muted">Chia đều {activeMasterInvoice.shareCount || 2} người</td>
                        <td className="p-3.5 text-right font-bold text-teal-700">
                          {fmtMoney(Math.round((activeMasterInvoice.waterAmount || 0) / (activeMasterInvoice.shareCount || 2)))}
                        </td>
                      </tr>
                      <tr>
                        <td className="p-3.5 font-bold">4. Dịch vụ tòa nhà (Internet, vệ sinh)</td>
                        <td className="p-3.5 font-semibold text-slate-900">{fmtMoney(activeMasterInvoice.serviceAmount)}</td>
                        <td className="p-3.5 text-muted">Chia đều {activeMasterInvoice.shareCount || 2} người</td>
                        <td className="p-3.5 text-right font-bold text-teal-700">
                          {fmtMoney(Math.round((activeMasterInvoice.serviceAmount || 0) / (activeMasterInvoice.shareCount || 2)))}
                        </td>
                      </tr>
                      <tr className="bg-teal-50/50 font-bold text-sm text-slate-900 border-t-2 border-teal-200">
                        <td className="p-3.5">TỔNG CỘNG HÓA ĐƠN</td>
                        <td className="p-3.5 text-teal-900 font-extrabold">{fmtMoney(activeMasterInvoice.totalAmount)}</td>
                        <td className="p-3.5 text-teal-800">{activeMasterInvoice.shareCount || 2} thành viên</td>
                        <td className="p-3.5 text-right text-base font-extrabold text-teal-700">
                          {fmtMoney(Math.round((activeMasterInvoice.totalAmount || 0) / (activeMasterInvoice.shareCount || 2)))} / người
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="mt-3 flex items-start gap-2 rounded-xl bg-teal-50/60 p-3 text-xs text-teal-900 border border-teal-200">
                  <Icon name="wallet" size={15} className="mt-0.5 shrink-0" />
                  <span><b>Minh bạch tài chính:</b> Tổng phòng {fmtMoney(activeMasterInvoice.totalAmount)} gồm tiền phòng {fmtMoney(activeMasterInvoice.rentAmount)} + điện {fmtMoney(activeMasterInvoice.electricAmount)} + nước {fmtMoney(activeMasterInvoice.waterAmount)} + dịch vụ {fmtMoney(activeMasterInvoice.serviceAmount)}. Với {activeMasterInvoice.shareCount || 2} thành viên, mỗi người đóng đúng <b>{fmtMoney(Math.round((activeMasterInvoice.totalAmount || 0) / (activeMasterInvoice.shareCount || 2)))}</b>.</span>
                </div>
              </div>

              {/* TÌNH TRẠNG ĐÓNG TIỀN CỦA TỪNG THÀNH VIÊN TRONG PHÒNG */}
              <div className="mt-6 border-t border-teal-100 pt-5">
                <h4 className="text-sm font-bold text-slate-900 mb-3">
                  Tình trạng đóng tiền của từng thành viên trong phòng:
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeMasterInvoice.shares.map((share) => {
                    const isMe = user ? sameId(share.customerId, user.id) : false;
                    const tenantInfo = tenantMap.get(String(share.customerId));
                    const fallbackName = `Thành viên #${idStr(share.customerId)}`;
                    const displayName = isMe
                      ? `Bạn (${user?.fullName || tenantInfo?.fullName || "Khách thuê"})`
                      : (tenantInfo?.fullName || fallbackName);
                    const isPaid = share.status === "PAID";
                    const owed = (share.totalAmount || 0) - (share.paidAmount || 0);

                    return (
                      <div
                        key={idStr(share.invoiceId)}
                        className={`rounded-2xl border p-4 transition ${isMe
                            ? "border-teal-400 bg-white shadow-md ring-2 ring-teal-100"
                            : "border-line bg-surface/70"
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="grid h-8 w-8 place-items-center rounded-full bg-teal-100 text-teal-800 font-bold text-xs">
                              {initialsOf(displayName)}
                            </span>
                            <div>
                              <b className="text-sm text-slate-900 block">{displayName}</b>
                              <span className="text-[11px] text-muted">
                                {share.representative ? "Đại diện hợp đồng" : "Thành viên ở ghép"}
                              </span>
                            </div>
                          </div>
                          <span className={`cx-status ${invoiceStatusClass[share.status]}`}>
                            {invoiceStatusLabel[share.status]}
                          </span>
                        </div>

                        <div className="mt-3 flex items-center justify-between border-t border-line/60 pt-2.5 text-xs">
                          <span className="text-muted">Phần tiền phải nộp:</span>
                          <b className="text-slate-900">{fmtMoney(share.totalAmount)}</b>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted">Đã chuyển:</span>
                          <span className="font-semibold text-emerald-600">{fmtMoney(share.paidAmount || 0)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted">Còn thiếu:</span>
                          <span className={`font-bold ${owed > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                            {fmtMoney(Math.max(0, owed))}
                          </span>
                        </div>

                        {/* Nút thanh toán VNPay dành riêng cho người dùng hiện tại */}
                        {isMe && !isPaid && myPendingInvoice && (
                          <div className="mt-3 pt-2 border-t border-dashed border-teal-200 flex flex-col gap-2">
                            <button
                              type="button"
                              className="cx-btn !h-9 w-full text-xs bg-teal-700 hover:bg-teal-800 flex items-center justify-center gap-1.5 font-bold shadow-sm"
                              onClick={() => setPayingInvoice(myPendingInvoice)}
                            >
                              <Icon name="wallet" size={14} /> Thanh toán VNPay ({fmtMoney(owed)}) →
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : isSharedRoom ? (
            /* Khi là phòng ở ghép nhưng chưa có master invoice cho người dùng này trong kỳ hiện tại */
            <div className="rounded-3xl border border-teal-200 bg-white p-6 md:p-8 shadow-sm">
              <div className="flex flex-col justify-between gap-3 border-b border-line pb-4 md:flex-row md:items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="cx-badge success">Phòng ở ghép ({activeTenantsList.length || 2} người)</span>
                    <span className="cx-status info">{isRoommateMember ? "Thành viên ở ghép" : "Đại diện hợp đồng"}</span>
                  </div>
                  <h3 className="mt-2 text-xl font-bold text-slate-900">
                    Hóa đơn phòng ở ghép · Chia sẻ chi phí
                  </h3>
                  <p className="text-xs text-muted mt-1">
                    Hệ thống tự động phân rã và chia đều chi phí phòng, điện nước giữa các thành viên.
                  </p>
                </div>
                {myPendingInvoice && (
                  <button
                    type="button"
                    className="cx-btn !h-9 text-xs"
                    onClick={() => setPayingInvoice(myPendingInvoice)}
                  >
                    Thanh toán VNPay →
                  </button>
                )}
              </div>

              {myPendingInvoice ? (
                <div className="mt-6 space-y-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted">Tổng tiền kỳ này:</span>
                    <span className="text-2xl font-extrabold text-teal-800">{fmtMoney(myPendingInvoice.totalAmount)}</span>
                  </div>
                  <div className="divide-y divide-line/60 text-xs">
                    {myPendingInvoice.items?.map((item, idx) => (
                      <div key={item.id || idx} className="flex justify-between py-2">
                        <span>{item.description || item.itemType}</span>
                        <b>{fmtMoney(item.amount)}</b>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  <div className="rounded-2xl bg-teal-50/70 border border-teal-200 p-4 text-xs text-teal-900">
                    <div className="flex items-start gap-2.5">
                      <Icon name="wallet" size={16} className="mt-0.5 shrink-0 text-teal-700" />
                      <div>
                        <b className="text-teal-950 block mb-1">
                          {myTenantInfo?.joinedAt
                            ? `Kỳ tính tiền phòng & điện nước của bạn bắt đầu từ ngày ${fmtDateField(myTenantInfo.joinedAt)}`
                            : "Tháng này chưa phát sinh hóa đơn cho bạn"}
                        </b>
                        <p className="text-teal-800 leading-relaxed">
                          {isRoommateMember
                            ? `Bạn đã được thêm vào hợp đồng phòng ở ghép. Để đảm bảo tiền phòng, điện và nước được phân bổ minh bạch từ đầu tháng, ngày bắt đầu tính chu kỳ hóa đơn của bạn là từ ngày ${fmtDateField(myTenantInfo?.joinedAt)}. Trong kỳ hiện tại bạn chưa có hóa đơn nợ. Hóa đơn tổng phòng và phần chia đều của bạn sẽ được phát hành vào kỳ tiếp theo.`
                            : "Phòng hiện chưa có hóa đơn phát hành cho kỳ này. Hóa đơn tổng phòng kèm bảng phân rã chi phí từng thành viên sẽ tự động hiển thị khi ban quản lý chốt sổ kỳ tiếp theo."}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="py-6 text-center text-xs text-muted">
                    Bạn hiện không có khoản nợ hóa đơn nào cho phòng này.
                  </div>
                </div>
              )}
            </div>
          ) : contracts !== null && contracts.length === 0 ? (
            <div className="rounded-3xl border border-line bg-white p-10 text-center shadow-sm">
              <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-surface text-muted">
                <Icon name="wallet" size={28} />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Bạn chưa có hợp đồng thuê phòng nào</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted">
                Hóa đơn tiền phòng, điện và nước sẽ xuất hiện tại đây sau khi hợp đồng thuê của bạn có hiệu lực.
                Nếu bạn vừa gửi yêu cầu thuê, hãy theo dõi tiến trình ở mục “Yêu cầu thuê”.
              </p>
            </div>
          ) : (
            /* Khi là phòng đơn (không có master invoice) */
            <div className="rounded-3xl border border-line bg-white p-6 md:p-8 shadow-sm">
              <div className="flex items-center justify-between border-b border-line pb-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">
                    Hóa đơn phòng đơn · 1 người thuê
                  </h3>
                  <p className="text-xs text-muted mt-1">Phòng đơn không áp dụng cơ chế chia sẻ ở ghép.</p>
                </div>
                {myPendingInvoice && (
                  <button
                    type="button"
                    className="cx-btn !h-9 text-xs"
                    onClick={() => setPayingInvoice(myPendingInvoice)}
                  >
                    Thanh toán VNPay →
                  </button>
                )}
              </div>

              {myPendingInvoice ? (
                <div className="mt-6 space-y-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted">Tổng tiền kỳ này:</span>
                    <span className="text-2xl font-extrabold text-teal-800">{fmtMoney(myPendingInvoice.totalAmount)}</span>
                  </div>
                  <div className="divide-y divide-line/60 text-xs">
                    {myPendingInvoice.items?.map((item, idx) => (
                      <div key={item.id || idx} className="flex justify-between py-2">
                        <span>{item.description || item.itemType}</span>
                        <b>{fmtMoney(item.amount)}</b>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-muted">
                  Bạn hiện không có khoản nợ hóa đơn nào cho phòng này.
                </div>
              )}
            </div>
          )}

          {/* 2. LỊCH SỬ HÓA ĐƠN CÁ NHÂN (PERSONAL INVOICES HISTORY) */}
          <div className="rounded-3xl border border-line bg-white p-6 shadow-sm">
            <h4 className="text-base font-bold text-slate-900 mb-4">Lịch sử hóa đơn cá nhân của bạn</h4>
            {invoices === null ? (
              <p className="text-xs text-muted">Đang tải lịch sử hóa đơn…</p>
            ) : invoicesError ? (
              <div className="alert alert-error">Không tải được hóa đơn: {invoicesError}</div>
            ) : invoices.length === 0 ? (
              <p className="text-xs text-muted">Chưa có hóa đơn nào được phát hành.</p>
            ) : (
              <div className="divide-y divide-line/60">
                {invoices.map((inv) => (
                  <div key={String(inv.id)} className="flex items-center justify-between py-3 text-xs">
                    <div>
                      <b className="text-sm text-slate-900 block">Hóa đơn Tháng {inv.month}/{inv.year}</b>
                      <span className="text-muted">
                        Hạn nộp: {fmtDateField(inv.dueDate)} · Đã nộp: {fmtMoney(inv.paidAmount || 0)}
                      </span>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <div>
                        <div className="font-bold text-slate-900 text-sm">{fmtMoney(inv.totalAmount)}</div>
                        <span className={`cx-status ${invoiceStatusClass[inv.status]}`}>
                          {invoiceStatusLabel[inv.status]}
                        </span>
                      </div>
                      {inv.status !== "PAID" && (
                        <button
                          type="button"
                          className="cx-btn ghost !h-8 !px-3 text-xs text-teal-700 font-semibold"
                          onClick={() => setPayingInvoice(inv)}
                        >
                          Thanh toán VNPay
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: HỢP ĐỒNG & THÀNH VIÊN (CONTRACT & OCCUPANTS) */}
      {/* ========================================================================= */}
      {activeTab === "contracts" && (
        <motion.div
          key="contracts-tab"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-8"
        >
          {contracts === null ? (
            <p className="text-sm text-muted">Đang tải thông tin hợp đồng…</p>
          ) : contractsError ? (
            <div className="alert alert-error">Không tải được hợp đồng: {contractsError}</div>
          ) : !selected ? (
            <div className="rounded-3xl border border-line bg-white p-12 text-center">
              <h3 className="text-lg font-bold">Bạn chưa có hợp đồng thuê phòng nào</h3>
              <p className="mt-1 text-xs text-muted">Hãy tìm phòng và nộp yêu cầu thuê trên hệ thống.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {awaitingSignContract && (
                <div className="rounded-2xl border-2 border-emerald-400 bg-emerald-50 p-4 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="cx-status ok">Cần ký điện tử</span>
                      <b className="text-emerald-950 text-sm">Hợp đồng #{awaitingSignContract.id} đang chờ bạn ký xác nhận</b>
                    </div>
                    <p className="text-xs text-emerald-800 mt-1 m-0">
                      Ban quản lý đã gửi đề nghị hợp đồng. Vui lòng kiểm tra và ký điện tử để kích hoạt hợp đồng.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="cx-btn primary !h-9 text-xs whitespace-nowrap"
                    onClick={() => {
                      setSelectedId(String(awaitingSignContract.id));
                      setTimeout(() => {
                        document.getElementById("contract-signing-section")?.scrollIntoView({ behavior: "smooth" });
                      }, 200);
                    }}
                  >
                    Xem & Ký hợp đồng ngay <Icon name="chevron" size={13} />
                  </button>
                </div>
              )}

              {/* Card thông tin hợp đồng */}
              <div className="rounded-3xl border border-line bg-white p-6 md:p-8 shadow-sm">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center border-b border-line pb-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-lg text-slate-900">Hợp đồng #{selected.id}</span>
                      <span className={`cx-status ${statusClass[selected.status]}`}>{statusLabel[selected.status]}</span>
                      {selected.status === "ACTIVE" && (
                        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                          Đã ký đủ 2 bên
                        </span>
                      )}
                      {selected.status === "DRAFT" && selected.signatureStatus === "AWAITING_LESSOR" && (
                        <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold text-sky-700">
                          Bạn đã ký · Chờ quản lý ký
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted mt-1">
                      Phòng {roomOf(selected.roomId)?.code ?? `#${selected.roomId}`} · {buildingOf(selected.buildingId) ?? `Tòa #${selected.buildingId}`}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {selected.status === "ACTIVE" && (
                      <ChatStartButton
                        contextType="BUILDING_MANAGER"
                        contextId={selected.buildingId}
                        label="Khiếu nại ban quản lý"
                        icon="alert"
                        title="Gửi khiếu nại trực tiếp tới quản lý tòa nhà"
                        className="cx-btn ghost !py-2 text-xs border border-danger/30 text-danger hover:bg-danger/10"
                      />
                    )}
                    {contracts && contracts.length > 1 && (
                      <select
                        className="cx-input text-xs"
                        value={String(selected.id)}
                        onChange={(e) => setSelectedId(e.target.value)}
                      >
                        {contracts.map((c) => (
                          <option key={c.id} value={c.id}>
                            HĐ #{c.id} · Phòng {roomOf(c.roomId)?.code ?? `#${c.roomId}`} ({statusLabel[c.status]})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                {/* Progress bar thời hạn */}
                <div className="mt-4">
                  <div className="cx-contract-bar"><div style={{ width: `${progress ?? 100}%` }} /></div>
                  <div className="mt-2 flex justify-between text-xs text-muted">
                    <span>Ngày bắt đầu: {fmtDate(selected.startDate)}</span>
                    <span className="font-semibold text-teal-800">
                      {remainingDays == null ? "Không thời hạn" : remainingDays < 0 ? "Đã hết hạn" : `Còn ${remainingDays} ngày`}
                    </span>
                    <span>Ngày kết thúc: {fmtDate(selected.endDate)}</span>
                  </div>
                </div>

                {/* Chi phí theo hợp đồng */}
                <dl className="cx-specs !mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="rounded-xl bg-surface p-3 border border-line">
                    <dt className="text-xs text-muted">Giá thuê gốc</dt>
                    <dd className="text-base font-bold text-slate-900">{fmtMoney(selected.rentAmount)}</dd>
                  </div>
                  <div className="rounded-xl bg-surface p-3 border border-line">
                    <dt className="text-xs text-muted">Tiền cọc phòng</dt>
                    <dd className="text-base font-bold text-slate-900">{fmtMoney(selected.depositAmount)}</dd>
                    {(selected.depositAmount ?? 0) > 0 && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                        {selected.depositPaid ? (
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-semibold ${selected.depositPaymentMethod === "VNPAY"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-teal-50 text-teal-800 border border-teal-200"
                            }`}>
                            {selected.depositPaymentMethod === "VNPAY"
                              ? "Đã cọc VNPay"
                              : selected.status === "ACTIVE"
                                ? "Đã xác nhận CK"
                                : "Đã báo CK · chờ đối soát"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            Chờ thanh toán cọc
                          </span>
                        )}
                        {selected.depositTxnRef && (
                          <span className="font-mono text-muted">#{selected.depositTxnRef}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="rounded-xl bg-surface p-3 border border-line">
                    <dt className="text-xs text-muted">Giá điện</dt>
                    <dd className="text-base font-bold text-slate-900">{detail?.electricityPrice ? `${vnd(detail.electricityPrice)}/kWh` : "3.500 đ"}</dd>
                  </div>
                  <div className="rounded-xl bg-surface p-3 border border-line">
                    <dt className="text-xs text-muted">Giá nước</dt>
                    <dd className="text-base font-bold text-slate-900">{detail?.waterPrice ? `${vnd(detail.waterPrice)}/${detail.waterUnit === "PERSON" ? "người" : "m³"}` : "25.000 đ"}</dd>
                  </div>
                </dl>

                {/* DỊCH VỤ TÒA NHÀ ĐĂNG KÝ KÈM THEO HỢP ĐỒNG (LÀM RÕ INTERNET, GỬI XE...) */}
                <div className="mt-6 rounded-2xl border border-line bg-surface/50 p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                    Các dịch vụ tòa nhà kèm theo hợp đồng:
                  </h4>
                  {contractServicesList.length === 0 ? (
                    <p className="text-xs text-muted">
                      Hợp đồng không đăng ký dịch vụ phụ trội tòa nhà (chỉ phát sinh giá phòng và điện nước theo công tơ).
                    </p>
                  ) : (
                    <div className="divide-y divide-line/60">
                      {contractServicesList.map((s: any) => (
                        <div key={String(s.id)} className="flex items-center justify-between py-2 text-xs">
                          <div>
                            <b className="text-slate-900">{s.serviceName || `Dịch vụ #${s.id}`}</b>
                            <span className="text-muted ml-2 text-[11px]">
                              ({(s.usageType || s.feeType) === "SHARED" ? "Dùng chung cả phòng" : "Cá nhân"})
                            </span>
                          </div>
                          <span className="font-semibold text-teal-800">
                            {s.unitPrice ? vnd(s.unitPrice) : "Theo quy định"}/tháng
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Danh sách người ở trong phòng */}
                <div className="mt-6 border-t border-line pt-5">
                  <h4 className="text-sm font-bold text-slate-900 mb-3">Danh sách thành viên đang sinh sống:</h4>
                  {detailLoading ? (
                    <p className="text-xs text-muted">Đang tải danh sách thành viên…</p>
                  ) : detail?.tenants && detail.tenants.length > 0 ? (
                    <div className="space-y-2">
                      {detail.tenants.map((t) => {
                        const isMe = !!user && sameId(t.customerId, user.id);
                        return (
                          <div key={t.id} className="flex items-center justify-between p-3 rounded-xl border border-line bg-white">
                            <div className="flex items-center gap-3">
                              <span className="grid h-9 w-9 place-items-center rounded-full bg-teal-100 text-teal-800 font-bold text-xs">
                                {initialsOf(t.fullName || (isMe ? user?.fullName : "KT"))}
                              </span>
                              <div>
                                <b className="text-sm text-slate-900 block">
                                  {t.fullName || (isMe ? user?.fullName : `Khách #${t.customerId}`)}
                                  {isMe && <span className="ml-1 text-xs text-teal-700 font-normal">(Bạn)</span>}
                                </b>
                                <span className="text-xs text-muted">
                                  Vào ở: {fmtDate(t.joinedAt)} {t.phone ? `· SĐT: ${t.phone}` : ""} {t.cccdNumber ? `· CCCD: ${t.cccdNumber}` : ""}
                                </span>
                              </div>
                            </div>
                            <span className={`cx-status ${t.isRepresentative ? "ok" : "info"}`}>
                              {t.isRepresentative ? "Đại diện hợp đồng" : "Thành viên ở ghép"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-muted">Chưa có thông tin người ở.</p>
                  )}
                </div>
              </div>

              {/* Card Ký Hợp Đồng Điện Tử nếu đang là DRAFT */}
              {selected.status === "DRAFT" && (
                <div id="contract-signing-section" className="rounded-3xl border border-teal-300 bg-white p-6 md:p-8 shadow-md">
                  <h3 className="text-lg font-bold text-teal-900 mb-4">Ký hợp đồng điện tử</h3>
                  {detail ? (
                    <CustomerSignatureCard
                      contract={detail}
                      toast={show}
                      onChanged={async () => {
                        await loadContracts();
                        await loadDetail(selected.id);
                      }}
                    />
                  ) : (
                    <p className="text-xs text-muted">Đang tải nội dung hợp đồng để ký…</p>
                  )}
                </div>
              )}

              {/* Trung tâm chuyển tiếp yêu cầu hợp đồng (Trả phòng & Gia hạn) */}
              {selected.status === "ACTIVE" && (
                <div className="rounded-3xl border border-line bg-white p-6 md:p-8 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-4 mb-6">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 m-0">Trung tâm yêu cầu hợp đồng</h3>
                      <p className="text-xs text-muted mt-1 m-0">
                        Yêu cầu trả phòng và gia hạn hợp đồng hiện được tập trung quản lý tại mục <b>Yêu cầu của tôi</b> để theo dõi trạng thái rõ ràng, độc lập.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Thẻ Yêu cầu trả phòng */}
                    <div className="rounded-2xl border border-line bg-surface/50 p-5 hover:border-teal-400 transition-all flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-bold text-slate-800 text-sm flex items-center gap-2">
                            <Icon name="home" size={18} className="text-teal-700" /> Yêu cầu trả phòng
                          </span>
                          {latestMoveOut ? (
                            <span className={`cx-status ${moveOutClass[latestMoveOut.status]}`}>
                              {moveOutLabel[latestMoveOut.status]}
                            </span>
                          ) : (
                            <span className="cx-status mute">Chưa gửi yêu cầu</span>
                          )}
                        </div>
                        <p className="text-xs text-muted leading-relaxed mb-4">
                          {latestMoveOut ? (
                            latestMoveOut.status === "PENDING"
                              ? `Đã gửi yêu cầu hẹn trả phòng ngày ${fmtDate(latestMoveOut.expectedMoveOutDate)}. Đang chờ Ban quản lý xét duyệt.`
                              : latestMoveOut.status === "APPROVED"
                                ? `Đã duyệt trả phòng ngày ${fmtDate(latestMoveOut.expectedMoveOutDate)}. Xem chi tiết hoàn trả tiền cọc.`
                                : latestMoveOut.status === "REJECTED"
                                  ? `Yêu cầu trả phòng ngày ${fmtDate(latestMoveOut.expectedMoveOutDate)} đã bị Ban quản lý từ chối${latestMoveOut.reason ? `: ${latestMoveOut.reason}` : "."} Bạn có thể gửi lại yêu cầu mới.`
                                  : `Yêu cầu trả phòng đã hoàn tất ngày ${fmtDate(latestMoveOut.expectedMoveOutDate)}.`
                          ) : (
                            `Hợp đồng hết hạn vào ngày ${fmtDate(selected.endDate)}. Bạn có thể nộp yêu cầu trả phòng trước ngày kết thúc tối đa 30 ngày.`
                          )}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="cx-btn secondary !h-9 text-xs w-full flex items-center justify-center gap-1.5"
                        onClick={() => navigate("/requests?tab=move-outs")}
                      >
                        {latestMoveOut?.status === "REJECTED" ? "Gửi lại yêu cầu trả phòng" : "Quản lý yêu cầu trả phòng"} <Icon name="chevron" size={14} />
                      </button>
                    </div>

                    {/* Thẻ Yêu cầu gia hạn hợp đồng */}
                    <div className="rounded-2xl border border-line bg-surface/50 p-5 hover:border-teal-400 transition-all flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-bold text-slate-800 text-sm flex items-center gap-2">
                            <Icon name="calendar" size={18} className="text-teal-700" /> Gia hạn hợp đồng (1 năm)
                          </span>
                          {latestRenewal ? (
                            <span className="cx-status info">
                              {latestRenewal.status === "PENDING"
                                ? "Chờ duyệt"
                                : latestRenewal.status === "REJECTED"
                                  ? "Bị từ chối"
                                  : latestRenewal.status === "CANCELLED"
                                    ? "Đã hủy"
                                    : renewalContract?.status === "ACTIVE" ||
                                      renewalContract?.signatureStatus === "COMPLETED"
                                      ? "Đã gia hạn"
                                      : renewalContract?.signatureStatus === "AWAITING_TENANT"
                                        ? "Chờ bạn ký"
                                        : renewalContract?.signatureStatus === "AWAITING_LESSOR"
                                          ? "Chờ chủ nhà ký"
                                          : "Đã duyệt"}
                            </span>
                          ) : (
                            <span className="cx-status mute">Chưa gửi yêu cầu</span>
                          )}
                        </div>
                        <p className="text-xs text-muted leading-relaxed mb-4">
                          {latestRenewal ? (
                            latestRenewal.status === "PENDING"
                              ? `Đã gửi yêu cầu gia hạn ${latestRenewal.termMonths} tháng. Đang chờ Ban quản lý duyệt; chưa có hợp đồng mới ở bước này.`
                              : latestRenewal.status === "REJECTED"
                                ? `Yêu cầu gia hạn bị từ chối${latestRenewal.rejectReason ? `: ${latestRenewal.rejectReason}` : "."} Bạn có thể gửi lại yêu cầu mới.`
                                : latestRenewal.status === "CANCELLED"
                                  ? "Bạn đã hủy yêu cầu gia hạn trước đó. Có thể gửi lại yêu cầu mới."
                                  : renewalContract?.status === "ACTIVE" ||
                                    renewalContract?.signatureStatus === "COMPLETED"
                                    ? `Hợp đồng gia hạn đã có hiệu lực từ ${fmtDate(renewalContract?.startDate ?? latestRenewal.startDate)} đến ${fmtDate(renewalContract?.endDate ?? latestRenewal.endDate)}.`
                                    : renewalContract?.signatureStatus === "AWAITING_TENANT"
                                      ? "Ban quản lý đã duyệt và gửi hợp đồng mới! Vui lòng vào trang Yêu cầu để ký điện tử."
                                      : renewalContract?.signatureStatus === "AWAITING_LESSOR"
                                        ? "Bạn đã ký. Hợp đồng đang chờ Chủ nhà ký để hoàn tất."
                                        : renewalContract
                                          ? "Yêu cầu đã được duyệt. Ban quản lý đang soạn hợp đồng mới với đầy đủ điều khoản (giá thuê, tiền cọc, điện nước)."
                                          : "Yêu cầu đã được duyệt – đang chờ bên cho thuê gửi hợp đồng để ký."
                          ) : (
                            `Tiếp tục gắn bó cùng tòa nhà với thời hạn hợp đồng chuẩn 12 tháng (1 năm). Thao tác gửi yêu cầu và ký hợp đồng tại trang Yêu cầu.`
                          )}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="cx-btn primary !h-9 text-xs w-full flex items-center justify-center gap-1.5"
                        onClick={() => navigate("/requests?tab=renewals")}
                      >
                        Quản lý yêu cầu gia hạn <Icon name="chevron" size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: Ở GHÉP PHÒNG TÔI (ROOMMATE MANAGEMENT) */}
      {/* ========================================================================= */}
      {activeTab === "roommates" && (
        <motion.div
          key="roommates-tab"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-8"
        >
          {/* Card Sức Chứa Phòng & Cảnh Báo Full */}
          <div className="rounded-3xl border border-line bg-white p-6 md:p-8 shadow-sm">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <span className="text-xs text-muted block">Tình trạng phòng hiện tại:</span>
                {roomCapacityError ? (
                  <p className="text-sm text-danger">Không tải được sức chứa phòng: {roomCapacityError}</p>
                ) : activeTenantsCount == null || maxRoomCapacity == null ? (
                  <p className="text-sm text-muted">Đang tải số người ở và sức chứa phòng…</p>
                ) : (
                  <h3 className="text-xl font-bold text-slate-900">
                    Phòng {selected ? roomOf(selected.roomId)?.code ?? `#${selected.roomId}` : "—"} · Số người ở / sức chứa: {activeTenantsCount} / {maxRoomCapacity}
                  </h3>
                )}
              </div>
              <div>
                {activeTenantsCount != null && maxRoomCapacity != null && (
                  isRoomFull ? (
                    <span className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 text-xs font-bold text-amber-800">
                      Phòng đã đủ người ({activeTenantsCount}/{maxRoomCapacity})
                    </span>
                  ) : (
                    <span className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 text-xs font-bold text-emerald-800">
                      Còn {Math.max(0, maxRoomCapacity - activeTenantsCount)} chỗ trống
                    </span>
                  )
                )}
              </div>
            </div>

            {isRoomFull && activeTenantsCount != null && maxRoomCapacity != null && (
              <div className="mt-4 rounded-xl bg-amber-50 p-3.5 text-xs text-amber-900 border border-amber-200">
                <b>Lưu ý sức chứa phòng:</b> Phòng hiện có {activeTenantsCount}/{maxRoomCapacity} người. Không thể duyệt thêm thành viên khi đã đủ sức chứa.
              </div>
            )}
          </div>

          {/* Danh sách tin đăng ở ghép của phòng tôi */}
          <div className="rounded-3xl border border-line bg-white p-6 md:p-8 shadow-sm">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <h4 className="text-base font-bold text-slate-900">Tin đăng tìm bạn ở ghép của bạn</h4>
              <span className="text-xs text-muted">{myRoommatePosts.length} tin</span>
            </div>

            {myRoommatePosts.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted">
                Bạn chưa đăng tin tìm bạn ở ghép nào cho phòng này.
              </div>
            ) : (
              <div className="mt-4 space-y-6">
                {myRoommatePosts.map((p) => {
                  const apps = roommateApps[String(p.id)] || [];

                  return (
                    <div key={p.id} className="rounded-2xl border border-line p-5 bg-surface/30">
                      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                        <div>
                          <div className="flex items-center gap-2">
                            <b className="text-base text-slate-900">{p.title}</b>
                            <span className={`cx-badge ${p.status === "OPEN" ? "success" : "muted"}`}>
                              {p.status === "OPEN" ? "Đang tìm" : "Đã đóng"}
                            </span>
                          </div>
                          <p className="text-xs text-muted mt-1">
                            Chi phí chia sẻ: <b className="text-accent">{vnd(p.budgetShare)}/người</b> · Tạo lúc: {new Date(p.createdAt).toLocaleDateString("vi-VN")}
                          </p>
                        </div>
                        {p.status === "OPEN" && (
                          <button
                            type="button"
                            className="cx-btn ghost !h-8 text-xs text-danger"
                            onClick={async () => {
                              try {
                                await bookingApi.closeRoommatePost(p.id);
                                show("Đã đóng tin đăng ở ghép.");
                                void loadRoommatesData();
                              } catch (e) {
                                show(errorText(e));
                              }
                            }}
                          >
                            Đóng tin này
                          </button>
                        )}
                      </div>

                      {/* Thống kê đơn ứng tuyển & liên kết tới nơi duyệt duy nhất */}
                      <div className="mt-4 border-t border-line/60 pt-3 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <span className="text-xs font-semibold text-slate-700">
                            Hồ sơ ứng tuyển: <b>{apps.length} người nộp</b>
                            {apps.filter((a) => a.status === "PENDING").length > 0 && (
                              <span className="ml-2 inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 border border-amber-200">
                                {apps.filter((a) => a.status === "PENDING").length} đơn chờ duyệt
                              </span>
                            )}
                          </span>
                        </div>
                        <a
                          href="/roommates"
                          className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-teal-700 transition-colors"
                        >
                          Xem hồ sơ CCCD & Duyệt ứng viên →
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* POPUP THANH TOÁN TIỀN PHÒNG / TIỀN HÓA ĐƠN QUA VNPAY */}
      {payingInvoice && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center shadow-inner">
                  <Icon name="wallet" size={18} />
                </div>
                <div>
                  <h3 className="m-0 text-base font-bold text-slate-900">
                    Thanh toán VNPay
                  </h3>
                  <p className="text-xs text-slate-500 m-0">
                    Hóa đơn tháng {payingInvoice.month}/{payingInvoice.year} · Phòng {roomOf(payingInvoice.roomId)?.code ?? `#${payingInvoice.roomId}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer border-0 bg-transparent"
                onClick={() => setPayingInvoice(null)}
              >
                <Icon name="close" size={16} />
              </button>
            </div>

            <div className="my-5 space-y-3">
              <div className="rounded-2xl bg-teal-50/70 border border-teal-200/80 p-4 text-center">
                <span className="text-xs font-medium text-teal-800 block mb-0.5">Số tiền cần thanh toán</span>
                <span className="text-2xl font-black text-teal-950 tracking-tight">
                  {fmtMoney(payingInvoice.totalAmount - (payingInvoice.paidAmount || 0))}
                </span>
              </div>

              <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3.5 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Mã hóa đơn:</span>
                  <span className="font-mono font-bold text-slate-800">#{payingInvoice.id}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Kỳ thanh toán:</span>
                  <b>Tháng {payingInvoice.month}/{payingInvoice.year}</b>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Hạn nộp tiền:</span>
                  <b className="text-rose-600 font-semibold">{fmtDateField(payingInvoice.dueDate)}</b>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-200/60">
                  <span className="text-slate-500">Cổng thanh toán:</span>
                  <div className="flex items-center gap-1.5 font-bold text-teal-800">
                    <span className="w-2 h-2 rounded-full bg-teal-500" /> VNPay
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={payingVnpay}
                className="cx-btn !h-11 w-full bg-teal-700 hover:bg-teal-800 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-teal-800/20 disabled:opacity-60 cursor-pointer"
                onClick={async () => {
                  try {
                    setPayingVnpay(true);
                    const owed = payingInvoice.totalAmount - (payingInvoice.paidAmount || 0);
                    const returnUrl = (import.meta.env.VITE_VNPAY_RETURN_URL as string | undefined) || `${window.location.origin}/payment/vnpay-return`;
                    const res = await billingApi.createVnpayUrl({
                      invoiceId: payingInvoice.id,
                      amount: owed > 0 ? owed : payingInvoice.totalAmount,
                      returnUrl,
                    });
                    if (res?.paymentUrl) {
                      window.location.href = res.paymentUrl;
                    } else {
                      show("Không thể khởi tạo đường dẫn thanh toán VNPay");
                    }
                  } catch (e) {
                    show("Không thể khởi tạo thanh toán VNPay: " + errorText(e));
                  } finally {
                    setPayingVnpay(false);
                  }
                }}
              >
                {payingVnpay ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Đang kết nối tới VNPay...</span>
                  </>
                ) : (
                  <>
                    <Icon name="wallet" size={16} /> Chuyển tới cổng thanh toán VNPay →
                  </>
                )}
              </button>

              <button
                type="button"
                className="cx-btn ghost !h-9 text-xs text-slate-500 hover:text-slate-700"
                onClick={() => setPayingInvoice(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {toast}
    </div>
  );
}

export default HomeExtras;
