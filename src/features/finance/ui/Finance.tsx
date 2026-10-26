import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/features/auth";
import { ApiError } from "@/shared/api/httpClient";
import { vnd, toVNTime } from "@/shared/lib/format";
import {
  Drawer,
  Field,
  Icon,
  MiniStat,
  PageHead,
  Pill,
  Switch,
  Toolbar,
  useToast,
  type Tone,
} from "@/shared/ui";
import {
  billingApi,
  type BuildingService,
  type CreatePaymentRequest,
  type GenerateInvoiceRequest,
  type Invoice,
  type InvoiceStatus,
} from "@/api/billing";

const statusLabel: Record<InvoiceStatus, string> = {
  UNPAID: "Chưa thu",
  PARTIALLY_PAID: "Thu một phần",
  PAID: "Đã thu",
  OVERDUE: "Quá hạn",
};
const statusTone: Record<InvoiceStatus, Tone> = {
  UNPAID: "amber",
  PARTIALLY_PAID: "sky",
  PAID: "teal",
  OVERDUE: "coral",
};

const errText = (e: unknown) =>
  e instanceof ApiError ? `${e.code} · ${e.message}` : e instanceof Error ? e.message : "Đã xảy ra lỗi.";

/** Tạo invoiceId duy nhất để theo dõi trạng thái đã thu của từng người ở trong hóa đơn. */
function tenantKey(invoice: Invoice, idx: number) {
  return `${invoice.contractId}-${invoice.month}-${invoice.year}-${invoice.contractTenantId ?? idx}`;
}

/**
 * Chưa có dịch vụ hóa đơn public: api-gateway có route `/api/v1/invoices/**` nhưng
 * `billing-utility-service` chưa tồn tại trong repo (và chưa chạy). Không dựng dữ liệu giả.
 */
