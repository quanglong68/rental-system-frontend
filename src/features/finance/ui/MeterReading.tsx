import { useCallback, useEffect, useRef, useState } from "react";
import { hasAnyRole, useAuth } from "@/features/auth";
import { errorText } from "@/shared/api/errors";
import { vnd } from "@/shared/lib/format";
import { idStr, type Id } from "@/shared/lib/id";
import { useRoomLookup } from "@/shared/lib/refLabels";
import { Icon, PageHead, Pill, Tabs, useToast } from "@/shared/ui";
import {
  billingApi,
  type ClosingRoom,
  type HandoverRoom,
  type InvoicePaymentStatus,
  type MeterIndexItem,
  type MeterReadingOverview,
  type UtilityType,
} from "@/api/billing";

const errText = (e: unknown) => errorText(e);

const HANDOVER_LABEL = "Bàn giao khách mới";
type ActiveTab = "handover" | "closing";

const padMonth = (m: number, y: number) => `${String(m).padStart(2, "0")}/${y}`;

const vnTodayParts = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const pick = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  return { year: pick("year"), month: pick("month"), day: pick("day") };
};

/**
 * Phương án A (giờ Asia/Ho_Chi_Minh):
 * - Từ ngày 28 đến cuối tháng: mặc định mở kỳ tháng hiện tại để chốt sổ cuối tháng.
 * - Ngày 01..27: mặc định mở kỳ tháng trước (trong 5 ngày đầu tháng sẽ đối soát & chốt kỳ trước).
 */
const defaultPeriod = () => {
  const { year, month, day } = vnTodayParts();
  if (day >= 28) return { month, year };
  const prev = new Date(year, month - 2, 1);
  return { month: prev.getMonth() + 1, year: prev.getFullYear() };
};

const fmtIsoDateVN = (iso?: string | null) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
};

const moveInDeltaLabel = (moveInDate: string) => {
  const today = vnTodayParts();
  const [y, m, d] = moveInDate.split("-").map(Number);
  if (!y || !m || !d) return "";
  const targetMs = Date.UTC(y, m - 1, d);
  const todayMs = Date.UTC(today.year, today.month - 1, today.day);
  const diffDays = Math.round((targetMs - todayMs) / 86_400_000);
  if (diffDays === 0) return "chuyển vào hôm nay";
  if (diffDays === 1) return "ngày mai";
  if (diffDays > 1) return `còn ${diffDays} ngày nữa`;
  if (diffDays === -1) return "hôm qua";
  return `đã vào ${Math.abs(diffDays)} ngày trước`;
};

const pickElectricAndWater = (meters: MeterIndexItem[]) => {
  const elecMeter = meters.find((m) => m.utilityTypeName?.toLowerCase().includes("điện")) ?? meters[0];
  const waterMeter = meters.find((m) => m.utilityTypeName?.toLowerCase().includes("nước")) ?? elecMeter;
  return { elecMeter, waterMeter };
};

type ClosingRow = {
  roomKey: string;
  roomId: Id;
  roomNumber: string | null;
  elecMeter: MeterIndexItem;
  waterMeter: MeterIndexItem;
  sharedMeter: boolean;
  elecOld: number;
  waterOld: number;
  elecOldSource: string;
  waterOldSource: string;
  elecPrice: number;
  waterPrice: number;
  missing: boolean;
  hasExistingReadings: boolean;
  hasInvoice: boolean;
  editable: boolean;
  invoicePaymentStatus: InvoicePaymentStatus;
  changed: boolean;
  e: string;
  w: string;
};

