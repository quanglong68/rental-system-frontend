import { useCallback, useEffect, useRef, useState } from "react";
import { hasAnyRole, useAuth } from "@/features/auth";
import { errorText } from "@/shared/api/errors";
import { vnd } from "@/shared/lib/format";
import { idStr, type Id } from "@/shared/lib/id";
import { useRoomLookup } from "@/shared/lib/refLabels";
import { Icon, PageHead, Pill, Tabs, useToast } from "@/shared/ui";
import {
  billingApi,
  type HandoverRoom,
  type Meter,
  type MeterReading,
  type MeterReadingOverview,
  type UtilityType,
} from "@/api/billing";

const errText = (e: unknown) => errorText(e);

const HANDOVER_TAB = "Bàn giao khách mới";
const CLOSING_TAB = "Chốt sổ cuối tháng";

/** Kỳ chốt mặc định là tháng trước: chỉ số cuối tháng được nhập trong 5 ngày đầu tháng kế tiếp. */
const previousPeriod = () => {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() - 1);
  return { month: date.getMonth() + 1, year: date.getFullYear() };
};

export default function MeterReading() {
  const { user } = useAuth();
  const canWrite = hasAnyRole(user, ["QUAN_LY", "ADMIN", "KY_THUAT"]);
  const [toast, show] = useToast();

  const initialPeriod = previousPeriod();
  const [tab, setTab] = useState(CLOSING_TAB);
  const [selectedMonth, setSelectedMonth] = useState(initialPeriod.month);
  const [selectedYear, setSelectedYear] = useState(initialPeriod.year);

  const [meters, setMeters] = useState<Meter[]>([]);
  const [readings, setReadings] = useState<MeterReading[]>([]);
  const [prevReadings, setPrevReadings] = useState<MeterReading[]>([]);
  const [utilityTypes, setUtilityTypes] = useState<UtilityType[]>([]);
  const [overview, setOverview] = useState<MeterReadingOverview | null>(null);

  const [values, setValues] = useState<Record<string, { e: string; w: string }>>({});
  const [handoverValues, setHandoverValues] = useState<Record<string, Record<string, string>>>({});
  const [saving, setSaving] = useState<Set<string>>(new Set());
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

    const prevMonthDate = new Date(selectedYear, selectedMonth - 2, 1);
    const prevMonth = prevMonthDate.getMonth() + 1;
    const prevYear = prevMonthDate.getFullYear();
    const loadAllReadings = async (month: number, year: number) => {
      const all: MeterReading[] = [];
      for (let page = 0; ; page += 1) {
        const res = await billingApi.meterReadings({ month, year, page, size: 100 });
        all.push(...res.content);
        if (page + 1 >= res.totalPages || page >= 20) break;
      }
      return all;
    };

    try {
      const [meterList, utilityList, readingList, prevReadingList, overviewRes] = await Promise.all([
        billingApi.meters(),
        billingApi.utilityTypes(),
        loadAllReadings(selectedMonth, selectedYear),
        loadAllReadings(prevMonth, prevYear),
        billingApi.meterReadingOverview({ month: selectedMonth, year: selectedYear }),
      ]);
      if (!mounted.current || controller.signal.aborted) return;
      setMeters(meterList);
      setUtilityTypes(utilityList);
      setReadings(readingList);
      setPrevReadings(prevReadingList);
      setOverview(overviewRes);
      if (!autoTabbed.current) {
        autoTabbed.current = true;
        if (overviewRes.handoverRooms.length > 0) setTab(HANDOVER_TAB);
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

  // Giá trị nháp gắn với kỳ đang xem; đổi kỳ thì bỏ nháp cũ.
  useEffect(() => {
    setValues({});
  }, [selectedMonth, selectedYear]);

  const priceByType = new Map(utilityTypes.map((t) => [idStr(t.id), t.unitPrice]));
  const readingByMeter = new Map(readings.map((r) => [idStr(r.meterId), r]));
  const prevReadingByMeter = new Map(prevReadings.map((r) => [idStr(r.meterId), r]));
  const oldSourceLabel = (hasPrevReading: boolean, reading: (typeof readings)[number] | undefined,
    initialIndex: number) =>
    hasPrevReading ? "kỳ trước" : reading && reading.prevIndex !== initialIndex ? "kỳ gần nhất" : "bàn giao";
  const roomOf = useRoomLookup([
    ...meters.map((m) => m.roomId),
    ...(overview?.handoverRooms.map((r) => r.roomId) ?? []),
  ]);
  const roomLabel = (roomId: Id, fallback?: string | null) => {
    const room = roomOf(roomId);
    if (room) return `Phòng ${room.code}`;
    return fallback ? `Phòng ${fallback}` : `Phòng #${idStr(roomId)}`;
  };

  const roomsById = meters.reduce<Record<string, Meter[]>>((acc, meter) => {
    const key = idStr(meter.roomId);
    (acc[key] ??= []).push(meter);
    return acc;
  }, {});

  const missingRoomIds = new Set((overview?.missingRooms ?? []).map((r) => idStr(r.roomId)));
  const missingByRoom = new Map((overview?.missingRooms ?? []).map((r) => [idStr(r.roomId), r]));
  // Chỉ hiện phòng thuộc kỳ đang chốt: đã có chỉ số kỳ này hoặc được backend đánh dấu thiếu.
  // Phòng mới bàn giao trong tháng chưa thuộc kỳ chốt nào nên không lẫn vào bảng cuối tháng.
  const roomsWithClosingReading = new Set(readings.map((r) => idStr(r.roomId)));
  const closingRoomKeys = new Set([...roomsWithClosingReading, ...missingRoomIds]);

  const roomEntries = Object.entries(roomsById)
    .filter(([roomKey]) => closingRoomKeys.has(roomKey))
    .sort(([a], [b]) => a.localeCompare(b, "vi", { numeric: true }))
    .map(([roomKey, roomMeters]) => {
      const elecMeter =
        roomMeters.find((m) => m.utilityTypeName?.toLowerCase().includes("điện")) ?? roomMeters[0];
      const waterMeter =
        roomMeters.find((m) => m.utilityTypeName?.toLowerCase().includes("nước")) ?? elecMeter;
      const elecReading = readingByMeter.get(idStr(elecMeter.id));
      const waterReading = readingByMeter.get(idStr(waterMeter.id));
      const elecPrevReading = prevReadingByMeter.get(idStr(elecMeter.id));
      const waterPrevReading = prevReadingByMeter.get(idStr(waterMeter.id));
      const cur = values[roomKey] ?? {
        e: elecReading?.currentIndex?.toString() ?? "",
        w: waterReading?.currentIndex?.toString() ?? "",
      };
      return {
        roomKey,
        roomId: roomMeters[0].roomId,
        elecMeter,
        waterMeter,
        elecReading,
        waterReading,
        sharedMeter: idStr(waterMeter.id) === idStr(elecMeter.id),
        elecOld: elecPrevReading?.currentIndex ?? elecReading?.prevIndex ?? elecMeter.initialIndex,
        waterOld: waterPrevReading?.currentIndex ?? waterReading?.prevIndex ?? waterMeter.initialIndex,
        elecOldSource: oldSourceLabel(!!elecPrevReading, elecReading, elecMeter.initialIndex),
        waterOldSource: oldSourceLabel(!!waterPrevReading, waterReading, waterMeter.initialIndex),
        elecPrice: elecReading?.unitPrice ?? priceByType.get(idStr(elecMeter.utilityTypeId)) ?? 0,
        waterPrice: waterReading?.unitPrice ?? priceByType.get(idStr(waterMeter.utilityTypeId)) ?? 0,
        missing: missingRoomIds.has(roomKey),
        e: cur.e,
        w: cur.w,
      };
    });

  const handleChange = (row: (typeof roomEntries)[number], kind: "e" | "w", value: string) => {
    setValues((prev) => ({
      ...prev,
      [row.roomKey]: { ...(prev[row.roomKey] ?? { e: row.e, w: row.w }), [kind]: value.replace(/\D/g, "") },
    }));
  };

  const setHandoverValue = (roomId: Id, meterId: Id, value: string) => {
    const roomKey = idStr(roomId);
    setHandoverValues((prev) => ({
      ...prev,
      [roomKey]: { ...(prev[roomKey] ?? {}), [idStr(meterId)]: value.replace(/\D/g, "") },
    }));
  };

  const handleSave = async (r: (typeof roomEntries)[number]) => {
    const eVal = Number(r.e);
    const wVal = Number(r.w);
    if (!r.e || (!r.sharedMeter && !r.w)) return;
    if (eVal < r.elecOld || (!r.sharedMeter && wVal < r.waterOld)) {
      setActionError(`${roomLabel(r.roomId)}: chỉ số mới không được nhỏ hơn kỳ trước.`);
      return;
    }

    setSaving((prev) => new Set([...prev, r.roomKey]));
    setActionError("");
    try {
      if (!r.elecReading || r.elecReading.currentIndex !== eVal) {
        if (r.elecReading) {
          await billingApi.updateMeterReading(r.elecReading.id, { currentIndex: eVal });
        } else {
          await billingApi.createMeterReading({
            meterId: r.elecMeter.id,
            month: selectedMonth,
            year: selectedYear,
            currentIndex: eVal,
          });
        }
      }
      // Phòng chỉ có một đồng hồ thì điện và nước cùng trỏ về một meter; chỉ ghi một lần.
      if (!r.sharedMeter && (!r.waterReading || r.waterReading.currentIndex !== wVal)) {
        if (r.waterReading) {
          await billingApi.updateMeterReading(r.waterReading.id, { currentIndex: wVal });
        } else {
          await billingApi.createMeterReading({
            meterId: r.waterMeter.id,
            month: selectedMonth,
            year: selectedYear,
            currentIndex: wVal,
          });
        }
      }
      if (!mounted.current) return;
      show(`Đã lưu chỉ số ${roomLabel(r.roomId)} · hóa đơn tự sinh khi đủ chỉ số`);
    } catch (e) {
      if (!mounted.current) return;
      setActionError(errText(e));
    } finally {
      await load(true);
      if (!mounted.current) return;
      setSaving((prev) => {
        const next = new Set(prev);
        next.delete(r.roomKey);
        return next;
      });
    }
  };

  const handleSaveHandover = async (room: HandoverRoom) => {
    const roomKey = idStr(room.roomId);
    const entered = handoverValues[roomKey] ?? {};
    const readings = room.meters.map((meter) => ({
      meterId: meter.meterId,
      currentIndex: Number(entered[idStr(meter.meterId)]),
    }));
    if (readings.some((r) => entered[idStr(r.meterId)] === undefined || entered[idStr(r.meterId)] === "")) {
      setActionError(`${roomLabel(room.roomId, room.roomNumber)}: nhập đủ chỉ số bàn giao cho tất cả đồng hồ.`);
      return;
    }
    if (readings.some((r) => !Number.isFinite(r.currentIndex) || r.currentIndex < 0)) {
      setActionError(`${roomLabel(room.roomId, room.roomNumber)}: chỉ số bàn giao không hợp lệ.`);
      return;
    }

    setSaving((prev) => new Set([...prev, roomKey]));
    setActionError("");
    try {
      await billingApi.saveHandover({ roomId: room.roomId, readings });
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

  const currentDate = new Date();
  const monthLabel = `${String(selectedMonth).padStart(2, "0")}/${selectedYear}`;
  const handoverRooms = overview?.handoverRooms ?? [];
  const missingRooms = overview?.missingRooms ?? [];
  const closingTotal = closingRoomKeys.size;
  const closingDone = roomsWithClosingReading.size;

  return (
    <>
      <PageHead
        eyebrow={`Bàn giao & chốt sổ · theo tòa được phân quyền`}
        title="Chỉ số điện nước"
        desc="Tách riêng 2 việc: ghi chỉ số bàn giao khi khách chuyển vào và chốt chỉ số cuối tháng. Hóa đơn tự động sinh ngay khi đủ chỉ số."
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
              {[currentDate.getFullYear() - 1, currentDate.getFullYear(), currentDate.getFullYear() + 1].map(
                (y) => (
                  <option key={y} value={y}>{y}</option>
                ),
              )}
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

      {overview?.firstFiveDays && (
        <div className="alert alert-info mb-4">
          <Icon name="bell" size={18} />
          <div>
            <b>Đang trong 5 ngày đầu tháng.</b> Nhập chỉ số cuối tháng {monthLabel} trước ngày 05.
            Hệ thống gửi nhắc tự động vào chuông mỗi ngày lúc 08:00 cho tới khi đủ chỉ số.
          </div>
        </div>
      )}
      {missingRooms.length > 0 && (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 mb-4 flex items-start gap-2">
          <Icon name="shield" size={18} />
          <div>
            <b>Còn {missingRooms.length} phòng chưa nhập chỉ số kỳ {monthLabel}.</b>{" "}
            {overview?.firstFiveDays
              ? "Các phòng này đang được đánh dấu đỏ và yêu cầu nhập."
              : "Đã qua 5 ngày đầu tháng nhưng vẫn có thể nhập bổ sung; các phòng thiếu được đánh dấu đỏ."}{" "}
            Hóa đơn chỉ tự sinh khi phòng đã đủ chỉ số điện và nước.
          </div>
        </div>
      )}

      <div className="mb-5">
        <Tabs
          items={[`${HANDOVER_TAB} (${handoverRooms.length})`, `${CLOSING_TAB} (${monthLabel})`]}
          value={tab === HANDOVER_TAB ? `${HANDOVER_TAB} (${handoverRooms.length})` : `${CLOSING_TAB} (${monthLabel})`}
          onChange={(v) => setTab(v.startsWith(HANDOVER_TAB) ? HANDOVER_TAB : CLOSING_TAB)}
        />
      </div>

      {tab === HANDOVER_TAB ? (
        <>
          <div className="alert alert-info mb-4">
            <Icon name="home" size={18} />
            <div>
              <b>Chỉ số bàn giao</b> là mốc đầu tiên khi khách nhận phòng, không tính tiền và không tạo hóa đơn.
              Chỉ số này được dùng làm chỉ số cũ cho lần chốt cuối tháng đầu tiên của khách.
            </div>
          </div>
          <article className="panel">
            <div className="panel-header">
              <div>
                <h2>Khách chuyển vào trong tháng</h2>
                <p>Ghi chỉ số ngay ngày bàn giao; thông báo nhắc được gửi cho kỹ thuật phụ trách tòa.</p>
              </div>
              <Pill tone={handoverRooms.length ? "amber" : "teal"}>
                {handoverRooms.length ? `${handoverRooms.length} phòng chờ bàn giao` : "Đã bàn giao đủ"}
              </Pill>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Phòng</th>
                    <th>Ngày chuyển vào</th>
                    <th>Chỉ số bàn giao</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {handoverRooms.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-10 text-center text-sm text-muted">
                        Không có khách mới nào cần ghi chỉ số bàn giao.
                      </td>
                    </tr>
                  )}
                  {handoverRooms.map((room) => {
                    const roomKey = idStr(room.roomId);
                    const entered = handoverValues[roomKey] ?? {};
                    const isSaving = saving.has(roomKey);
                    const complete = room.meters.every((m) => (entered[idStr(m.meterId)] ?? "") !== "");
                    return (
                      <tr key={roomKey} className="!cursor-default">
                        <td>
                          <b>{roomLabel(room.roomId, room.roomNumber)}</b>
                          <div className="sub">
                            HĐ #{idStr(room.contractId)} · {room.meters.length} đồng hồ
                          </div>
                        </td>
                        <td>
                          <b>{new Date(room.moveInDate).toLocaleDateString("vi-VN")}</b>
                          <div className="sub">hôm nay</div>
                        </td>
                        <td>
                          <div className="flex flex-wrap items-center gap-3">
                            {room.meters.map((meter) => (
                              <label key={idStr(meter.meterId)} className="flex items-center gap-2">
                                <span className="text-xs text-muted">
                                  {meter.utilityTypeName ?? "Đồng hồ"}
                                  <span className="sub block">mốc cũ {meter.initialIndex}</span>
                                </span>
                                <input
                                  className="meter-input"
                                  inputMode="numeric"
                                  value={entered[idStr(meter.meterId)] ?? ""}
                                  onChange={(ev) => setHandoverValue(room.roomId, meter.meterId, ev.target.value)}
                                  placeholder="Chỉ số"
                                  disabled={isSaving}
                                />
                              </label>
                            ))}
                          </div>
                        </td>
                        <td className="text-right">
                          {isSaving ? (
                            <span className="text-xs text-muted">Đang lưu…</span>
                          ) : canWrite ? (
                            <button
                              className="text-button text-teal"
                              disabled={!complete}
                              onClick={() => void handleSaveHandover(room)}
                            >
                              Lưu bàn giao
                            </button>
                          ) : null}
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
              <b>Cách hệ thống lấy chỉ số cũ:</b> phòng đã chốt tháng trước lấy <b>chỉ số chốt kỳ trước</b>;
              phòng mới bàn giao chưa có chỉ số lấy <b>mốc bàn giao</b>. Lưu chỉ số xong, hóa đơn của phòng
              được sinh tự động, không cần quản lý bấm phát hành.
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
                    <th className="text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {roomEntries.length === 0 && (
                    <tr><td colSpan={6} className="py-10 text-center text-sm text-muted">Chưa có phòng nào cần chốt chỉ số cho kỳ này.</td></tr>
                  )}
                  {roomEntries.map((r) => {
                    const de = r.e ? Number(r.e) - r.elecOld : 0;
                    const dw = r.sharedMeter ? 0 : r.w ? Number(r.w) - r.waterOld : 0;
                    const bad = de < 0 || dw < 0;
                    const sum = de * r.elecPrice + dw * r.waterPrice;
                    const isSaving = saving.has(r.roomKey);
                    const rowFilled = !!r.e && (r.sharedMeter || !!r.w);
                    const missingInfo = missingByRoom.get(r.roomKey);
                    return (
                      <tr
                        key={r.roomKey}
                        className={`!cursor-default ${r.missing ? "bg-red-50/80" : ""}`}
                      >
                        <td>
                          <b>{roomLabel(r.roomId)}</b>
                          <div className="sub">
                            {r.sharedMeter
                              ? `${r.elecMeter.utilityTypeName ?? "Điện"} · chưa có đồng hồ nước riêng`
                              : `${r.elecMeter.utilityTypeName ?? "Điện"} · ${r.waterMeter.utilityTypeName ?? "Nước"}`}
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className="w-14 shrink-0 text-muted">
                              <b>{r.elecOld}</b>
                              <span className="sub block">{r.elecOldSource}</span>
                            </span>
                            →
                            <input
                              className="meter-input"
                              value={r.e}
                              onChange={(ev) => handleChange(r, "e", ev.target.value)}
                              placeholder="kWh"
                              disabled={isSaving}
                            />
                          </div>
                        </td>
                        <td>
                          {r.sharedMeter ? (
                            <span className="text-xs text-muted">Chưa có đồng hồ nước</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="w-14 shrink-0 text-muted">
                                <b>{r.waterOld}</b>
                                <span className="sub block">{r.waterOldSource}</span>
                              </span>
                              →
                              <input
                                className="meter-input"
                                value={r.w}
                                onChange={(ev) => handleChange(r, "w", ev.target.value)}
                                placeholder="m³"
                                disabled={isSaving}
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
                              <div className="sub">{de} kWh · {dw} m³</div>
                            </>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className="text-right">
                          {r.missing && !rowFilled ? (
                            <div className="flex flex-col items-end gap-1">
                              <Pill tone="coral">Yêu cầu nhập</Pill>
                              {missingInfo && (
                                <span className="text-[11px] text-red-700">
                                  Thiếu {missingInfo.meters.length} đồng hồ
                                </span>
                              )}
                            </div>
                          ) : !rowFilled || bad ? (
                            <span className="text-xs text-muted">—</span>
                          ) : isSaving ? (
                            <span className="text-xs text-muted">Đang lưu…</span>
                          ) : canWrite ? (
                            <button
                              className="text-button text-teal"
                              onClick={() => void handleSave(r)}
                            >
                              Lưu
                            </button>
                          ) : null}
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
