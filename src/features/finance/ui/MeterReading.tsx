import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/features/auth";
import { ApiError } from "@/shared/api/httpClient";
import { vnd } from "@/shared/lib/format";
import { Icon, PageHead, Pill, useToast } from "@/shared/ui";
import {
  billingApi,
  type CreateReadingRequest,
  type Meter,
  type MeterReading,
} from "@/api/billing";

function money(n: number) {
  return vnd(Math.round(n / 1000) * 1000);
}

const errText = (e: unknown) =>
  e instanceof ApiError ? `${e.code} · ${e.message}` : e instanceof Error ? e.message : "Đã xảy ra lỗi.";

export default function MeterReading() {
  const { user } = useAuth();
  const canWrite = user?.role === "QUAN_LY" || user?.role === "ADMIN" || user?.role === "KY_THUAT";
  const buildingId = user?.buildings?.[0] ? Number(user.buildings[0]) : undefined;
  const [toast, show] = useToast();

  const [meters, setMeters] = useState<Meter[]>([]);
  const [readings, setReadings] = useState<MeterReading[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [values, setValues] = useState<Record<string, { e: string; w: string }>>({});
  const [saving, setSaving] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

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
      const params = {
        month: selectedMonth,
        year: selectedYear,
        ...(buildingId != null ? { buildingId } : {}),
      };
      const [meterPage, readingPage] = await Promise.all([
        billingApi.meters(undefined, buildingId),
        billingApi.meterReadings(params),
      ]);
      if (!mounted.current || controller.signal.aborted) return;
      setMeters(meterPage);
      setReadings(readingPage.content);
      setTotalElements(readingPage.totalElements);
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
  }, [buildingId, selectedMonth, selectedYear, cancelCurrent]);

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
      cancelCurrent();
    };
  }, [load, cancelCurrent]);

  const readingByMeter = new Map<number, MeterReading>();
  readings.forEach((r) => readingByMeter.set(r.meterId, r));

  const roomsById = meters.reduce<Record<number, Meter[]>>((acc, m) => {
    (acc[m.roomId] ??= []).push(m);
    return acc;
  }, {});

  const roomEntries = Object.entries(roomsById).map(([roomIdStr, roomMeters]) => {
    const roomId = Number(roomIdStr);
    const elecMeter =
      roomMeters.find((m) => m.utilityTypeName?.toLowerCase().includes("điện")) ||
      roomMeters[0];
    const waterMeter =
      roomMeters.find((m) => m.utilityTypeName?.toLowerCase().includes("nước")) ||
      elecMeter;
    const elecReading = readingByMeter.get(elecMeter.id);
    const waterReading = readingByMeter.get(waterMeter.id);
    const key = String(roomId);
    const cur = values[key] || {
      e: elecReading?.currentIndex?.toString() ?? "",
      w: waterReading?.currentIndex?.toString() ?? "",
    };
    return {
      roomId,
      roomMeters,
      elecMeter,
      waterMeter,
      elecOld: elecReading?.currentIndex ?? elecMeter.initialIndex,
      waterOld: waterReading?.currentIndex ?? waterMeter.initialIndex,
      e: cur.e,
      w: cur.w,
    };
  });

  const handleChange = (roomId: number, kind: "e" | "w", val: string) => {
    setValues((prev) => ({
      ...prev,
      [roomId]: { ...prev[roomId], [kind]: val.replace(/\D/g, "") },
    }));
  };

  const filledCount = roomEntries.filter((r) => r.e && r.w).length;

  const handleSave = async (r: (typeof roomEntries)[0]) => {
    const eVal = Number(r.e);
    const wVal = Number(r.w);
    if (!r.e || !r.w || eVal < r.elecOld || wVal < r.waterOld) return;

    setSaving((prev) => new Set([...prev, r.roomId]));
    setActionError("");
    try {
      const body: CreateReadingRequest = {
        meterId: r.elecMeter.id,
        month: selectedMonth,
        year: selectedYear,
        currentIndex: eVal,
      };
      await billingApi.createMeterReading(body);

      const bodyW: CreateReadingRequest = {
        meterId: r.waterMeter.id,
        month: selectedMonth,
        year: selectedYear,
        currentIndex: wVal,
      };
      await billingApi.createMeterReading(bodyW);

      if (!mounted.current) return;
      show(`Đã lưu chỉ số phòng ${r.roomId}`);
      await refresh();
    } catch (e) {
      if (!mounted.current) return;
      setActionError(errText(e));
    } finally {
      if (!mounted.current) return;
      setSaving((prev) => {
        const next = new Set(prev);
        next.delete(r.roomId);
        return next;
      });
    }
  };

  const handleGenerate = async () => {
    setActionError("");
    try {
      const result = await billingApi.generateInvoices({
        month: selectedMonth,
        year: selectedYear,
        buildingId,
      });
      if (!mounted.current) return;
      show(
        `Đã sinh ${result.generatedCount} hóa đơn${
          result.skipped.length ? `, bỏ qua ${result.skipped.length} phòng` : ""
        }`,
      );
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
          <button className="primary-button" onClick={load}>Thử lại</button>
        </div>
      </section>
    );
  }

  const currentDate = new Date();
  const monthLabel = `${String(selectedMonth).padStart(2, "0")}/${selectedYear}`;

  return (
    <>
      <PageHead
        eyebrow={`Kỳ ${monthLabel} · ${buildingId != null ? "Tòa #" + buildingId : "Tất cả tòa"}`}
        title="Chốt chỉ số điện nước"
        desc={`Nhập chỉ số mới cho từng đồng hồ. Tiền điện/nước được tính từ chênh chỉ số kỳ trước.`}
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
            <button className="secondary-button" onClick={load}>
              <Icon name="clock" size={16} /> Tải lại
            </button>
            {canWrite && (
              <button
                className="primary-button"
                disabled={filledCount < roomEntries.length || busy}
                onClick={handleGenerate}
              >
                <Icon name="check" size={16} />
                {filledCount < roomEntries.length
                  ? `Phát hành hóa đơn (${filledCount}/${roomEntries.length})`
                  : "Phát hành hóa đơn"}
              </button>
            )}
          </>
        }
      />
      {actionError && <div className="alert alert-error mb-4"><Icon name="shield" size={18} /><div>{actionError}</div></div>}
      <article className="panel">
        <div className="toolbar">
          <div className="flex w-full items-center gap-3">
            <span className="text-xs font-bold text-muted">Tiến độ</span>
            <div className="progress-track flex-1">
              <div style={{ width: `${roomEntries.length ? (filledCount / roomEntries.length) * 100 : 0}%` }}></div>
            </div>
            <b className="text-xs">{filledCount}/{roomEntries.length} phòng</b>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Phòng</th>
                <th>Điện cũ → mới</th>
                <th>Nước cũ → mới</th>
                <th className="text-right">Điện + nước</th>
                <th className="text-right">Mỗi người</th>
                <th className="text-right">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {roomEntries.length === 0 && (
                <tr><td colSpan={6} className="py-10 text-center text-sm text-muted">Chưa có đồng hồ nào cho kỳ này.</td></tr>
              )}
              {roomEntries.map((r) => {
                const de = r.e ? Number(r.e) - r.elecOld : 0;
                const dw = r.w ? Number(r.w) - r.waterOld : 0;
                const bad = de < 0 || dw < 0;
                const sum = de * 3500 + dw * 18000;
                const people = r.roomMeters.length || 1;
                const isSaving = saving.has(r.roomId);
                return (
                  <tr key={r.roomId} className="!cursor-default">
                    <td>
                      <b>Phòng {r.roomId}</b>
                      <div className="sub">{people} đồng hồ</div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="w-12 text-muted">{r.elecOld}</span>
                        →
                        <input
                          className="meter-input"
                          value={r.e}
                          onChange={(ev) => handleChange(r.roomId, "e", ev.target.value)}
                          placeholder="kWh"
                          disabled={isSaving}
                        />
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="w-12 text-muted">{r.waterOld}</span>
                        →
                        <input
                          className="meter-input"
                          value={r.w}
                          onChange={(ev) => handleChange(r.roomId, "w", ev.target.value)}
                          placeholder="m³"
                          disabled={isSaving}
                        />
                      </div>
                    </td>
                    <td className="text-right">
                      {bad ? (
                        <Pill tone="coral">Chỉ số nhỏ hơn kỳ trước</Pill>
                      ) : r.e && r.w ? (
                        <>
                          <b>{money(sum)}</b>
                          <div className="sub">{de} kWh · {dw} m³</div>
                        </>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="text-right font-bold text-teal">
                      {!bad && r.e && r.w ? money(sum / people) : "—"}
                    </td>
                    <td className="text-right">
                      {!r.e || !r.w || bad ? (
                        <span className="text-xs text-muted">—</span>
                      ) : isSaving ? (
                        <span className="text-xs text-muted">Đang lưu…</span>
                      ) : canWrite ? (
                        <button
                          className="text-button text-teal"
                          disabled={busy}
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
      {!canWrite && <div className="alert alert-info mt-4"><Icon name="shield" size={18} />Vai trò chỉ được xem. Nhập chỉ số và sinh hóa đơn do QUẢN LÝ/KY THUAT/ADMIN thực hiện.</div>}
    </>
  );
}
