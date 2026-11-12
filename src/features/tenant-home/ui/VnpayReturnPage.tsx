import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { billingApi } from "@/api/billing";
import { Icon } from "@/shared/ui";

type ConfirmResult = Awaited<ReturnType<typeof billingApi.confirmVnpayPayment>>;
const inFlightConfirms = new Map<string, Promise<ConfirmResult>>();

function confirmOnce(key: string, params: Record<string, string>): Promise<ConfirmResult> {
  const existing = inFlightConfirms.get(key);
  if (existing) return existing;
  const promise = billingApi.confirmVnpayPayment(params).finally(() => {
    inFlightConfirms.delete(key);
  });
  inFlightConfirms.set(key, promise);
  return promise;
}

export default function VnpayReturnPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [amountVnd, setAmountVnd] = useState<number | null>(null);
  const [confirmedContractId, setConfirmedContractId] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const txnRef = searchParams.get("vnp_TxnRef");
  const bankCode = searchParams.get("vnp_BankCode");
  const transactionNo = searchParams.get("vnp_TransactionNo");
  const responseCode = searchParams.get("vnp_ResponseCode");
  const isDepositTxn = Boolean(txnRef?.startsWith("DEP")) || confirmedContractId != null;
  const parsedDepositContractId = (() => {
    if (confirmedContractId) return confirmedContractId;
    if (!txnRef?.startsWith("DEP")) return null;
    const body = txnRef.slice(3);
    const sep = body.indexOf("_");
    const idPart = sep > 0 ? body.slice(0, sep) : body;
    return /^\d+$/.test(idPart) ? idPart : null;
  })();
  const returnDestination = isDepositTxn
    ? `/my-room?action=sign${parsedDepositContractId ? `&contractId=${parsedDepositContractId}` : ""}#contract-signing-section`
    : "/my-room";

  useEffect(() => {
    let active = true;

    async function verifyAndConfirm() {
      // Chuyển toàn bộ query params thành record object
      const params: Record<string, string> = {};
      searchParams.forEach((value, key) => {
        params[key] = value;
      });

      const rawAmount = searchParams.get("vnp_Amount");
      if (rawAmount) {
        const parsed = parseInt(rawAmount, 10);
        if (!isNaN(parsed)) {
          setAmountVnd(parsed / 100);
        }
      }

      // Kiểm tra sơ bộ response code từ VNPay trước
      if (responseCode !== "00") {
        if (!active) return;
        setSuccess(false);
        setMessage(
          `Giao dịch không thành công hoặc bạn đã hủy thao tác trên cổng VNPay. (Mã phản hồi: ${
            responseCode || "N/A"
          })`
        );
        setLoading(false);
        return;
      }

      try {
        const key = `${params.vnp_TxnRef || ""}:${retryCount}`;
        const res = await confirmOnce(key, params);
        if (!active) return;
        if (res.contractId != null) {
          setConfirmedContractId(String(res.contractId));
        }
        if (res.success) {
          setSuccess(true);
          setMessage(
            res.message ||
              (res.contractId != null || params.vnp_TxnRef?.startsWith("DEP")
                ? "Thanh toán tiền đặt cọc hợp đồng qua VNPay thành công!"
                : "Thanh toán hóa đơn qua VNPay thành công!")
          );
          if (res.amount) {
            setAmountVnd(res.amount);
          }
        } else {
          setSuccess(false);
          setMessage(res.message || "Xác nhận kết quả giao dịch thất bại.");
        }
      } catch (err: unknown) {
        if (!active) return;
        setSuccess(false);
        const errText = err instanceof Error ? err.message : String(err);
        setMessage("Lỗi xác nhận với máy chủ: " + errText);
      } finally {
        if (active) setLoading(false);
      }
    }

    verifyAndConfirm();

    return () => {
      active = false;
    };
  }, [searchParams, responseCode, retryCount]);

  const fmtVnd = (val: number | null) => {
    if (val === null || isNaN(val)) return "0 đ";
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(val);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden p-6 md:p-8 text-center animate-fade-in">
        {loading ? (
          <div className="py-12 flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-teal-200 border-t-teal-700 rounded-full animate-spin" />
            <h2 className="text-lg font-bold text-slate-800">Đang kiểm tra kết quả giao dịch VNPay...</h2>
            <p className="text-xs text-slate-500 max-w-xs">
              {isDepositTxn
                ? "Hệ thống đang đối soát chữ ký bảo mật và cập nhật trạng thái tiền cọc hợp đồng của bạn. Vui lòng chờ trong giây lát."
                : "Hệ thống đang đối soát chữ ký bảo mật và cập nhật trạng thái hóa đơn của bạn. Vui lòng chờ trong giây lát."}
            </p>
          </div>
        ) : success ? (
          <div className="space-y-5">
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-inner">
              <Icon name="check" size={32} />
            </div>

            <div>
              <span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold border border-emerald-200 mb-2">
                ✓ Đã thanh toán thành công
              </span>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Thanh toán hoàn tất</h2>
              <p className="mt-1 text-xs text-slate-500">{message}</p>
            </div>

            {amountVnd !== null && (
              <div className="py-3 px-4 bg-teal-50/70 border border-teal-200 rounded-2xl">
                <span className="text-xs text-teal-800 block">
                  {isDepositTxn ? "Tiền đặt cọc hợp đồng đã chuyển" : "Số tiền đã chuyển"}
                </span>
                <span className="text-2xl font-extrabold text-teal-900">{fmtVnd(amountVnd)}</span>
              </div>
            )}

            <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3.5 text-xs text-left space-y-2">
              {parsedDepositContractId && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Hợp đồng:</span>
                  <span className="font-semibold text-slate-800">#{parsedDepositContractId}</span>
                </div>
              )}
              {txnRef && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Mã tham chiếu:</span>
                  <code className="font-mono font-bold text-slate-800 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                    {txnRef}
                  </code>
                </div>
              )}
              {transactionNo && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Mã GD VNPay:</span>
                  <span className="font-semibold text-slate-800">{transactionNo}</span>
                </div>
              )}
              {bankCode && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Ngân hàng:</span>
                  <span className="font-semibold text-slate-800">{bankCode}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-1 border-t border-slate-200/60">
                <span className="text-slate-500">Cổng thanh toán:</span>
                <span className="font-semibold text-teal-700">VNPay</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate(returnDestination)}
              className="w-full cx-btn !h-11 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-teal-800/20"
            >
              <Icon name={isDepositTxn ? "contract" : "home"} size={16} />{" "}
              {isDepositTxn ? "Quay lại ký hợp đồng" : "Về trang phòng của tôi"}
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="mx-auto w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shadow-inner">
              <Icon name="alert" size={32} />
            </div>

            <div>
              <span className="inline-block px-3 py-1 bg-rose-50 text-rose-700 rounded-full text-xs font-bold border border-rose-200 mb-2">
                ✕ Chưa hoàn tất
              </span>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Giao dịch chưa hoàn thành</h2>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">{message}</p>
            </div>

            <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3 text-xs text-left space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Mã lỗi phản hồi:</span>
                <span className="font-mono font-bold text-rose-600">{responseCode || "KHÔNG_XÁC_ĐỊNH"}</span>
              </div>
              {txnRef && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Mã đơn:</span>
                  <span className="font-mono text-slate-700">{txnRef}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 pt-2">
              {responseCode === "00" && (
                <button
                  type="button"
                  onClick={() => {
                    setLoading(true);
                    setRetryCount((c) => c + 1);
                  }}
                  className="w-full cx-btn !h-11 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all"
                >
                  <Icon name="refresh" size={16} /> Thử đối soát lại với máy chủ
                </button>
              )}
              <button
                type="button"
                onClick={() => navigate(returnDestination)}
                className={`w-full cx-btn !h-11 ${
                  responseCode === "00"
                    ? "ghost text-slate-600 hover:text-slate-900"
                    : "bg-teal-700 hover:bg-teal-800 text-white shadow-md"
                } font-bold rounded-2xl flex items-center justify-center gap-2 cursor-pointer transition-all`}
              >
                <Icon name={isDepositTxn ? "contract" : "home"} size={16} />{" "}
                {isDepositTxn ? "Quay lại ký hợp đồng" : "Quay lại trang phòng của tôi"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
