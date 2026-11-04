import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { hasAnyRole, useAuth } from "@/features/auth";
import { propertyApi } from "@/features/properties/api/propertyApi";
import { errorText } from "@/shared/api/errors";
import { toVNTime, vnd } from "@/shared/lib/format";
import { idStr, type Id } from "@/shared/lib/id";
import { useCustomerLookup, useRoomLookup } from "@/shared/lib/refLabels";
import {
  Drawer,
  Field,
  Icon,
  MiniStat,
  PageHead,
  Pill,
  Toolbar,
  useToast,
  formatMoneyInput,
  parseMoneyInput,
  type Tone,
} from "@/shared/ui";
import {
  billingApi,
  type BuildingService,
  type InvoiceStatus,
  type MeterReadingOverview,
  type RoomInvoice,
  type RoomInvoiceShare,
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

const PAGE_SIZE = 20;

type ServiceDraft = {
  id?: Id;
  buildingId: Id;
  name: string;
  unit: string;
  unitPrice: string;
};

const errText = (e: unknown) => errorText(e);

const toLocalInput = (date = new Date()) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

export default function Finance() {
  const { user } = useAuth();
  const canWrite = hasAnyRole(user, ["QUAN_LY", "ADMIN"]);
  // SALE chỉ xem hóa đơn, không có quyền vào trang chốt chỉ số nên không gọi API overview.
  const canReadMeter = hasAnyRole(user, ["ADMIN", "QUAN_LY", "KY_THUAT"]);
  const [toast, show] = useToast();
  const [searchParams] = useSearchParams();
  const requestedMonth = Number(searchParams.get("month"));
  const requestedYear = Number(searchParams.get("year"));
  // Link từ Tổng quan mang theo kỳ đang xem; truy cập trực tiếp thì mặc định tháng hiện tại.
  const initialMonth = requestedMonth >= 1 && requestedMonth <= 12 ? requestedMonth : new Date().getMonth() + 1;
  const initialYear = requestedYear >= 2000 && requestedYear <= 2100 ? requestedYear : new Date().getFullYear();

  const [roomInvoices, setRoomInvoices] = useState<RoomInvoice[]>([]);
  const [services, setServices] = useState<BuildingService[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState("");
  const [filterMonth, setFilterMonth] = useState(initialMonth);
  const [filterYear, setFilterYear] = useState(initialYear);
  const [selectedBuilding, setSelectedBuilding] = useState("");
  const [buildingNames, setBuildingNames] = useState<Record<string, string>>({});
  const [closingOverview, setClosingOverview] = useState<MeterReadingOverview | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openMaster, setOpenMaster] = useState<RoomInvoice | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reloadWarning, setReloadWarning] = useState("");
  const [servicesError, setServicesError] = useState("");

  const [payingShare, setPayingShare] = useState<{ share: RoomInvoiceShare; roomMaster: RoomInvoice } | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payAt, setPayAt] = useState(toLocalInput());
  const [payNote, setPayNote] = useState("");

  const [servicesOpen, setServicesOpen] = useState(false);
  const [serviceDraft, setServiceDraft] = useState<ServiceDraft | null>(null);

  const [genStage, setGenStage] = useState<0 | 1 | 2>(0);
  const [genMonth, setGenMonth] = useState(new Date().getMonth() + 1);
  const [genYear, setGenYear] = useState(new Date().getFullYear());

  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  const roomOf = useRoomLookup([...roomInvoices.map((i) => i.roomId), openMaster?.roomId]);
  const customerOf = useCustomerLookup([
    ...(openMaster?.shares?.map((s) => s.customerId) ?? []),
  ]);

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

    if (!mounted.current) return false;
    setLoading(true);
    setError("");

    try {
      const params = {
        ...(selectedBuilding ? { buildingId: selectedBuilding } : {}),
        ...(filterMonth ? { month: filterMonth } : {}),
        ...(filterYear ? { year: filterYear } : {}),
        page,
        size: PAGE_SIZE,
      };
      // Kỳ chốt sổ luôn là tháng trước: chỉ số cuối tháng được nhập trong 5 ngày đầu tháng.
      const closingDate = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
      const [invRes, svcRes, overviewRes] = await Promise.allSettled([
        billingApi.roomInvoices(params),
        billingApi.buildingServices(selectedBuilding || undefined),
        canReadMeter
          ? billingApi.meterReadingOverview({
              month: closingDate.getMonth() + 1,
              year: closingDate.getFullYear(),
            })
          : Promise.resolve(null),
      ]);
      if (!mounted.current || controller.signal.aborted) return false;
      if (invRes.status === "rejected") throw invRes.reason;

      setClosingOverview(overviewRes.status === "fulfilled" ? overviewRes.value : null);

      const items = invRes.value.content;
      setRoomInvoices(items);
      setTotalElements(invRes.value.totalElements);
      setTotalPages(invRes.value.totalPages);

      if (items.length > 0) {
        setOpenMaster((current) => {
          if (!current) return items[0];
          const matched = items.find((x) => x.id === current.id);
          return matched ?? items[0];
        });
      } else {
        setOpenMaster(null);
      }

      if (svcRes.status === "fulfilled") {
        setServices(svcRes.value);
        setServicesError("");
      } else {
        setServices([]);
        setServicesError(errText(svcRes.reason));
      }
      return true;
    } catch (e) {
      if (!mounted.current || controller.signal.aborted) return false;
      setError(errText(e));
      return false;
    } finally {
      if (mounted.current && !controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [cancelCurrent, canReadMeter, filterMonth, filterYear, page, selectedBuilding]);

  const refresh = useCallback(async () => {
    const ok = await load();
    if (!ok && mounted.current) {
      setReloadWarning("Dữ liệu chưa tải lại được từ máy chủ, hãy nhấn 'Tải lại'.");
    } else if (mounted.current) {
      setReloadWarning("");
    }
  }, [load]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancelCurrent();
    };
  }, [cancelCurrent]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await propertyApi.buildings(0, 100, "", "", "");
        if (!active) return;
        const map: Record<string, string> = {};
        res.content.forEach((b) => {
          map[idStr(b.buildingId)] = b.name;
        });
        setBuildingNames(map);
      } catch {
        // Fallback hiển thị mã tòa
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const buildingOptions = useMemo(() => {
    const map = new Map<string, string>(Object.entries(buildingNames));
    const add = (id: Id) => {
      const key = idStr(id);
      if (key && !map.has(key)) map.set(key, `Tòa #${key}`);
    };
    roomInvoices.forEach((i) => add(i.buildingId));
    services.forEach((s) => add(s.buildingId));
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [buildingNames, roomInvoices, services]);

  const visibleRoomInvoices = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return roomInvoices;
    return roomInvoices.filter((r) => {
      const room = roomOf(r.roomId);
      return [
        r.id,
        r.roomId,
        room?.code,
        r.month,
        r.year,
        ...(r.shares?.map((s) => s.customerId) ?? []),
        ...(r.shares?.map((s) => customerOf(s.customerId)) ?? []),
      ]
        .filter(Boolean)
        .map((v) => String(v).toLowerCase())
        .some((v) => v.includes(q));
    });
  }, [roomInvoices, query, roomOf, customerOf]);

  const openRoomInvoice = async (roomInvoice: RoomInvoice) => {
    setOpenMaster(roomInvoice);
    setActionError("");
    setDetailLoading(true);
    try {
      const detailed = await billingApi.roomInvoiceDetail(roomInvoice.id);
      if (mounted.current) {
        setOpenMaster(detailed);
      }
    } catch {
      // Giữ master hiện tại nếu detail lỗi nhẹ
    } finally {
      if (mounted.current) setDetailLoading(false);
    }
  };

  const startPayShare = (share: RoomInvoiceShare, roomMaster: RoomInvoice) => {
    setPayingShare({ share, roomMaster });
    const remaining = Math.max(0, (share.totalAmount ?? 0) - (share.paidAmount ?? 0));
    setPayAmount(formatMoneyInput(remaining));
    setPayAt(toLocalInput());
    setPayNote("");
    setActionError("");
  };

  const handlePay = async () => {
    if (!payingShare) return;
    const { share, roomMaster } = payingShare;
    const amount = parseMoneyInput(payAmount);
    const remaining = Math.max(0, (share.totalAmount ?? 0) - (share.paidAmount ?? 0));
    if (!Number.isFinite(amount) || amount <= 0) {
      setActionError("Số tiền thu phải lớn hơn 0.");
      return;
    }
    if (amount > remaining) {
      setActionError(`Số tiền vượt quá số còn nợ (${vnd(remaining)}).`);
      return;
    }
    setBusy(true);
    setActionError("");
    try {
      await billingApi.createPayment({
        invoiceId: share.invoiceId,
        amountPaid: amount,
        paidAt: payAt ? new Date(payAt).toISOString() : undefined,
        note: payNote.trim() || undefined,
      });
      if (!mounted.current) return;
      const custName = customerOf(share.customerId) || `Khách #${idStr(share.customerId)}`;
      show(`Đã ghi nhận thu tiền mặt cho ${custName}.`);
      setPayingShare(null);
      await refresh();
      try {
        const updated = await billingApi.roomInvoiceDetail(roomMaster.id);
        if (mounted.current) setOpenMaster(updated);
      } catch {}
    } catch (e) {
      if (!mounted.current) return;
      setActionError(errText(e));
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const handleGenerate = async () => {
    setGenStage(1);
    setActionError("");
    try {
      const result = await billingApi.generateInvoices({
        month: genMonth,
        year: genYear,
        buildingId: selectedBuilding || undefined,
      });
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

  const reloadServices = async () => {
    try {
      const list = await billingApi.buildingServices(selectedBuilding || undefined);
      if (!mounted.current) return;
      setServices(list);
      setServicesError("");
    } catch (e) {
      if (mounted.current) setServicesError(errText(e));
    }
  };

  const saveService = async () => {
    if (!serviceDraft) return;
    const name = serviceDraft.name.trim();
    const unitPrice = parseMoneyInput(serviceDraft.unitPrice);
    if (!name) {
      setActionError("Tên dịch vụ không được để trống.");
      return;
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      setActionError("Đơn giá không hợp lệ.");
      return;
    }
    setBusy(true);
    setActionError("");
    try {
      const body = {
        buildingId: serviceDraft.buildingId,
        name,
        unit: serviceDraft.unit.trim() || "month",
        unitPrice,
      };
      if (serviceDraft.id != null) {
        await billingApi.updateBuildingService(serviceDraft.id, body);
      } else {
        await billingApi.createBuildingService(body);
      }
      if (!mounted.current) return;
      setServiceDraft(null);
      show(serviceDraft.id != null ? "Đã cập nhật dịch vụ." : "Đã thêm dịch vụ.");
      await reloadServices();
    } catch (e) {
      if (!mounted.current) return;
      setActionError(errText(e));
    } finally {
      if (mounted.current) setBusy(false);
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

  const currentDate = new Date();
  const isCurrentPeriod = filterMonth === currentDate.getMonth() + 1 && filterYear === currentDate.getFullYear();
  const previousClosing = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
  const goToPreviousPeriod = () => {
    setFilterMonth(previousClosing.getMonth() + 1);
    setFilterYear(previousClosing.getFullYear());
    setPage(0);
  };

  return (
    <>
      <PageHead
        eyebrow="Hóa đơn & Công nợ"
        title={`Hóa đơn tháng ${filterMonth}/${filterYear}`}
        desc="Danh sách hóa đơn của từng phòng theo tòa được phân quyền. Hiển thị tổng tiền cả phòng và tình trạng đóng tiền độc lập của từng thành viên."
        actions={
          <>
            <button className="secondary-button" onClick={() => { setServiceDraft(null); setServicesOpen(true); }}>
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
      {closingOverview && closingOverview.missingRooms.length > 0 && (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 mb-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <Icon name="shield" size={18} />
            <div>
              <b>
                Kỳ {closingOverview.month}/{closingOverview.year} còn {closingOverview.missingRooms.length} phòng
                chưa nhập chỉ số điện nước.
              </b>{" "}
              {closingOverview.firstFiveDays
                ? "Đang trong 5 ngày đầu tháng, kỹ thuật đã được nhắc mỗi ngày trên chuông."
                : "Đã qua 5 ngày đầu tháng, vẫn có thể nhập bổ sung nhưng các phòng này đang bị đánh dấu đỏ."}{" "}
              Hóa đơn chỉ tự sinh khi phòng đủ chỉ số:{" "}
              {closingOverview.missingRooms.map((r) => r.roomNumber ?? `#${idStr(r.roomId)}`).join(", ")}.
            </div>
          </div>
          {canReadMeter && (
            <Link to="/admin/meter-readings" className="secondary-button !h-8 shrink-0 !text-xs">
              Nhập chỉ số
            </Link>
          )}
        </div>
      )}      <section className="stats-grid mb-6">
        <MiniStat
          label="Phải thu"
          value={vnd(roomInvoices.reduce((s, r) => s + r.totalAmount, 0))}
          note={`${totalElements} phòng phát hành hóa đơn kỳ ${filterMonth}/${filterYear}`}
          tone="slate"
        />
        <MiniStat
          label="Đã thu"
          value={vnd(roomInvoices.reduce((s, r) => s + r.paidAmount, 0))}
          note={`Tổng đã thanh toán của kỳ ${filterMonth}/${filterYear}`}
        />
        <MiniStat
          label="Công nợ"
          value={vnd(roomInvoices.reduce((s, r) => s + Math.max(0, r.totalAmount - r.paidAmount), 0))}
          note={`${roomInvoices.filter((r) => r.status !== "PAID").length} phòng chưa tất toán`}
          tone="amber"
        />
        <MiniStat
          label="Quá hạn"
          value={String(roomInvoices.filter((r) => r.status === "OVERDUE").length)}
          note="Hệ thống tự nhắc nợ theo lịch"
          tone="coral"
        />
      </section>
      <div className={`grid gap-6 ${openMaster ? "xl:grid-cols-[1.5fr_1fr]" : ""}`}>
        <article className="panel min-w-0">
          <Toolbar
            placeholder="Tìm mã hóa đơn, phòng, thành viên..."
            value={query}
            onChange={(ev) => setQuery(ev.target.value)}
          >
            <select
              className="select !h-[38px]"
              value={selectedBuilding}
              onChange={(ev) => { setSelectedBuilding(ev.target.value); setPage(0); }}
            >
              <option value="">Tất cả tòa</option>
              {buildingOptions.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <select
              className="select !h-[38px]"
              value={filterMonth}
              onChange={(ev) => { setFilterMonth(Number(ev.target.value)); setPage(0); }}
            >
              {Array.from({ length: 12 }, (_, idx) => idx + 1).map((m) => (
                <option key={m} value={m}>Tháng {m}</option>
              ))}
            </select>
            <select
              className="select !h-[38px]"
              value={filterYear}
              onChange={(ev) => { setFilterYear(Number(ev.target.value)); setPage(0); }}
            >
              {[currentDate.getFullYear() - 1, currentDate.getFullYear(), currentDate.getFullYear() + 1].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </Toolbar>
          {totalElements === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-surface text-teal">
                <Icon name="wallet" size={22} />
              </span>
              <div>
                <h3 className="text-base font-bold">Chưa có hóa đơn cho tháng {filterMonth}/{filterYear}</h3>
                <p className="mx-auto mt-1 max-w-lg text-sm leading-6 text-muted">
                  {selectedBuilding
                    ? "Tòa đang chọn chưa có hóa đơn trong kỳ này. Chọn “Tất cả tòa” hoặc đổi kỳ để xem hóa đơn khác."
                    : isCurrentPeriod
                      ? `Kỳ hiện tại chưa chốt sổ. Hóa đơn tháng ${filterMonth} chỉ được phát hành khi mọi phòng có đủ chỉ số điện nước; chỉ số cuối tháng được nhập trong 5 ngày đầu tháng ${filterMonth === 12 ? 1 : filterMonth + 1}.`
                      : `Kỳ ${filterMonth}/${filterYear} chưa có hóa đơn phát hành. Kiểm tra lại chỉ số điện nước hoặc chọn kỳ khác.`}
                </p>
              </div>
              <div className="mt-1 flex flex-wrap justify-center gap-2">
                <button className="secondary-button" onClick={goToPreviousPeriod}>
                  <Icon name="calendar" size={16} /> Xem kỳ {previousClosing.getMonth() + 1}/{previousClosing.getFullYear()}
                </button>
                {canReadMeter && (
                  <Link className="secondary-button" to="/admin/meter-readings">
                    <Icon name="tools" size={16} /> Nhập chỉ số
                  </Link>
                )}
                {canWrite && (
                  <button className="primary-button" onClick={() => {
                    setGenMonth(filterMonth);
                    setGenYear(filterYear);
                    setGenStage(1);
                  }}>
                    <Icon name="plus" size={16} /> Sinh hóa đơn
                  </button>
                )}
              </div>
            </div>
          ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Hóa đơn</th>
                  <th>Phòng</th>
                  <th className="text-right">Tổng cả phòng</th>
                  <th>Trạng thái</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visibleRoomInvoices.length === 0 && (
                  <tr><td colSpan={5} className="py-10 text-center text-sm text-muted">Không có hóa đơn phù hợp với từ khóa tìm kiếm.</td></tr>
                )}
                {visibleRoomInvoices.map((r) => {
                  const isSelected = openMaster?.id === r.id;
                  const room = roomOf(r.roomId);
                  const isMulti = (r.shares?.length ?? r.shareCount ?? 1) > 1;
                  return (
                    <tr
                      key={idStr(r.id)}
                      onClick={() => void openRoomInvoice(r)}
                      className={`cursor-pointer transition ${isSelected ? "bg-teal-50/60 font-medium" : ""}`}
                    >
                      <td className="font-mono text-xs font-bold text-teal-800">#{idStr(r.id)}</td>
                      <td>
                        <b className="text-slate-900 block">
                          Phòng {room?.code ?? `#${idStr(r.roomId)}`}
                        </b>
                        <div className="sub text-xs text-muted">
                          Tháng {r.month}/{r.year} · {isMulti ? `${r.shares?.length || r.shareCount} người ở ghép` : "1 người"}
                        </div>
                      </td>
                      <td className="text-right font-bold text-slate-900">{vnd(r.totalAmount)}</td>
                      <td>
                        <Pill tone={statusTone[r.status]}>{statusLabel[r.status]}</Pill>
                      </td>
                      <td>
                        <button className="text-button text-xs text-teal-700 font-semibold">
                          Chi tiết <Icon name="chevron" size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          )}
          {totalPages > 1 && (
            <div className="property-pagination">
              <span>Trang {page + 1}/{totalPages} · {totalElements} hóa đơn phòng</span>
              <button className="secondary-button !h-8" disabled={page === 0} onClick={() => setPage(page - 1)}>Trước</button>
              <button className="secondary-button !h-8" disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)}>Sau</button>
            </div>
          )}
        </article>

        {openMaster && (
          <article className="panel">
            <div className="panel-header">
              <div>
                <h2>Chi tiết · Phòng {roomOf(openMaster.roomId)?.code ?? `#${idStr(openMaster.roomId)}`}</h2>
                <p>HĐ#{idStr(openMaster.id)} · Tháng {openMaster.month}/{openMaster.year}</p>
              </div>
              <Pill tone={statusTone[openMaster.status]}>{statusLabel[openMaster.status]}</Pill>
            </div>
            <div className="p-5">
              {detailLoading && (
                <div className="mb-2 text-xs text-muted"><Icon name="clock" size={13} /> Đang tải chi tiết…</div>
              )}
              {[
                ["Tiền phòng", openMaster.rentAmount ?? 0],
                ["Điện", openMaster.electricAmount ?? 0],
                ["Nước", openMaster.waterAmount ?? 0],
                ["Dịch vụ", openMaster.serviceAmount ?? 0],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between py-2 text-[13px]">
                  <span className="text-muted">{k}</span>
                  <b>{vnd(v as number)}</b>
                </div>
              ))}

              <div className="mt-2 flex justify-between border-t border-dashed border-line pt-3">
                <b>Tổng cộng cả phòng</b>
                <b className="text-lg text-teal-800">{vnd(openMaster.totalAmount)}</b>
              </div>
              <div className="mt-2 text-xs text-muted">
                Đã thu {vnd(openMaster.paidAmount)} · Còn nợ {vnd(Math.max(0, openMaster.totalAmount - openMaster.paidAmount))}
              </div>
              <div className="mt-1 text-xs text-muted">
                Phát hành {toVNTime(openMaster.issuedAt)} · Hạn {toVNTime(openMaster.dueDate)}
              </div>
              <div className="mt-2 rounded-lg bg-surface/60 px-3 py-2 text-[11px] leading-relaxed text-muted">
                Tiền phòng, điện và nước được tính theo <b>số ngày ở thực tế</b> khi hợp đồng bắt đầu hoặc
                kết thúc giữa tháng. Ví dụ khách trả phòng ngày 11 thì kỳ đó chỉ tính 11/30 ngày, nên số tiền
                nhỏ hơn tháng đủ ngày là đúng.
              </div>

              {/* TÌNH TRẠNG ĐÓNG TIỀN CỦA TỪNG THÀNH VIÊN TRONG PHÒNG */}
              <div className="mt-5 rounded-2xl border border-line p-4 bg-surface/50">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-xs font-extrabold uppercase tracking-wider text-teal">
                    Thành viên trong phòng ({openMaster.shares?.length || openMaster.shareCount || 1} người)
                  </div>
                  <span className="text-xs text-muted">Đóng tiền độc lập</span>
                </div>
                <div className="space-y-2.5">
                  {(openMaster.shares ?? []).map((share) => {
                    const custName = customerOf(share.customerId) || `Khách #${idStr(share.customerId)}`;
                    const remainingShare = Math.max(0, (share.totalAmount ?? 0) - (share.paidAmount ?? 0));
                    const isSharePaid = share.status === "PAID";
                    return (
                      <div
                        key={idStr(share.invoiceId)}
                        className="rounded-xl border border-line bg-white p-3.5 shadow-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="grid h-7 w-7 place-items-center rounded-full bg-teal-100 font-bold text-xs text-teal-800">
                              {custName.charAt(0)}
                            </span>
                            <div>
                              <b className="text-[13px] text-slate-900 block">{custName}</b>
                              <span className="text-[11px] text-muted">
                                {share.representative ? "Đại diện hợp đồng" : "Thành viên ở ghép"} · Hóa đơn #{idStr(share.invoiceId)}
                              </span>
                            </div>
                          </div>
                          <Pill tone={statusTone[share.status]}>{statusLabel[share.status]}</Pill>
                        </div>
                        <div className="mt-2.5 flex items-center justify-between text-xs border-t border-line/60 pt-2 text-muted">
                          <span>Phần tiền:</span>
                          <span className="font-semibold text-slate-800">{vnd(share.totalAmount ?? 0)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted">
                          <span>Đã thanh toán:</span>
                          <span className="font-semibold text-emerald-600">{vnd(share.paidAmount ?? 0)}</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between pt-1 border-t border-dashed border-line">
                          <span className="text-xs font-medium">Còn thiếu: <b className={remainingShare > 0 ? "text-amber-600" : "text-emerald-600"}>{vnd(remainingShare)}</b></span>
                          {!isSharePaid && canWrite ? (
                            <button
                              type="button"
                              className="cx-btn primary !h-7 !px-3 text-xs bg-teal-700 hover:bg-teal-800"
                              onClick={() => startPayShare(share, openMaster)}
                            >
                              Thu tiền mặt
                            </button>
                          ) : isSharePaid ? (
                            <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                              <Icon name="check" size={13} /> Đã tất toán
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </article>
        )}
      </div>

      {/* MODAL GHI NHẬN THU TIỀN MẶT CHO THÀNH VIÊN */}
      <Drawer
        open={payingShare !== null}
        eyebrow={payingShare ? `Hóa đơn phòng ${roomOf(payingShare.roomMaster.roomId)?.code ?? ""} · Tháng ${payingShare.roomMaster.month}/${payingShare.roomMaster.year}` : undefined}
        title={payingShare ? `Thu tiền mặt: ${customerOf(payingShare.share.customerId) || `Khách #${idStr(payingShare.share.customerId)}`}` : "Ghi nhận thu tiền mặt"}
        onClose={() => setPayingShare(null)}
        footer={
          <>
            <button className="secondary-button" onClick={() => setPayingShare(null)}>Hủy</button>
            <button
              className="primary-button"
              disabled={busy || !payingShare}
              onClick={() => void handlePay()}
            >
              <Icon name="check" size={15} /> Xác nhận đã thu
            </button>
          </>
        }
      >
        {payingShare && (
          <>
            <div className="mb-5 rounded-2xl bg-navy p-5 text-white">
              <span className="text-xs text-white/60">
                {customerOf(payingShare.share.customerId) || `Khách #${idStr(payingShare.share.customerId)}`}
                {payingShare.share.representative ? " (Đại diện)" : " (Ở ghép)"}
              </span>
              <div className="mt-1 text-3xl font-extrabold tracking-tight text-lime">
                {vnd(Math.max(0, (payingShare.share.totalAmount ?? 0) - (payingShare.share.paidAmount ?? 0)))}
              </div>
              <div className="mt-1 text-xs text-white/60">
                Tổng phần nộp: {vnd(payingShare.share.totalAmount ?? 0)} · Đã thu: {vnd(payingShare.share.paidAmount ?? 0)}
              </div>
            </div>
            <div className="form-grid">
              <Field
                label="Số tiền nhận (₫)"
                hint={`Tối đa ${vnd(Math.max(0, (payingShare.share.totalAmount ?? 0) - (payingShare.share.paidAmount ?? 0)))}`}
              >
                <input
                  inputMode="numeric"
                  value={payAmount}
                  onChange={(ev) => setPayAmount(formatMoneyInput(ev.target.value))}
                  className="font-semibold text-teal-800"
                />
              </Field>
              <Field label="Thời điểm thu (UTC+7)">
                <input type="datetime-local" value={payAt} onChange={(ev) => setPayAt(ev.target.value)} />
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
                  <textarea
                    placeholder="Số biên lai, ghi chú thu tiền mặt…"
                    value={payNote}
                    onChange={(ev) => setPayNote(ev.target.value)}
                  />
                </Field>
              </div>
            </div>
          </>
        )}
      </Drawer>

      <Drawer
        open={servicesOpen}
        eyebrow="Bảng giá dịch vụ"
        title={selectedBuilding ? `Dịch vụ · ${buildingNames[selectedBuilding] ?? `Tòa #${selectedBuilding}`}` : "Dịch vụ theo tòa"}
        onClose={() => { setServicesOpen(false); setServiceDraft(null); }}
        footer={<button className="secondary-button" onClick={() => { setServicesOpen(false); setServiceDraft(null); }}>Đóng</button>}
      >
        {servicesError && (
          <div className="alert alert-error mb-3"><Icon name="shield" size={18} /><div>{servicesError}</div></div>
        )}
        {!selectedBuilding && canWrite && (
          <div className="alert alert-info mb-3">
            <Icon name="shield" size={18} />
            <div>Chọn một tòa nhà ở bộ lọc phía trên để thêm hoặc sửa bảng giá.</div>
          </div>
        )}
        <div className="divide-y divide-line rounded-xl border border-line">
          {services.map((x) => (
            <div key={idStr(x.id)} className="flex items-center gap-3 p-3.5">
              <div className="flex-1">
                <b className="text-sm">{x.name}</b>
                <div className="text-xs text-muted">
                  {vnd(x.unitPrice)} / {x.unit} · {buildingNames[idStr(x.buildingId)] ?? `Tòa #${idStr(x.buildingId)}`}
                </div>
              </div>
              {canWrite && (
                <button
                  className="text-button"
                  onClick={() => {
                    setActionError("");
                    setServiceDraft({
                      id: x.id,
                      buildingId: x.buildingId,
                      name: x.name,
                      unit: x.unit,
                      unitPrice: formatMoneyInput(x.unitPrice),
                    });
                  }}
                >
                  Sửa
                </button>
              )}
            </div>
          ))}
          {services.length === 0 && (
            <div className="p-4 text-center text-xs text-muted">Chưa có dịch vụ nào cho tòa này.</div>
          )}
        </div>

        {canWrite && selectedBuilding && !serviceDraft && (
          <button
            className="secondary-button mt-3 w-full"
            onClick={() => {
              setActionError("");
              setServiceDraft({ buildingId: selectedBuilding, name: "", unit: "month", unitPrice: "" });
            }}
          >
            <Icon name="plus" size={15} /> Thêm dịch vụ
          </button>
        )}

        {serviceDraft && (
          <div className="mt-4 rounded-xl border border-line p-4">
            <b className="mb-3 block text-sm">
              {serviceDraft.id != null ? "Sửa dịch vụ" : "Dịch vụ mới"}
            </b>
            <div className="form-grid">
              <div className="span-2">
                <Field label="Tên dịch vụ">
                  <input
                    value={serviceDraft.name}
                    onChange={(ev) => setServiceDraft({ ...serviceDraft, name: ev.target.value })}
                    placeholder="Ví dụ: Phí gửi xe"
                  />
                </Field>
              </div>
              <Field label="Đơn vị">
                <input
                  value={serviceDraft.unit}
                  onChange={(ev) => setServiceDraft({ ...serviceDraft, unit: ev.target.value })}
                  placeholder="month / xe / người"
                />
              </Field>
              <Field label="Đơn giá (₫)" hint={serviceDraft.unitPrice ? `${parseMoneyInput(serviceDraft.unitPrice).toLocaleString("vi-VN")} ₫` : undefined}>
                <input
                  inputMode="numeric"
                  value={serviceDraft.unitPrice}
                  onChange={(ev) => setServiceDraft({ ...serviceDraft, unitPrice: formatMoneyInput(ev.target.value) })}
                />
              </Field>
              <div className="span-2 flex justify-end gap-2">
                <button className="secondary-button" onClick={() => setServiceDraft(null)}>Hủy</button>
                <button className="primary-button" disabled={busy} onClick={() => void saveService()}>Lưu</button>
              </div>
            </div>
          </div>
        )}
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
              <button className="primary-button" disabled={busy} onClick={() => void handleGenerate()}>
                Chạy sinh hóa đơn
              </button>
            </>
          ) : (
            <button className="primary-button" onClick={() => setGenStage(0)}>Đóng</button>
          )
        }
      >
        <div className="space-y-3">
          <div className="alert alert-info">
            <Icon name="bell" size={18} />
            <div>
              Hóa đơn <b>tự động sinh ngay khi phòng có đủ chỉ số điện nước</b>. Nút này chỉ dùng để chốt sổ
              bổ sung cho các phòng đã có chỉ số nhưng chưa sinh hóa đơn (ví dụ chạy lại sau sự cố).
            </div>
          </div>
          <div className="form-grid">
            <Field label="Tháng">
              <select className="select" value={genMonth} onChange={(ev) => setGenMonth(Number(ev.target.value))}>
                {Array.from({ length: 12 }, (_, idx) => idx + 1).map((m) => (
                  <option key={m} value={m}>Tháng {m}</option>
                ))}
              </select>
            </Field>
            <Field label="Năm">
              <select className="select" value={genYear} onChange={(ev) => setGenYear(Number(ev.target.value))}>
                {[currentDate.getFullYear() - 1, currentDate.getFullYear()].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </Field>
            <div className="span-2">
              <Field label="Phạm vi">
                <input
                  readOnly
                  value={selectedBuilding ? buildingNames[selectedBuilding] ?? `Tòa #${selectedBuilding}` : "Tất cả tòa được phân quyền"}
                />
              </Field>
            </div>
          </div>
          <div className="flex gap-3 rounded-xl border border-line p-4">
            <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-teal text-white">
              <Icon name="check" size={15} />
            </span>
            <div>
              <b className="text-sm">Chỉ số điện/nước</b>
              <div className="text-[13px]">Lấy từ chỉ số đã chốt kỳ này</div>
              <div className="text-xs text-muted">Phòng thiếu chỉ số sẽ được báo bỏ qua</div>
            </div>
          </div>
          <div className="flex gap-3 rounded-xl border border-line p-4">
            <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-teal text-white">
              <Icon name="check" size={15} />
            </span>
            <div>
              <b className="text-sm">Dịch vụ theo hợp đồng</b>
              <div className="text-[13px]">{services.length} dịch vụ trong bảng giá</div>
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
              <div className="text-xs text-muted">Mỗi người ở nhận một hóa đơn riêng</div>
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
