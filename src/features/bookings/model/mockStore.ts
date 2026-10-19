import { useSyncExternalStore } from "react";

export type ReqStatus = "Chờ duyệt" | "Đã duyệt" | "Từ chối" | "Đã hủy";
export type ApptStatus = "Chờ xác nhận" | "Đã xác nhận" | "Hoàn tất" | "Đã hủy";
export type RentalReq = { id: string; room: string; building: string; price: number; at: string; status: ReqStatus; note?: string };
export type Appt = { id: string; room: string; building: string; time: string; staff: string; phone: string; status: ApptStatus };

type State = { reqs: RentalReq[]; appts: Appt[] };
let state: State = {
  reqs: [
    { id: "YC-118", room: "602", building: "The Fern House", price: 4650000, at: "2026-10-02T08:15:00Z", status: "Chờ duyệt" },
    { id: "YC-104", room: "401", building: "Mộc Residence", price: 5100000, at: "2026-09-20T03:40:00Z", status: "Từ chối", note: "Phòng đã có người đặt cọc trước." },
    { id: "YC-087", room: "402", building: "The Fern House", price: 4200000, at: "2025-12-18T06:00:00Z", status: "Đã duyệt" },
    { id: "YC-095", room: "104", building: "Căn hộ An Nhiên", price: 3600000, at: "2026-09-05T10:20:00Z", status: "Đã hủy" },
  ],
  appts: [
    { id: "LH-061", room: "602", building: "The Fern House", time: "2026-10-06T02:00:00Z", staff: "Đinh Khánh Linh", phone: "0938 112 405", status: "Đã xác nhận" },
    { id: "LH-064", room: "502", building: "Căn hộ An Nhiên", time: "2026-10-08T10:30:00Z", staff: "Phạm Gia Huy", phone: "0909 778 120", status: "Chờ xác nhận" },
    { id: "LH-049", room: "401", building: "Mộc Residence", time: "2026-09-18T09:00:00Z", staff: "Nguyễn Thảo Vy", phone: "0912 450 336", status: "Hoàn tất" },
  ],
};
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export const bookingStore = {
  addRequest(r: Omit<RentalReq, "id" | "status">, time: string) {
    const n = state.reqs.length + state.appts.length;
    state = {
      reqs: [{ ...r, id: `YC-${120 + n}`, status: "Chờ duyệt" }, ...state.reqs],
      appts: [{ id: `LH-${66 + n}`, room: r.room, building: r.building, time, staff: "Đinh Khánh Linh", phone: "0938 112 405", status: "Chờ xác nhận" }, ...state.appts],
    };
    emit();
  },
  cancelReq(id: string) { state = { ...state, reqs: state.reqs.map((r) => (r.id === id ? { ...r, status: "Đã hủy" } : r)) }; emit(); },
  cancelAppt(id: string) { state = { ...state, appts: state.appts.map((a) => (a.id === id ? { ...a, status: "Đã hủy" } : a)) }; emit(); },
};

export function useBookings() {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => state);
}

/** Khung giờ xem phòng trong 5 ngày tới (giờ VN), trả về ISO UTC */
export function upcomingDays(count = 5) {
  const out: { label: string; ymd: string }[] = [];
  const base = new Date();
  for (let i = 1; i <= count; i++) {
    const d = new Date(base.getTime() + i * 86400000);
    const parts = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", weekday: "short", day: "2-digit", month: "2-digit" }).format(d);
    const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(d);
    out.push({ label: parts, ymd });
  }
  return out;
}
export const slotHours = ["09:00", "10:30", "14:00", "15:30", "17:00", "19:00"];
/** "2026-10-06" + "09:00" (giờ VN) → ISO UTC */
export const vnToIso = (ymd: string, hm: string) => new Date(`${ymd}T${hm}:00+07:00`).toISOString();
