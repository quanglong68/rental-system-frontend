import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Icon, PageHead, Pill, toVNTime, vnd, type IconName, type Tone } from "@/shared/ui";
import { propertyApi, type Room } from "@/features/properties/api/propertyApi";
import { bookingApi } from "@/api/booking";
import { billingApi, type InvoiceStatus, type RoomInvoiceSummary } from "@/api/billing";
import { getNotifications, type NotificationItem } from "@/api/userNotification";
import { errorText } from "@/shared/api/errors";
import { idStr, type Id } from "@/shared/lib/id";
import { useRoomLookup } from "@/shared/lib/refLabels";

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

const chipBg: Record<Tone, string> = {
  teal: "#e3f3ee",
  amber: "#fff5d9",
  coral: "#ffebe6",
  slate: "#eef2f0",
  sky: "#e3f1fb",
  violet: "#efeafd",
};
const chipFg: Record<Tone, string> = {
  teal: "#0f6157",
  amber: "#a86608",
  coral: "#b94730",
  slate: "#4b5b61",
  sky: "#1f6a99",
  violet: "#6247b8",
};

const isOccupied = (room: Room) => room.status === "OCCUPIED" || room.status === "UPCOMING_VACANT";

/** Số tiền rút gọn cho nhãn trục biểu đồ. */
const compactMoney = (value: number) => {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} tỷ`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tr`;
  if (value >= 1_000) return `${(value / 1_000).toLocaleString("vi-VN", { maximumFractionDigits: 0 })} ng`;
  return value.toLocaleString("vi-VN");
};

const percent = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 1000) / 10 : null);

async function loadAllRooms(): Promise<Room[]> {
  const all: Room[] = [];
  for (let page = 0; page < 50; page += 1) {
    const res = await propertyApi.rooms(undefined, page, "roomCode,asc");
    all.push(...(res.content ?? []));
    if (page + 1 >= (res.totalPages ?? 1)) break;
  }
  return all;
}

type TodoItem = {
  key: string;
  label: string;
  count: number | null;
  note: string;
  to: string;
  icon: IconName;
  tone: Tone;
};