export default function Finance() {
  const { user } = useAuth();
  const canWrite = user?.role === "QUAN_LY" || user?.role === "ADMIN";
  const buildingId = user?.buildings?.[0] ? Number(user.buildings[0]) : undefined;
  const [toast, show] = useToast();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [services, setServices] = useState<BuildingService[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<Invoice | null>(null);
  const [paid, setPaid] = useState<Record<string, boolean>>({});
  const [cash, setCash] = useState<number | null>(null);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [genStage, setGenStage] = useState<0 | 1 | 2>(0);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [reloadWarning, setReloadWarning] = useState("");

  const mounted = useRef(true);
  const abortRef = useRef<AbortController | null>(null);

  const cancelCurrent = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const load = useCallback(async () => {
    cancelCurrent();
    const controller = new AbortController();
    abortRef.current = controller;

    if (!mounted.current) return;
    setLoading(true);
    setError("");

    try {
      const params = buildingId != null ? { buildingId } : {};
      const [invPage, svcList] = await Promise.all([
        billingApi.invoices(params),
        billingApi.buildingServices(buildingId),
      ]);
      if (!mounted.current || controller.signal.aborted) return;
      setInvoices(invPage.content);
      setTotalElements(invPage.totalElements);
      setServices(svcList);
      return true;
    } catch (e) {
      if (!mounted.current || controller.signal.aborted) return;
      setError(errText(e));
      return false;
    } finally {
      if (!mounted.current || controller.signal.aborted) return;
      setLoading(false);
      abortRef.current = null;
    }
  }, [buildingId, cancelCurrent]);

  const refresh = useCallback(async () => {
    const ok = await load();
    if (!ok) setReloadWarning("Dữ liệu chưa tải lại được. Đóng và mở lại, hoặc dùng 'Thử lại'.");
    else setReloadWarning("");
    return ok;
  }, [load]);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
      cancelCurrent();
    };
  }, [load, cancelCurrent]);

  const total = (i: Invoice) => i.totalAmount;

  const handleGenerate = async (body: GenerateInvoiceRequest) => {
    setGenStage(1);
    setActionError("");
    try {
      const result = await billingApi.generateInvoices(body);
      if (!mounted.current) return;
      setGenStage(2);
      show(
        `Đã phát hành ${result.generatedCount} hóa đơn${
          result.skipped.length ? `, bỏ qua ${result.skipped.length} phòng thiếu chỉ số` : ""
        }`,
      );
      await refresh();
    } catch (e) {
      if (!mounted.current) return;
      setGenStage(0);
      setActionError(errText(e));
    }
  };

  const handlePay = async (invoiceId: number, idx: number, amount: number) => {
    const body: CreatePaymentRequest = { invoiceId, amountPaid: amount };
    setActionError("");
    try {
      await billingApi.createPayment(body);
      if (!mounted.current) return;
      setPaid((prev) => ({ ...prev, [`${invoiceId}:${idx}`]: true }));
      setCash(null);
      show("Đã ghi nhận thu tiền mặt.");
      await refresh();
    } catch (e) {
      if (!mounted.current) return;
      setActionError(errText(e));
    }
  };

  if (loading) {
    return (
      <section className="grid min-h-[60vh] place-items-center text-center">
        <div className="flex flex-col items-center gap-3">
          <Icon name="clock" size={32} />
          <p className="text-muted">Đang tải dữ liệu tài chính…</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="grid min-h-[60vh] place-items-center text-center">
        <div className="flex flex-col items-center gap-3 text-coral">
          <Icon name="bell" size={32} />
          <p>{error}</p>
          <button className="primary-button" onClick={load}>Thử lại</button>
        </div>
      </section>
    );
  }

  const paidByTenant = (invoiceId: number, idx: number) => !!paid[`${invoiceId}:${idx}`];

  return (
    <>
      <PageHead
        eyebrow="Tài chính & Hóa đơn"
        title="Hóa đơn tháng"
        desc="Danh sách hóa đơn của khách thuê theo tòa được phân quyền. Ghi nhận thu tiền mặt tại quầy và sinh hóa đơn hàng kỳ."
        actions={
          <>
            <button className="secondary-button" onClick={() => setServicesOpen(true)}>
              <Icon name="tools" size={16} /> Bảng giá dịch vụ
            </button>
            <button className="secondary-button" onClick={load}>
              <Icon name="clock" size={16} /> Tải lại
            </button>
            {canWrite && (
              <button className="primary-button" onClick={() => setGenStage(1)}>
                <Icon name="plus" size={16} /> Sinh hóa đơn tháng
              </button>
            )}
          </>
        }
      />
      {reloadWarning && (
        <div className="alert alert-info mb-4"><Icon name="shield" size={18} /><div>{reloadWarning}</div></div>
      )}
      <section className="stats-grid mb-6">
        <MiniStat
          label="Phải thu"
          value={vnd(invoices.reduce((s, i) => s + i.totalAmount, 0))}
          note={`${invoices.length} hóa đơn`}
          tone="slate"
        />
        <MiniStat
          label="Đã thu"
          value={vnd(invoices.reduce((s, i) => s + i.paidAmount, 0))}
          note="Tổng đã thanh toán"
        />
        <MiniStat
          label="Công nợ"
          value={vnd(invoices.reduce((s, i) => s + i.totalAmount - i.paidAmount, 0))}
          note={`${invoices.filter((i) => i.status !== "PAID").length} hóa đơn chưa tất toán`}
          tone="amber"
        />
        <MiniStat
          label="Quá hạn"
          value={String(invoices.filter((i) => i.status === "OVERDUE").length)}
          note="Đã gửi nhắc nợ tự động"
          tone="coral"
        />
      </section>
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <article className="panel min-w-0">
          <Toolbar placeholder="Tìm mã hóa đơn, phòng..." />
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Hóa đơn</th>
                  <th>Người ở</th>
                  <th className="text-right">Tổng</th>
                  <th>Trạng thái</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 && (
                  <tr><td colSpan={5} className="py-10 text-center text-sm text-muted">Không có hóa đơn nào.</td></tr>
                )}
                {invoices.map((i) => (
                  <tr
                    key={tenantKey(i, 0)}
                    onClick={() => setOpen(i)}
                    className="cursor-pointer"
                  >
                    <td className="font-mono text-xs font-bold">#{i.contractId}</td>
                    <td>
                      <b>Phòng {i.roomId}</b>
                      <div className="sub">{i.month}/{i.year}</div>
                    </td>
                    <td className="text-right font-bold">{vnd(total(i))}</td>
                    <td>
                      <Pill tone={statusTone[i.status]}>{statusLabel[i.status]}</Pill>
                    </td>
                    <td><button className="text-button">Chi tiết <Icon name="chevron" size={13} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        {open && (
          <article className="panel">
            <div className="panel-header">
              <div>
                <h2>Chi tiết · Phòng {open.roomId}</h2>
                <p>HĐ#{open.contractId} · {open.month}/{open.year}</p>
              </div>
              <Pill tone={statusTone[open.status]}>{statusLabel[open.status]}</Pill>
            </div>
            <div className="p-5">
              {[
                ["Tiền phòng", open.items.find((it) => it.itemType === "RENT")?.amount ?? 0],
                ["Điện", open.items.find((it) => it.itemType === "ELECTRIC")?.amount ?? 0],
                ["Nước", open.items.find((it) => it.itemType === "WATER")?.amount ?? 0],
                [
                  "Dịch vụ",
                  open.items
                    .filter((it) => it.itemType === "SERVICE_SHARED" || it.itemType === "SERVICE_PERSONAL")
                    .reduce((s, it) => s + it.amount, 0),
                ],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between py-2 text-[13px]">
                  <span className="text-muted">{k}</span>
                  <b>{vnd(v as number)}</b>
                </div>
              ))}
              <div className="mt-2 flex justify-between border-t border-dashed border-line pt-3">
                <b>Tổng cộng</b>
                <b className="text-lg">{vnd(total(open))}</b>
              </div>
              <div className="mt-2 text-xs text-muted">
                Đã thu {vnd(open.paidAmount)} · Còn nợ {vnd(open.totalAmount - open.paidAmount)}
              </div>

              <div className="split-box mt-5">
                <div className="mb-1 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-teal">
                  <Icon name="split" size={15} /> Hóa đơn cá nhân
                </div>
                <div className="mb-2 text-[11px] text-muted">
                  Tổng {vnd(total(open))} · đã thu {vnd(open.paidAmount)}
                </div>
                <div className="flex items-center justify-between gap-2 py-2 text-[13px]">
                  <span className="truncate">Khách thuê #{open.customerId}</span>
                  <span className="flex items-center gap-2">
                    <b>{vnd(total(open))}</b>
                    {paidByTenant(open.contractId, 0) ? (
                      <span className="text-teal"><Icon name="check" size={15} /></span>
                    ) : canWrite ? (
                      <button className="text-button" onClick={() => setCash(0)}>Thu tiền mặt</button>
                    ) : null}
                  </span>
                </div>
              </div>

              <button
                className="primary-button mt-5 w-full"
                disabled={!canWrite}
                onClick={() => show("Đã gửi nhắc thanh toán cho người chưa trả")}
              >
                Gửi nhắc thanh toán
              </button>
            </div>
          </article>
        )}
      </div>

      <Drawer
        open={cash !== null && open !== null}
        eyebrow={`HĐ#${open?.contractId} · Phòng ${open?.roomId}`}
        title="Ghi nhận thu tiền mặt"
        onClose={() => setCash(null)}
        footer={
          <>
            <button className="secondary-button" onClick={() => setCash(null)}>Hủy</button>
            <button
              className="primary-button"
              disabled={busy || !open}
              onClick={() => {
                if (!open) return;
                const amount = Math.round(total(open) / 1000) * 1000;
                void handlePay(open.contractId, 0, amount);
              }}
            >
              <Icon name="check" size={15} /> Xác nhận đã thu
            </button>
          </>
        }
      >
        {cash !== null && open !== null && (
          <>
            <div className="mb-5 rounded-2xl bg-navy p-5 text-white">
              <span className="text-xs text-white/60">Khách thuê #{open.customerId}</span>
              <div className="mt-1 text-3xl font-extrabold tracking-tight text-lime">
                {vnd(total(open))}
              </div>
            </div>
            <div className="form-grid">
              <Field label="Số tiền nhận (₫)">
                <input
                  defaultValue={(Math.round(total(open) / 1000) * 1000).toLocaleString("vi-VN")}
                />
              </Field>
              <Field label="Thời điểm thu (UTC+7)">
                <input
                  type="datetime-local"
                  defaultValue={new Date().toISOString().slice(0, 16)}
                />
              </Field>
              <div className="span-2">
                <Field label="Người thu">
                  <input
                    defaultValue={`${user?.fullName ?? "Nhân viên"} · ${user?.role ?? ""}`}
                    readOnly
                  />
                </Field>
              </div>
              <div className="span-2">
                <Field label="Ghi chú">
                  <textarea placeholder="Số biên lai, mệnh giá…" />
                </Field>
              </div>
            </div>
          </>
        )}
      </Drawer>

      <Drawer
        open={servicesOpen}
        eyebrow="Bảng giá dịch vụ"
        title="Dịch vụ theo tòa"
        onClose={() => setServicesOpen(false)}
        footer={
          <>
            <button className="secondary-button" onClick={() => setServicesOpen(false)}>Đóng</button>
            <button className="primary-button" onClick={() => { setServicesOpen(false); show("Bảng giá đã xem."); }}>
              Lưu bảng giá
            </button>
          </>
        }
      >
        <div className="divide-y divide-line rounded-xl border border-line">
          {services.map((x) => (
            <div key={x.id} className="flex items-center gap-3 p-3.5">
              <div className="flex-1">
                <b className="text-sm">{x.name}</b>
                <div className="text-xs text-muted">{vnd(x.unitPrice)} / {x.unit}</div>
              </div>
            </div>
          ))}
          {services.length === 0 && (
            <div className="p-4 text-center text-xs text-muted">Chưa có dịch vụ nào cho tòa này.</div>
          )}
        </div>
      </Drawer>

      <Drawer
        open={genStage > 0}
        eyebrow="Sinh hóa đơn hàng tháng"
        title="Chốt sổ & phát hành hóa đơn"
        onClose={() => setGenStage(0)}
        footer={
          genStage === 1 ? (
            <>
              <button className="secondary-button" onClick={() => setGenStage(0)}>Hủy</button>
              <button
                className="primary-button"
                disabled={busy}
                onClick={() =>
                  void handleGenerate({
                    month: new Date().getMonth() + 1,
                    year: new Date().getFullYear(),
                    buildingId,
                  })
                }
              >
                Chạy sinh hóa đơn
              </button>
            </>
          ) : (
            <button className="primary-button" onClick={() => setGenStage(0)}>Đóng</button>
          )
        }
      >
        <div className="space-y-3">
          <div className="flex gap-3 rounded-xl border border-line p-4">
            <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-teal text-white">
              <Icon name="check" size={15} />
            </span>
            <div>
              <b className="text-sm">Chỉ số điện/nước</b>
              <div className="text-[13px]">Lấy từ chỉ số đã chốt kỳ này</div>
              <div className="text-xs text-muted">Snapshot giá tại thời điểm nhập</div>
            </div>
          </div>
          <div className="flex gap-3 rounded-xl border border-line p-4">
            <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-teal text-white">
              <Icon name="check" size={15} />
            </span>
            <div>
              <b className="text-sm">Dịch vụ theo hợp đồng</b>
              <div className="text-[13px]">{services.length} dịch vụ đã đăng ký</div>
              <div className="text-xs text-muted">Lấy từ đăng ký dịch vụ của từng hợp đồng</div>
            </div>
          </div>
          <div className="flex gap-3 rounded-xl border border-line p-4">
            <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-teal text-white">
              <Icon name="check" size={15} />
            </span>
            <div>
              <b className="text-sm">Hóa đơn cá nhân</b>
              <div className="text-[13px]">{genStage === 2 ? "Đã tạo hóa đơn" : "Chưa chạy"}</div>
              <div className="text-xs text-muted">Tổng phải thu sẽ cập nhật sau khi sinh</div>
            </div>
          </div>
        </div>
      </Drawer>

      {actionError && <div className="alert alert-error mt-4"><Icon name="shield" size={18} /><div>{actionError}</div></div>}
      {!canWrite && <div className="alert alert-info mt-4"><Icon name="shield" size={18} />Vai trò chỉ được xem. Sinh hóa đơn và thu tiền mặt do QUẢN LÝ/ADMIN thực hiện.</div>}
      {toast}
    </>
  );
}