export default function MeterReading() {
  const { user } = useAuth();
  const canWrite = hasAnyRole(user, ["QUAN_LY", "ADMIN", "KY_THUAT"]);
  const [toast, show] = useToast();

  const initialPeriod = defaultPeriod();
  const [tab, setTab] = useState<ActiveTab>("closing");
  const [selectedMonth, setSelectedMonth] = useState(initialPeriod.month);
  const [selectedYear, setSelectedYear] = useState(initialPeriod.year);

  const [utilityTypes, setUtilityTypes] = useState<UtilityType[]>([]);
  const [overview, setOverview] = useState<MeterReadingOverview | null>(null);

  const [values, setValues] = useState<Record<string, { e: string; w: string }>>({});
  const [handoverValues, setHandoverValues] = useState<Record<string, Record<string, string>>>({});
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [confirmRow, setConfirmRow] = useState<ClosingRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  const mounted = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  const autoTabbed = useRef(false);

  const cancelCurrent = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const load = useCallback(async (silent = false) => {
    cancelCurrent();
    const controller = new AbortController();
    abortRef.current = controller;

    if (!mounted.current) return;
    if (!silent) setLoading(true);
    setError("");

    try {
      const [utilityList, overviewRes] = await Promise.all([
        billingApi.utilityTypes(),
        billingApi.meterReadingOverview({ month: selectedMonth, year: selectedYear }),
      ]);
      if (!mounted.current || controller.signal.aborted) return;
      setUtilityTypes(utilityList);
      setOverview(overviewRes);
      if (!autoTabbed.current) {
        autoTabbed.current = true;
        if (overviewRes.handoverRooms.some((r) => !r.completed)) setTab("handover");
      }
    } catch (e) {
      if (!mounted.current || controller.signal.aborted) return;
      setError(errText(e));
    } finally {
      if (!mounted.current || controller.signal.aborted) return;
      setLoading(false);
      abortRef.current = null;
    }
  }, [selectedMonth, selectedYear, cancelCurrent]);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
      cancelCurrent();
    };
  }, [load, cancelCurrent]);

  useEffect(() => {
    setValues({});
    setConfirmRow(null);
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    if (!confirmRow) return;
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setConfirmRow(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirmRow]);

  const priceByType = new Map(utilityTypes.map((t) => [idStr(t.id), t.unitPrice]));
  const roomOf = useRoomLookup([
    ...(overview?.handoverRooms.map((r) => r.roomId) ?? []),
    ...(overview?.closingRooms.map((r) => r.roomId) ?? []),
    ...(overview?.missingRooms.map((r) => r.roomId) ?? []),
  ]);
  const roomLabel = (roomId: Id, fallback?: string | null) => {
    const room = roomOf(roomId);
    if (room) return `Phòng ${room.code}`;
    return fallback ? `Phòng ${fallback}` : `Phòng #${idStr(roomId)}`;
  };

  const handoverRooms = overview?.handoverRooms ?? [];
  const pendingHandoverCount = handoverRooms.filter((r) => !r.completed).length;
  const missingRooms = overview?.missingRooms ?? [];
  const missingByRoom = new Map(missingRooms.map((r) => [idStr(r.roomId), r]));

  const closingRooms: ClosingRoom[] = overview?.closingRooms ?? [];
  const roomEntries: ClosingRow[] = closingRooms
    .filter((cr) => cr.meters.length > 0)
    .sort((a, b) => roomLabel(a.roomId, a.roomNumber).localeCompare(roomLabel(b.roomId, b.roomNumber), "vi", { numeric: true }))
    .map((cr) => {
      const roomKey = idStr(cr.roomId);
      const { elecMeter, waterMeter } = pickElectricAndWater(cr.meters);
      const sharedMeter = idStr(waterMeter.meterId) === idStr(elecMeter.meterId);
      const cur = values[roomKey] ?? {
        e: elecMeter.currentIndex != null ? String(elecMeter.currentIndex) : "",
        w: waterMeter.currentIndex != null ? String(waterMeter.currentIndex) : "",
      };
      const elecChanged = elecMeter.currentIndex == null || Number(cur.e) !== elecMeter.currentIndex;
      const waterChanged = !sharedMeter && (waterMeter.currentIndex == null || Number(cur.w) !== waterMeter.currentIndex);
      return {
        roomKey,
        roomId: cr.roomId,
        roomNumber: cr.roomNumber,
        elecMeter,
        waterMeter,
        sharedMeter,
        elecOld: elecMeter.prevIndex ?? elecMeter.initialIndex,
        waterOld: waterMeter.prevIndex ?? waterMeter.initialIndex,
        elecOldSource: elecMeter.prevIndexSource ?? "bàn giao",
        waterOldSource: waterMeter.prevIndexSource ?? "bàn giao",
        elecPrice: elecMeter.unitPrice ?? (elecMeter.utilityTypeId != null ? priceByType.get(idStr(elecMeter.utilityTypeId)) : 0) ?? 0,
        waterPrice: waterMeter.unitPrice ?? (waterMeter.utilityTypeId != null ? priceByType.get(idStr(waterMeter.utilityTypeId)) : 0) ?? 0,
        missing: cr.missingReading,
        hasExistingReadings: cr.hasExistingReadings,
        hasInvoice: cr.hasInvoice,
        editable: cr.editable,
        invoicePaymentStatus: cr.invoicePaymentStatus,
        changed: elecChanged || waterChanged,
        e: cur.e,
        w: cur.w,
      };
    });

  const handleChange = (row: ClosingRow, kind: "e" | "w", value: string) => {
    setValues((prev) => ({
      ...prev,
      [row.roomKey]: { ...(prev[row.roomKey] ?? { e: row.e, w: row.w }), [kind]: value.replace(/\D/g, "") },
    }));
  };

  const handoverInputVal = (entered: Record<string, string>, meter: HandoverRoom["meters"][number]) => {
    const key = idStr(meter.meterId);
    if (key in entered) return entered[key];
    return meter.initialIndex != null ? String(meter.initialIndex) : "";
  };

  const setHandoverValue = (roomId: Id, meterId: Id, value: string) => {
    const roomKey = idStr(roomId);
    setHandoverValues((prev) => ({
      ...prev,
      [roomKey]: { ...(prev[roomKey] ?? {}), [idStr(meterId)]: value.replace(/\D/g, "") },
    }));
  };

  const executeSave = async (r: ClosingRow) => {
    const eVal = Number(r.e);
    const wVal = Number(r.w);
    setSaving((prev) => new Set([...prev, r.roomKey]));
    setActionError("");
    try {
      if (r.elecMeter.currentIndex !== eVal || r.elecMeter.readingId == null) {
        if (r.elecMeter.readingId != null) {
          await billingApi.updateMeterReading(r.elecMeter.readingId, { currentIndex: eVal });
        } else {
          await billingApi.createMeterReading({
            meterId: r.elecMeter.meterId,
            month: selectedMonth,
            year: selectedYear,
            currentIndex: eVal,
          });
        }
      }
      if (!r.sharedMeter && (r.waterMeter.currentIndex !== wVal || r.waterMeter.readingId == null)) {
        if (r.waterMeter.readingId != null) {
          await billingApi.updateMeterReading(r.waterMeter.readingId, { currentIndex: wVal });
        } else {
          await billingApi.createMeterReading({
            meterId: r.waterMeter.meterId,
            month: selectedMonth,
            year: selectedYear,
            currentIndex: wVal,
          });
        }
      }
      if (!mounted.current) return;
      show(
        r.invoicePaymentStatus === "UNPAID"
          ? `Đã cập nhật chỉ số ${roomLabel(r.roomId, r.roomNumber)} và tính lại hóa đơn`
          : `Đã lưu chỉ số ${roomLabel(r.roomId, r.roomNumber)} · hóa đơn tự sinh khi đủ chỉ số`,
      );
      setValues((prev) => {
        const next = { ...prev };
        delete next[r.roomKey];
        return next;
      });
    } catch (e) {
      if (!mounted.current) return;
      setActionError(errText(e));
    } finally {
      setConfirmRow(null);
      await load(true);
      if (!mounted.current) return;
      setSaving((prev) => {
        const next = new Set(prev);
        next.delete(r.roomKey);
        return next;
      });
    }
  };

  const handleRequestSave = (r: ClosingRow) => {
    if (!r.editable || overview?.futurePeriod) return;
    const eVal = Number(r.e);
    const wVal = Number(r.w);
    if (!r.e || (!r.sharedMeter && !r.w)) return;
    if (eVal < r.elecOld || (!r.sharedMeter && wVal < r.waterOld)) {
      setActionError(`${roomLabel(r.roomId, r.roomNumber)}: chỉ số mới không được nhỏ hơn kỳ trước.`);
      return;
    }
    if (r.invoicePaymentStatus === "UNPAID" || (r.hasExistingReadings && r.changed)) {
      setConfirmRow(r);
      return;
    }
    void executeSave(r);
  };

  const handleSaveHandover = async (room: HandoverRoom) => {
    const roomKey = idStr(room.roomId);
    const entered = handoverValues[roomKey] ?? {};
    const resolved = room.meters.map((meter) => ({
      meterId: meter.meterId,
      raw: handoverInputVal(entered, meter),
    }));
    if (resolved.some((r) => r.raw === "")) {
      setActionError(`${roomLabel(room.roomId, room.roomNumber)}: nhập đủ chỉ số bàn giao cho tất cả đồng hồ.`);
      return;
    }
    const payload = resolved.map((r) => ({ meterId: r.meterId, currentIndex: Number(r.raw) }));
    if (payload.some((r) => !Number.isFinite(r.currentIndex) || r.currentIndex < 0)) {
      setActionError(`${roomLabel(room.roomId, room.roomNumber)}: chỉ số bàn giao không hợp lệ.`);
      return;
    }

    setSaving((prev) => new Set([...prev, roomKey]));
    setActionError("");
    try {
      await billingApi.saveHandover({ contractId: room.contractId, roomId: room.roomId, readings: payload });
      if (!mounted.current) return;
      show(`Đã ghi chỉ số bàn giao ${roomLabel(room.roomId, room.roomNumber)}`);
      setHandoverValues((prev) => {
        const next = { ...prev };
        delete next[roomKey];
        return next;
      });
      await load(true);
    } catch (e) {
      if (!mounted.current) return;
      setActionError(errText(e));
    } finally {
      if (!mounted.current) return;
      setSaving((prev) => {
        const next = new Set(prev);
        next.delete(roomKey);
        return next;
      });
    }
  };

  if (loading) {
    return (
      <section className="grid min-h-[60vh] place-items-center text-center">
        <div className="flex flex-col items-center gap-3">
          <Icon name="clock" size={32} />
          <p className="text-muted">Đang tải chỉ số đồng hồ…</p>
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
          <button className="primary-button" onClick={() => void load()}>Thử lại</button>
        </div>
      </section>
    );
  }

  const currentYearVN = vnTodayParts().year;
  const monthLabel = padMonth(selectedMonth, selectedYear);
  const nextMonthDate = new Date(selectedYear, selectedMonth, 1);
  const nextMonthLabel = padMonth(nextMonthDate.getMonth() + 1, nextMonthDate.getFullYear());

  const closingTotal = roomEntries.length;
  const closingDone = roomEntries.filter((r) => !r.missing && (r.hasExistingReadings || (!!r.e && (r.sharedMeter || !!r.w)))).length;
  const handoverTabLabel = `${HANDOVER_LABEL} (${pendingHandoverCount})`;
  const closingTabLabel = `Chốt chỉ số kỳ ${monthLabel}`;

  return (
    <>
      <PageHead
        eyebrow="Bàn giao & chốt sổ · theo tòa được phân quyền"
        title="Chỉ số điện nước"
        desc="Tách riêng 2 việc: ghi chỉ số bàn giao khi khách mới ký hợp đồng và chốt chỉ số định kỳ từng tháng. Hóa đơn tự động sinh hoặc cập nhật khi đủ chỉ số."
        actions={
          <>
            <select
              className="select !h-[42px]"
              value={selectedMonth}
              onChange={(ev) => setSelectedMonth(Number(ev.target.value))}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                <option key={m} value={m}>Tháng {m}</option>
              ))}
            </select>
            <select
              className="select !h-[42px]"
              value={selectedYear}
              onChange={(ev) => setSelectedYear(Number(ev.target.value))}
            >
              {[currentYearVN - 1, currentYearVN, currentYearVN + 1].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button className="secondary-button" onClick={() => void load()}>
              <Icon name="clock" size={16} /> Tải lại
            </button>
          </>
        }
      />

      {overview && !overview.contractsAvailable && (
        <div className="alert alert-error mb-4">
          <Icon name="shield" size={18} />
          <div>Chưa lấy được danh sách hợp đồng từ dịch vụ hợp đồng. Danh sách bàn giao/chốt sổ có thể chưa đầy đủ.</div>
        </div>
      )}
      {actionError && <div className="alert alert-error mb-4"><Icon name="shield" size={18} /><div>{actionError}</div></div>}

      {overview?.futurePeriod ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 mb-4 flex items-start gap-2.5">
          <Icon name="clock" size={18} />
          <div>
            <b>Kỳ {monthLabel} chưa tới (tháng tương lai).</b> Hệ thống chỉ cho phép ghi nhận chỉ số cho tháng hiện tại hoặc các tháng trước đó.
          </div>
        </div>
      ) : overview?.firstFiveDays ? (
        <div className="alert alert-info mb-4">
          <Icon name="bell" size={18} />
          <div>
            <b>Đang trong 5 ngày đầu tháng {nextMonthLabel}.</b> Chỉ số kỳ <b>{monthLabel}</b> được nhập và đối soát trong 5 ngày đầu tháng <b>{nextMonthLabel}</b>.
            Hệ thống gửi nhắc chuông tự động mỗi ngày lúc 08:00 cho tới khi đủ chỉ số.
          </div>
        </div>
      ) : overview?.endOfMonthReminder ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 mb-4 flex items-start gap-2.5">
          <Icon name="bell" size={18} />
          <div>
            <b>Đang trong đợt chốt chỉ số cuối tháng (từ ngày 28/{monthLabel}).</b> Hãy chốt chỉ số kỳ <b>{monthLabel}</b> cho các phòng đang ở trước khi bước sang tháng {nextMonthLabel}.
          </div>
        </div>
      ) : (
        <div className="alert alert-info mb-4">
          <Icon name="clock" size={18} />
          <div>
            <b>Lịch chốt kỳ {monthLabel}:</b> Chỉ số kỳ <b>{monthLabel}</b> sẽ được nhập chính thức vào 5 ngày đầu tháng <b>{nextMonthLabel}</b> (và có thể nhập từ ngày 28/{monthLabel} trở đi).
            Bạn vẫn có thể xem, nhập trước hoặc điều chỉnh chỉ số kỳ <b>{monthLabel}</b> nếu hóa đơn chưa thanh toán.
          </div>
        </div>
      )}

      {missingRooms.length > 0 && (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 mb-4 flex items-start gap-2">
          <Icon name="shield" size={18} />
          <div>
            <b>Còn {missingRooms.length} phòng chưa nhập đủ chỉ số kỳ {monthLabel}.</b>{" "}
            Các phòng thiếu đang được đánh dấu đỏ yêu cầu nhập. Hóa đơn chỉ tự sinh khi phòng có đủ chỉ số điện và nước.
          </div>
        </div>
      )}

      <div className="mb-5">
        <Tabs
          items={[handoverTabLabel, closingTabLabel]}
          value={tab === "handover" ? handoverTabLabel : closingTabLabel}
          onChange={(v) => setTab(v.startsWith(HANDOVER_LABEL) ? "handover" : "closing")}
        />
      </div>

      {tab === "handover" ? (
        <>
          <div className="alert alert-info mb-4">
            <Icon name="home" size={18} />
            <div>
              <b>Chỉ số bàn giao</b> được kích hoạt ngay khi quản lý và khách ký xong hợp đồng. Mỗi phòng mới đã được tạo sẵn đồng hồ điện/nước với chỉ số kế thừa thực tế (khác 0);
              lưu xong dòng sẽ được đánh dấu <b>Đã nhập chỉ số bàn giao</b> và giữ lại để kỹ thuật đối chiếu.
            </div>
          </div>
          <article className="panel">
            <div className="panel-header">
              <div>
                <h2>Khách mới ký hợp đồng &amp; bàn giao phòng</h2>
                <p>Ghi chỉ số thực tế lúc giao phòng để làm mốc ban đầu cho kỳ chốt đầu tiên.</p>
              </div>
              <Pill tone={pendingHandoverCount > 0 ? "amber" : "teal"}>
                {pendingHandoverCount > 0 ? `${pendingHandoverCount} phòng chờ bàn giao` : "Đã bàn giao đủ"}
              </Pill>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Phòng</th>
                    <th>Ngày chuyển vào</th>
                    <th>Chỉ số bàn giao</th>
                    <th className="text-right">Trạng thái / Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {handoverRooms.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-10 text-center text-sm text-muted">
                        Không có khách mới nào trong kỳ cần ghi chỉ số bàn giao.
                      </td>
                    </tr>
                  )}
                  {handoverRooms.map((room) => {
                    const roomKey = idStr(room.roomId);
                    const entered = handoverValues[roomKey] ?? {};
                    const isSaving = saving.has(roomKey);
                    const complete = room.meters.every((m) => handoverInputVal(entered, m) !== "");
                    const deltaLabel = moveInDeltaLabel(room.moveInDate);
                    return (
                      <tr key={`${roomKey}-${idStr(room.contractId)}`} className="!cursor-default">
                        <td>
                          <b>{roomLabel(room.roomId, room.roomNumber)}</b>
                          <div className="sub">
                            HĐ #{idStr(room.contractId)} · {room.meters.length} đồng hồ
                          </div>
                        </td>
                        <td>
                          <b>{fmtIsoDateVN(room.moveInDate)}</b>
                          <div className="sub">
                            {room.completed && room.handoverDate
                              ? `đã ghi bàn giao ${fmtIsoDateVN(room.handoverDate)}`
                              : deltaLabel}
                          </div>
                        </td>
                        <td>
                          {room.completed ? (
                            <div className="flex flex-wrap items-center gap-2">
                              {room.meters.map((meter) => (
                                <span
                                  key={idStr(meter.meterId)}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/70 px-2.5 py-1 text-xs font-medium text-emerald-900"
                                >
                                  <span>{meter.utilityTypeName ?? "Đồng hồ"}:</span>
                                  <b>{meter.initialIndex}</b>
                                  {meter.unit && <span className="text-emerald-700">{meter.unit}</span>}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center gap-3">
                              {room.meters.map((meter) => (
                                <label key={idStr(meter.meterId)} className="flex items-center gap-2">
                                  <span className="text-xs text-muted">
                                    {meter.utilityTypeName ?? "Đồng hồ"}
                                    <span className="sub block">số hiện có: {meter.initialIndex}</span>
                                  </span>
                                  <input
                                    className="meter-input"
                                    inputMode="numeric"
                                    value={handoverInputVal(entered, meter)}
                                    onChange={(ev) => setHandoverValue(room.roomId, meter.meterId, ev.target.value)}
                                    placeholder={String(meter.initialIndex)}
                                    disabled={isSaving}
                                  />
                                </label>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="text-right">
                          {room.completed ? (
                            <Pill tone="teal">Đã nhập chỉ số bàn giao</Pill>
                          ) : isSaving ? (
                            <span className="text-xs text-muted">Đang lưu…</span>
                          ) : canWrite ? (
                            <button
                              className="text-button text-teal"
                              disabled={!complete}
                              onClick={() => void handleSaveHandover(room)}
                            >
                              Lưu bàn giao
                            </button>
                          ) : (
                            <Pill tone="amber">Chờ kỹ thuật nhập</Pill>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </article>
        </>
      ) : (
        <>
          <div className="alert alert-info mb-4">
            <Icon name="clock" size={18} />
            <div>
              <b>Quy tắc chỉnh sửa &amp; tính hóa đơn:</b> Hóa đơn chưa thanh toán cho phép kỹ thuật cập nhật lại chỉ số và hệ thống <b>tự động cập nhật hóa đơn của khách</b>.
              Khi hóa đơn kỳ đó đã thanh toán, ô nhập bị khóa để bảo toàn đối soát tài chính.
            </div>
          </div>
          <article className="panel">
            <div className="toolbar">
              <div className="flex w-full items-center gap-3">
                <span className="text-xs font-bold text-muted">Tiến độ kỳ {monthLabel}</span>
                <div className="progress-track flex-1">
                  <div style={{ width: `${closingTotal ? (closingDone / closingTotal) * 100 : 0}%` }}></div>
                </div>
                <b className="text-xs">{closingDone}/{closingTotal} phòng</b>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Phòng</th>
                    <th>Điện cũ → mới</th>
                    <th>Nước cũ → mới</th>
                    <th>Đơn giá áp dụng</th>
                    <th className="text-right">Điện + nước</th>
                    <th>Hóa đơn kỳ</th>
                    <th className="text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {roomEntries.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-sm text-muted">
                        {overview?.futurePeriod
                          ? `Kỳ ${monthLabel} chưa tới hạn chốt chỉ số.`
                          : "Không có phòng đang thuê nào trong kỳ này."}
                      </td>
                    </tr>
                  )}
                  {roomEntries.map((r) => {
                    const de = r.e ? Number(r.e) - r.elecOld : 0;
                    const dw = r.sharedMeter ? 0 : r.w ? Number(r.w) - r.waterOld : 0;
                    const bad = de < 0 || dw < 0;
                    const sum = de * r.elecPrice + dw * r.waterPrice;
                    const isSaving = saving.has(r.roomKey);
                    const rowFilled = !!r.e && (r.sharedMeter || !!r.w);
                    const missingInfo = missingByRoom.get(r.roomKey);
                    const locked = !canWrite || !r.editable || !!overview?.futurePeriod;
                    return (
                      <tr
                        key={r.roomKey}
                        className={`!cursor-default ${r.missing ? "bg-red-50/80" : ""}`}
                      >
                        <td>
                          <b>{roomLabel(r.roomId, r.roomNumber)}</b>
                          <div className="sub">
                            {r.sharedMeter
                              ? `${r.elecMeter.utilityTypeName ?? "Điện"} · chưa có đồng hồ nước riêng`
                              : `${r.elecMeter.utilityTypeName ?? "Điện"} · ${r.waterMeter.utilityTypeName ?? "Nước"}`}
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className="w-16 shrink-0 text-muted">
                              <b>{r.elecOld}</b>
                              <span className="sub block">{r.elecOldSource}</span>
                            </span>
                            →
                            <input
                              className="meter-input"
                              value={r.e}
                              onChange={(ev) => handleChange(r, "e", ev.target.value)}
                              placeholder="kWh"
                              disabled={isSaving || locked}
                            />
                          </div>
                        </td>
                        <td>
                          {r.sharedMeter ? (
                            <span className="text-xs text-muted">Chưa có đồng hồ nước</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="w-16 shrink-0 text-muted">
                                <b>{r.waterOld}</b>
                                <span className="sub block">{r.waterOldSource}</span>
                              </span>
                              →
                              <input
                                className="meter-input"
                                value={r.w}
                                onChange={(ev) => handleChange(r, "w", ev.target.value)}
                                placeholder="m³"
                                disabled={isSaving || locked}
                              />
                            </div>
                          )}
                        </td>
                        <td className="text-xs text-muted">
                          <div>{r.elecPrice ? `${vnd(r.elecPrice)}/${r.elecMeter.utilityTypeName ?? "kWh"}` : "Chưa có giá điện"}</div>
                          {!r.sharedMeter && (
                            <div>{r.waterPrice ? `${vnd(r.waterPrice)}/${r.waterMeter.utilityTypeName ?? "m³"}` : "Chưa có giá nước"}</div>
                          )}
                        </td>
                        <td className="text-right">
                          {bad ? (
                            <Pill tone="coral">Chỉ số nhỏ hơn kỳ trước</Pill>
                          ) : rowFilled ? (
                            <>
                              <b>{vnd(sum)}</b>
                              <div className="sub">{de} kWh{!r.sharedMeter ? ` · ${dw} m³` : ""}</div>
                            </>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td>
                          {r.invoicePaymentStatus === "PAID" ? (
                            <Pill tone="teal">Hóa đơn đã thanh toán</Pill>
                          ) : r.invoicePaymentStatus === "UNPAID" ? (
                            <div className="flex flex-col items-start gap-1">
                              <Pill tone="amber">Chưa thanh toán · được sửa</Pill>
                              <span className="text-[11px] text-amber-800">Lưu sẽ tự cập nhật hóa đơn</span>
                            </div>
                          ) : r.missing && !rowFilled ? (
                            <div className="flex flex-col items-start gap-1">
                              <Pill tone="coral">Yêu cầu nhập</Pill>
                              {missingInfo && (
                                <span className="text-[11px] text-red-700">
                                  Thiếu {missingInfo.meters.length} đồng hồ
                                </span>
                              )}
                            </div>
                          ) : r.hasExistingReadings ? (
                            <Pill tone="slate">Đã chốt · chờ hóa đơn</Pill>
                          ) : (
                            <span className="text-xs text-muted">Chưa chốt</span>
                          )}
                        </td>
                        <td className="text-right">
                          {r.invoicePaymentStatus === "PAID" ? (
                            <span className="text-xs font-medium text-muted">Đã khóa sửa</span>
                          ) : overview?.futurePeriod || !canWrite ? (
                            <span className="text-xs text-muted">—</span>
                          ) : !rowFilled || bad ? (
                            <span className="text-xs text-muted">—</span>
                          ) : isSaving ? (
                            <span className="text-xs text-muted">Đang lưu…</span>
                          ) : (
                            <button
                              className="text-button text-teal"
                              disabled={r.hasExistingReadings && !r.changed}
                              onClick={() => handleRequestSave(r)}
                            >
                              {r.hasExistingReadings ? "Cập nhật" : "Lưu"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </article>
        </>
      )}

      {confirmRow && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-xs"
          onClick={() => !saving.has(confirmRow.roomKey) && setConfirmRow(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-meter-title"
        >
          <div
            className="w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-2xl"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <Icon name="bell" size={20} />
              </div>
              <div>
                <h3 id="confirm-meter-title" className="m-0 text-base font-bold text-slate-900">
                  Xác nhận cập nhật chỉ số — {roomLabel(confirmRow.roomId, confirmRow.roomNumber)}
                </h3>
                <p className="mt-1 text-xs leading-5 text-muted">
                  {confirmRow.invoicePaymentStatus === "UNPAID"
                    ? `Hóa đơn kỳ ${monthLabel} của phòng này chưa được thanh toán. Khi xác nhận lưu, hệ thống sẽ cập nhật chỉ số mới và tự động tính lại hóa đơn cho khách thuê.`
                    : `Phòng này đã có chỉ số chốt kỳ ${monthLabel}. Xác nhận ghi đè chỉ số mới?`}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-line bg-[#fafbf9] p-3 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-muted">Điện kỳ {monthLabel}:</span>
                <b>
                  {confirmRow.elecMeter.currentIndex ?? "Chưa có"} → {confirmRow.e} kWh
                </b>
              </div>
              {!confirmRow.sharedMeter && (
                <div className="flex items-center justify-between">
                  <span className="text-muted">Nước kỳ {monthLabel}:</span>
                  <b>
                    {confirmRow.waterMeter.currentIndex ?? "Chưa có"} → {confirmRow.w} m³
                  </b>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="secondary-button !h-9"
                disabled={saving.has(confirmRow.roomKey)}
                onClick={() => setConfirmRow(null)}
              >
                Hủy
              </button>
              <button
                type="button"
                className="primary-button !h-9"
                disabled={saving.has(confirmRow.roomKey)}
                onClick={() => void executeSave(confirmRow)}
              >
                {saving.has(confirmRow.roomKey) ? "Đang cập nhật…" : "Xác nhận lưu"}
              </button>
            </div>
          </div>
        </div>
      )}

      {!canWrite && (
        <div className="alert alert-info mt-4">
          <Icon name="shield" size={18} />
          Vai trò chỉ được xem. Nhập chỉ số do QUẢN LÝ/KỸ THUẬT/ADMIN thực hiện.
        </div>
      )}
      {toast}
    </>
  );
}