export default function Dashboard() {
  const navigate = useNavigate();

  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();
  const previousDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const previousMonth = previousDate.getMonth() + 1;
  const previousYear = previousDate.getFullYear();
  // Kỳ chốt sổ luôn là tháng trước: chỉ số cuối tháng được nhập trong 5 ngày đầu tháng.
  const closingMonth = previousMonth;
  const closingYear = previousYear;

  const [month, setMonth] = useState(previousMonth);
  const [year, setYear] = useState(previousYear);
  const [reloadToken, setReloadToken] = useState(0);

  const [summary, setSummary] = useState<RoomInvoiceSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState("");

  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [buildingNames, setBuildingNames] = useState<Map<string, string> | null>(null);
  const [pendingRequests, setPendingRequests] = useState<number | null>(null);
  const [pendingAppointments, setPendingAppointments] = useState<number | null>(null);
  const [missingMeters, setMissingMeters] = useState<number | null>(null);
  const [activities, setActivities] = useState<NotificationItem[]>([]);
  const [activityError, setActivityError] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);

  const reload = () => setReloadToken((value) => value + 1);
  const invoicesLink = `/admin/invoices?month=${month}&year=${year}`;

  useEffect(() => {
    let cancelled = false;
    setSummary(null);
    setSummaryLoading(true);
    setSummaryError("");

    void (async () => {
      try {
        const data = await billingApi.roomInvoiceSummary({ month, year });
        if (!cancelled) setSummary(data);
      } catch (error) {
        if (!cancelled) setSummaryError(errorText(error));
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [month, year, reloadToken]);

  useEffect(() => {
    let cancelled = false;
    const failures: string[] = [];

    void (async () => {
      const [buildingRes, roomRes, requestRes, appointmentRes, meterRes, notificationRes] = await Promise.allSettled([
        propertyApi.buildings(0, 100, "", "", ""),
        loadAllRooms(),
        bookingApi.manageRentalRequests({ status: "PENDING", page: 0, size: 1 }),
        bookingApi.searchAppointments({ status: "SCHEDULED", page: 0, size: 1 }),
        billingApi.meterReadingOverview({ month: closingMonth, year: closingYear }),
        getNotifications(0, false, 20),
      ]);
      if (cancelled) return;

      if (buildingRes.status === "fulfilled") {
        setBuildingNames(new Map(buildingRes.value.content.map((b) => [idStr(b.buildingId), b.name])));
      } else {
        failures.push("tên tòa nhà");
      }

      if (roomRes.status === "fulfilled") {
        setRooms(roomRes.value);
      } else {
        failures.push("tình trạng phòng");
      }

      if (requestRes.status === "fulfilled") {
        setPendingRequests(requestRes.value.totalElements);
      } else {
        failures.push("yêu cầu thuê chờ duyệt");
      }

      if (appointmentRes.status === "fulfilled") {
        setPendingAppointments(appointmentRes.value.totalElements);
      } else {
        failures.push("lịch hẹn chờ xác nhận");
      }

      if (meterRes.status === "fulfilled") {
        setMissingMeters(meterRes.value.missingRooms.length);
      } else {
        failures.push("phòng thiếu chỉ số");
      }

      if (notificationRes.status === "fulfilled") {
        const seen = new Set<string>();
        const unique = (notificationRes.value.content ?? []).filter((item) => {
          const key = `${item.title}|${item.content}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setActivities(unique.slice(0, 6));
        setActivityError(false);
      } else {
        setActivityError(true);
        failures.push("hoạt động gần đây");
      }

      setProblems(failures);
    })();

    return () => { cancelled = true; };
  }, [closingMonth, closingYear, reloadToken]);

  const monthSummary = summary?.monthSummary;
  const yearSummary = summary?.yearSummary;
  const monthly = summary?.monthly ?? [];
  const topDebt = summary?.topDebtRooms ?? [];

  const roomOf = useRoomLookup(topDebt.map((item) => item.roomId));
  const buildingName = (id: Id) => buildingNames?.get(idStr(id)) ?? `Tòa #${idStr(id)}`;

  const occupancy = useMemo(() => {
    const total = rooms?.length ?? 0;
    const occupied = rooms?.filter(isOccupied).length ?? 0;
    return { total, occupied, rate: percent(occupied, total) };
  }, [rooms]);

  const roomsByBuilding = useMemo(() => {
    const map = new Map<string, Room[]>();
    for (const room of rooms ?? []) {
      const bucket = map.get(idStr(room.buildingId)) ?? [];
      bucket.push(room);
      map.set(idStr(room.buildingId), bucket);
    }
    return map;
  }, [rooms]);

  const buildingRows = useMemo(() => {
    return (summary?.byBuilding ?? []).map((row) => {
      const own = roomsByBuilding.get(idStr(row.buildingId)) ?? [];
      const total = rooms ? own.length : null;
      const occupied = rooms ? own.filter(isOccupied).length : null;
      return {
        ...row,
        name: buildingNames?.get(idStr(row.buildingId)) ?? `Tòa #${idStr(row.buildingId)}`,
        total,
        occupied,
        rate: occupied != null && total != null ? percent(occupied, total) : null,
      };
    });
  }, [summary, rooms, roomsByBuilding, buildingNames]);

  const collectRate = monthSummary ? percent(monthSummary.paid, monthSummary.billed) : null;
  const yearCollectRate = yearSummary ? percent(yearSummary.paid, yearSummary.billed) : null;

  const hasChartData = (yearSummary?.invoiceCount ?? 0) > 0;
  const chartMax = Math.max(
    1,
    ...monthly.map((point) => Math.max(point.billed, point.paid)),
  );
  const chartX = (index: number) => (monthly.length <= 1 ? 350 : (index * 700) / (monthly.length - 1));
  const chartY = (value: number) => 220 - (value / chartMax) * 180;
  const billedPath = monthly
    .map((point, index) => `${index === 0 ? "M" : "L"}${chartX(index).toFixed(1)} ${chartY(point.billed).toFixed(1)}`)
    .join(" ");
  const paidPath = monthly
    .map((point, index) => `${index === 0 ? "M" : "L"}${chartX(index).toFixed(1)} ${chartY(point.paid).toFixed(1)}`)
    .join(" ");
  const paidArea = paidPath ? `${paidPath} L700 240 L0 240 Z` : "";
  const lastPoint = monthly.length > 0 ? monthly[monthly.length - 1] : null;

  const costParts = [
    { label: "Tiền phòng", value: monthSummary?.rent ?? 0, color: "#16796f" },
    { label: "Điện", value: monthSummary?.electric ?? 0, color: "#f2b33d" },
    { label: "Nước", value: monthSummary?.water ?? 0, color: "#3b9bd6" },
    { label: "Dịch vụ", value: monthSummary?.service ?? 0, color: "#8467e0" },
  ];
  const costTotal = costParts.reduce((sum, part) => sum + part.value, 0);

  const todoItems: TodoItem[] = [
    {
      key: "overdue",
      label: "Hóa đơn quá hạn",
      count: monthSummary?.overdueCount ?? null,
      note: `Kỳ ${month}/${year}`,
      to: invoicesLink,
      icon: "wallet",
      tone: "coral",
    },
    {
      key: "meters",
      label: "Phòng thiếu chỉ số",
      count: missingMeters,
      note: `Kỳ chốt ${closingMonth}/${closingYear}`,
      to: "/admin/meter-readings",
      icon: "calendar",
      tone: "amber",
    },
    {
      key: "requests",
      label: "Yêu cầu thuê chờ duyệt",
      count: pendingRequests,
      note: "Khách gửi yêu cầu thuê",
      to: "/admin/leads",
      icon: "contract",
      tone: "sky",
    },
    {
      key: "appointments",
      label: "Lịch hẹn chờ xác nhận",
      count: pendingAppointments,
      note: "Lịch xem phòng",
      to: "/admin/leads",
      icon: "clock",
      tone: "violet",
    },
  ];
  const todoReady = todoItems.every((item) => item.count != null);
  const totalTodo = todoItems.reduce((sum, item) => sum + (item.count ?? 0), 0);

  const isCurrentPeriod = month === currentMonth && year === currentYear;
  const isPreviousPeriod = month === previousMonth && year === previousYear;
  const yearOptions = Array.from({ length: 5 }, (_, index) => currentYear - 3 + index);

  const selectPeriod = (nextMonth: number, nextYear: number) => {
    setMonth(nextMonth);
    setYear(nextYear);
  };

  return (
    <>
      <PageHead
        eyebrow="Tổng quan vận hành"
        title={`Tổng quan tháng ${month}/${year}`}
        desc="Một nơi duy nhất để xem phát hành, thu tiền, công nợ và hiệu suất vận hành theo kỳ. Số liệu lấy từ hóa đơn phòng đã phát hành."
        actions={
          <>
            <button className="secondary-button" onClick={reload} disabled={summaryLoading}>
              <Icon name="refresh" size={16} /> Tải lại
            </button>
            <Link className="primary-button" to={invoicesLink}>
              <Icon name="wallet" size={16} /> Quản lý hóa đơn
            </Link>
          </>
        }
      />

      <section className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-bold text-ink">
          <Icon name="calendar" size={16} /> Kỳ báo cáo
        </div>
        <select
          className="select"
          value={month}
          onChange={(event) => selectPeriod(Number(event.target.value), year)}
          aria-label="Chọn tháng"
        >
          {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => (
            <option key={value} value={value}>Tháng {value}</option>
          ))}
        </select>
        <select
          className="select"
          value={year}
          onChange={(event) => selectPeriod(month, Number(event.target.value))}
          aria-label="Chọn năm"
        >
          {yearOptions.map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
        <div className="segmented">
          <button
            className={isPreviousPeriod ? "selected" : ""}
            onClick={() => selectPeriod(previousMonth, previousYear)}
          >
            Tháng trước
          </button>
          <button
            className={isCurrentPeriod ? "selected" : ""}
            onClick={() => selectPeriod(currentMonth, currentYear)}
          >
            Tháng này
          </button>
        </div>
        <span className="ml-auto text-xs text-muted">
          {isCurrentPeriod
            ? "Kỳ hiện tại có thể chưa chốt sổ nên chưa có hóa đơn."
            : `Đang xem kỳ ${month}/${year}.`}
        </span>
      </section>

      {problems.length > 0 && (
        <div className="alert alert-error mb-6">
          <Icon name="shield" size={18} />
          <div>
            Không tải được {problems.join(", ")}. Các số liệu còn lại vẫn hiển thị bình thường.{" "}
            <button className="font-bold underline" onClick={reload}>Thử lại</button>
          </div>
        </div>
      )}

      {summaryLoading && (
        <section className="panel grid min-h-[320px] place-items-center p-8 text-center">
          <div className="flex flex-col items-center gap-3 text-muted">
            <Icon name="clock" size={30} />
            <p>Đang tổng hợp số liệu kỳ {month}/{year}…</p>
          </div>
        </section>
      )}

      {!summaryLoading && summaryError && (
        <section className="panel grid min-h-[320px] place-items-center p-8 text-center">
          <div className="flex flex-col items-center gap-3 text-coral">
            <Icon name="bell" size={30} />
            <div>
              <b>Không tải được báo cáo kỳ {month}/{year}.</b>
              <p className="mt-1 text-sm text-muted">{summaryError}</p>
            </div>
            <button className="primary-button" onClick={reload}>Thử lại</button>
          </div>
        </section>
      )}

      {!summaryLoading && !summaryError && summary && (
        <>
          {monthSummary && monthSummary.invoiceCount === 0 && (
            <div className="alert alert-info mb-6">
              <Icon name="calendar" size={18} />
              <div>
                <b>Kỳ {month}/{year} chưa có hóa đơn phát hành.</b> Kỳ này có thể chưa chốt sổ;
                số liệu tháng đang bằng 0. Lũy kế năm và biểu đồ vẫn hiển thị các kỳ đã phát hành.
              </div>
            </div>
          )}

          <section className="stats-grid">
            <article className="stat-card">
              <div className="flex items-start justify-between gap-2">
                <span className="stat-label">Phát hành tháng {month}</span>
                <span className="status-pill slate">{monthSummary?.invoiceCount ?? 0} hóa đơn</span>
              </div>
              <div className="stat-value !text-[24px]">{vnd(monthSummary?.billed ?? 0)}</div>
              <div className="stat-foot">
                <span className="dot dot-slate" /> Tổng tiền các hóa đơn phòng trong kỳ
              </div>
            </article>

            <article className="stat-card">
              <div className="flex items-start justify-between gap-2">
                <span className="stat-label">Đã thu tháng {month}</span>
                <span className="status-pill teal">
                  {monthSummary?.paidCount ?? 0}/{monthSummary?.invoiceCount ?? 0} tất toán
                </span>
              </div>
              <div className="stat-value !text-[24px]">{vnd(monthSummary?.paid ?? 0)}</div>
              <div className="progress-track">
                <div style={{ width: `${Math.min(100, collectRate ?? 0)}%` }} />
              </div>
              <div className="stat-foot">
                <span className="dot dot-teal" />
                {collectRate == null ? "Chưa có số phát hành" : `Tỷ lệ thu ${collectRate}% trên tổng phát hành`}
              </div>
            </article>

            <article className="stat-card">
              <div className="flex items-start justify-between gap-2">
                <span className="stat-label">Còn nợ tháng {month}</span>
                <span className={`status-pill ${(monthSummary?.overdueCount ?? 0) > 0 ? "coral" : "teal"}`}>
                  {monthSummary?.overdueCount ?? 0} quá hạn
                </span>
              </div>
              <div className="stat-value !text-[24px]">{vnd(monthSummary?.debt ?? 0)}</div>
              <div className="stat-foot">
                <span className="dot dot-amber" />
                {(monthSummary?.invoiceCount ?? 0) - (monthSummary?.paidCount ?? 0)} hóa đơn chưa tất toán
              </div>
            </article>

            <article className="stat-card">
              <div className="flex items-start justify-between gap-2">
                <span className="stat-label">Tỷ lệ lấp đầy</span>
                <span className="status-pill sky">{occupancy.total} phòng</span>
              </div>
              <div className="stat-value">
                {occupancy.rate == null ? "—" : occupancy.rate}
                <small>{occupancy.rate == null ? "" : "%"}</small>
              </div>
              {occupancy.rate != null && (
                <div className="progress-track">
                  <div style={{ width: `${Math.min(100, occupancy.rate)}%` }} />
                </div>
              )}
              <div className="stat-foot">
                {rooms == null
                  ? "Đang tải tình trạng phòng"
                  : `${occupancy.occupied}/${occupancy.total} phòng đang có khách`}
              </div>
            </article>
          </section>

          <article className="panel mt-6">
            <div className="panel-header">
              <div>
                <h2>Lũy kế năm {year}</h2>
                <p>Tổng hợp toàn bộ hóa đơn phòng đã phát hành trong năm {year}</p>
              </div>
              <Link className="text-button" to={invoicesLink}>
                Quản lý hóa đơn <Icon name="arrow" size={15} />
              </Link>
            </div>
            <div className="grid gap-6 p-5 xl:grid-cols-[1.35fr_1fr]">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div>
                  <span className="stat-label !text-[11px]">Phát hành cả năm</span>
                  <b className="mt-2 block text-[15px] font-extrabold leading-tight">{vnd(yearSummary?.billed ?? 0)}</b>
                  <span className="mt-1 block text-xs text-muted">{yearSummary?.invoiceCount ?? 0} hóa đơn phòng</span>
                </div>
                <div>
                  <span className="stat-label !text-[11px]">Đã thu cả năm</span>
                  <b className="mt-2 block text-[15px] font-extrabold leading-tight text-teal-800">{vnd(yearSummary?.paid ?? 0)}</b>
                  <span className="mt-1 block text-xs text-muted">Tỷ lệ thu {yearCollectRate ?? 0}%</span>
                </div>
                <div>
                  <span className="stat-label !text-[11px]">Còn nợ cả năm</span>
                  <b className="mt-2 block text-[15px] font-extrabold leading-tight text-amber-700">{vnd(yearSummary?.debt ?? 0)}</b>
                  <span className="mt-1 block text-xs text-muted">{yearSummary?.overdueCount ?? 0} hóa đơn quá hạn</span>
                </div>
                <div>
                  <span className="stat-label !text-[11px]">Hóa đơn tất toán</span>
                  <b className="mt-2 block text-[15px] font-extrabold leading-tight">
                    {yearSummary?.paidCount ?? 0}/{yearSummary?.invoiceCount ?? 0}
                  </b>
                  <span className="mt-1 block text-xs text-muted">Đã thu đủ tiền</span>
                </div>
              </div>

              <div className="rounded-2xl bg-surface/60 p-4 xl:rounded-none xl:border-l xl:border-line xl:bg-transparent xl:pl-6">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-teal">
                  Cơ cấu phát hành tháng {month}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {costParts.map((part) => (
                    <div key={part.label}>
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-muted">{part.label}</span>
                        <b className="text-[12px]">{vnd(part.value)}</b>
                      </div>
                      <div className="progress-track mt-1.5">
                        <div
                          style={{
                            width: `${costTotal > 0 ? Math.min(100, (part.value / costTotal) * 100) : 0}%`,
                            background: part.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </article>

          <div className="mt-6 grid items-start gap-6 xl:grid-cols-[1.6fr_1fr]">
            <article className="panel flex min-w-0 flex-col">
              <div className="panel-header">
                <div>
                  <h2>Dòng tiền 12 tháng · {year}</h2>
                  <p>So sánh tổng phát hành và số tiền đã thu theo từng tháng</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted">
                  <span className="flex items-center gap-1.5"><span className="legend-dot" style={{ background: "#94a3b8" }} />Phát hành</span>
                  <span className="flex items-center gap-1.5"><span className="legend-dot" />Đã thu</span>
                </div>
              </div>
              <div className="chart-wrap">
                {hasChartData && (
                  <div className="chart-y">
                    <span>{compactMoney(chartMax)}</span>
                    <span>{compactMoney(chartMax * 0.75)}</span>
                    <span>{compactMoney(chartMax * 0.5)}</span>
                    <span>{compactMoney(chartMax * 0.25)}</span>
                    <span>0</span>
                  </div>
                )}
                <div className="chart">
                  <div className="chart-line l1"></div><div className="chart-line l2"></div><div className="chart-line l3"></div><div className="chart-line l4"></div>
                  <svg viewBox="0 0 700 240" preserveAspectRatio="none" aria-label="Biểu đồ phát hành và đã thu theo tháng">
                    <defs>
                      <linearGradient id="overview-paid-area" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#16796f" stopOpacity=".18" />
                        <stop offset="1" stopColor="#16796f" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {hasChartData && paidArea && <path d={paidArea} fill="url(#overview-paid-area)" />}
                    {hasChartData && billedPath && (
                      <path
                        d={billedPath}
                        fill="none"
                        stroke="#94a3b8"
                        strokeWidth="2"
                        strokeDasharray="6 5"
                        vectorEffect="non-scaling-stroke"
                      />
                    )}
                    {hasChartData && paidPath && (
                      <path
                        d={paidPath}
                        fill="none"
                        stroke="#16796f"
                        strokeWidth="3"
                        vectorEffect="non-scaling-stroke"
                      />
                    )}
                    {hasChartData && lastPoint && (
                      <>
                        <circle
                          cx={chartX(monthly.length - 1)}
                          cy={chartY(lastPoint.billed)}
                          r="4.5"
                          fill="#fff"
                          stroke="#94a3b8"
                          strokeWidth="2"
                          vectorEffect="non-scaling-stroke"
                        />
                        <circle
                          cx={chartX(monthly.length - 1)}
                          cy={chartY(lastPoint.paid)}
                          r="5.5"
                          fill="#fff"
                          stroke="#16796f"
                          strokeWidth="3"
                          vectorEffect="non-scaling-stroke"
                        />
                      </>
                    )}
                  </svg>
                  {!hasChartData && (
                    <div className="pointer-events-none absolute inset-0 bottom-[27px] grid place-items-center text-xs text-muted">
                      Chưa có hóa đơn trong năm {year}
                    </div>
                  )}
                  <div className="chart-x">
                    {monthly.map((point) => <span key={point.month}>T{point.month}</span>)}
                  </div>
                </div>
              </div>
              <div className="chart-summary">
                <div><span className="legend-dot" />Đã thu cả năm</div>
                <b>{vnd(yearSummary?.paid ?? 0)}</b>
              </div>
            </article>

            <article className="panel min-w-0">
              <div className="panel-header">
                <div>
                  <h2>Việc cần xử lý</h2>
                  <p>Đầu việc đang chờ trong hệ thống</p>
                </div>
                <span className="status-pill slate">{todoReady ? `${totalTodo} việc` : "—"}</span>
              </div>
              <div className="divide-y divide-line">
                {todoItems.map((item) => (
                  <Link
                    key={item.key}
                    to={item.to}
                    className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-surface/60"
                  >
                    <span
                      className="grid h-9 w-9 flex-none place-items-center rounded-xl"
                      style={{ background: chipBg[item.tone], color: chipFg[item.tone] }}
                    >
                      <Icon name={item.icon} size={17} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <b className="block text-[13px] text-slate-900">{item.label}</b>
                      <span className="text-[11px] text-muted">{item.note}</span>
                    </div>
                    <b className={`text-lg font-extrabold ${(item.count ?? 0) > 0 ? "text-coral" : "text-slate-400"}`}>
                      {item.count ?? "—"}
                    </b>
                    <Icon name="chevron" size={15} className="text-muted" />
                  </Link>
                ))}
              </div>
            </article>
          </div>

          <div className="mt-6 grid items-start gap-6 xl:grid-cols-[1.6fr_1fr]">
            <article className="panel min-w-0">
              <div className="panel-header">
                <div>
                  <h2>Hiệu suất theo tòa nhà</h2>
                  <p>Lấp đầy và thu tiền của kỳ {month}/{year}</p>
                </div>
                <button className="text-button" onClick={() => navigate("/admin/buildings")}>
                  Quản lý tòa nhà <Icon name="arrow" size={15} />
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Tòa nhà</th>
                      <th>Lấp đầy</th>
                      <th className="text-right">Phát hành</th>
                      <th className="text-right">Đã thu</th>
                      <th className="text-right">Còn nợ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buildingRows.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-10 text-center text-sm text-muted">
                          Kỳ {month}/{year} chưa có hóa đơn phát hành cho tòa nào.
                        </td>
                      </tr>
                    )}
                    {buildingRows.map((row) => (
                      <tr
                        key={idStr(row.buildingId)}
                        onClick={() => navigate(`/admin/buildings/${idStr(row.buildingId)}`)}
                      >
                        <td>
                          <b className="block whitespace-nowrap text-slate-900">{row.name}</b>
                          <div className="sub whitespace-nowrap">{row.invoiceCount} hóa đơn phòng</div>
                        </td>
                        <td>
                          <div className="whitespace-nowrap text-xs font-semibold">
                            {row.rate == null ? "—" : `${row.rate}%`}
                            <span className="ml-1 font-medium text-muted">
                              ({row.occupied ?? "—"}/{row.total ?? "—"})
                            </span>
                          </div>
                          {row.rate != null && (
                            <div className="progress-track mt-1 w-24">
                              <div style={{ width: `${Math.min(100, row.rate)}%` }} />
                            </div>
                          )}
                        </td>
                        <td className="whitespace-nowrap text-right font-bold text-slate-900">{vnd(row.billed)}</td>
                        <td className="whitespace-nowrap text-right font-semibold text-teal-800">{vnd(row.paid)}</td>
                        <td className="text-right">
                          <b className="whitespace-nowrap font-semibold text-amber-700">{vnd(row.debt)}</b>
                          {row.overdueCount > 0 && (
                            <div className="mt-1"><Pill tone="coral">{row.overdueCount} quá hạn</Pill></div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="panel min-w-0">
              <div className="panel-header">
                <div>
                  <h2>Top công nợ</h2>
                  <p>Hóa đơn phòng còn nợ nhiều nhất kỳ {month}/{year}</p>
                </div>
                <Link className="text-button" to={invoicesLink}>
                  Xem hóa đơn <Icon name="arrow" size={15} />
                </Link>
              </div>
              {topDebt.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-teal-50 text-teal">
                    <Icon name="check" size={18} />
                  </span>
                  <b className="text-sm">Không có công nợ</b>
                  <p className="text-xs text-muted">
                    Tất cả hóa đơn kỳ {month}/{year} đã được tất toán.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-line">
                  {topDebt.map((item, index) => {
                    const room = roomOf(item.roomId);
                    return (
                      <Link
                        key={idStr(item.roomInvoiceId)}
                        to={invoicesLink}
                        className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-surface/60"
                      >
                        <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-amber-50 text-xs font-extrabold text-amber-700">
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <b className="block text-[13px] text-slate-900">
                            Phòng {room?.code ?? `#${idStr(item.roomId)}`}
                          </b>
                          <span className="text-[11px] text-muted">
                            {buildingName(item.buildingId)} · Hạn {toVNTime(item.dueDate)}
                          </span>
                        </div>
                        <div className="text-right">
                          <b className="block text-[13px] text-coral">{vnd(item.outstanding)}</b>
                          <Pill tone={statusTone[item.status]}>{statusLabel[item.status]}</Pill>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </article>
          </div>

          <article className="panel mt-6">
            <div className="panel-header">
              <div>
                <h2>Hoạt động gần đây</h2>
                <p>Thông báo mới nhất của bạn</p>
              </div>
              <button className="text-button" onClick={() => navigate("/admin/notifications")}>
                Xem tất cả <Icon name="arrow" size={15} />
              </button>
            </div>
            {activityError ? (
              <p className="px-5 py-8 text-center text-sm text-muted">Không tải được hoạt động gần đây.</p>
            ) : activities.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted">Chưa có hoạt động nào.</p>
            ) : (
              <div className="grid gap-x-8 px-5 md:grid-cols-2">
                {activities.map((notification) => (
                  <div className="activity" key={String(notification.id)}>
                    <div className="activity-avatar bg-sky-100 text-sky-700">
                      <Icon name="bell" size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] leading-5"><b>{notification.title}</b></div>
                      <div className="mt-0.5 line-clamp-2 text-xs text-muted">{notification.content}</div>
                      <div className="mt-1 text-[11px] text-muted">{toVNTime(notification.createdAt, true)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>
        </>
      )}
    </>
  );
}
