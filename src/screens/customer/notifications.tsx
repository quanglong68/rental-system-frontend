import { useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Icon } from "../../ui";

export type NotiKind = "Hóa đơn" | "Lịch hẹn" | "Sửa chữa" | "Ở ghép";
export type Noti = { id: string; kind: NotiKind; title: string; body: string; at: string; read: boolean };

let items: Noti[] = [
  { id: "n1", kind: "Hóa đơn", title: "Hóa đơn tháng 10 đã phát hành", body: "Phần của bạn là 3.430.000 ₫, hạn thanh toán 10/10.", at: "2026-10-03T02:00:00Z", read: false },
  { id: "n2", kind: "Lịch hẹn", title: "Lịch xem phòng đã được xác nhận", body: "Phòng 602 · The Fern House, nhân viên Đinh Khánh Linh sẽ đón bạn.", at: "2026-10-02T09:30:00Z", read: false },
  { id: "n3", kind: "Sửa chữa", title: "KTV Trần Minh đã nhận yêu cầu BT-221", body: "Dự kiến kiểm tra wifi vào chiều 05/10.", at: "2026-10-03T15:10:00Z", read: false },
  { id: "n4", kind: "Ở ghép", title: "Có người muốn ở ghép cùng bạn", body: "Đặng Thu Trang đã ứng tuyển vào tin ở ghép phòng 402.", at: "2026-10-01T12:45:00Z", read: true },
  { id: "n5", kind: "Hóa đơn", title: "Đã nhận thanh toán tháng 9", body: "Cảm ơn bạn đã thanh toán đúng hạn.", at: "2026-09-08T04:20:00Z", read: true },
  { id: "n6", kind: "Sửa chữa", title: "Yêu cầu BT-204 đã hoàn tất", body: "Máy lạnh đã được vệ sinh và thay ống thoát nước.", at: "2026-10-01T08:00:00Z", read: true },
];
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export const notiStore = {
  markRead(id: string) { items = items.map((n) => (n.id === id ? { ...n, read: true } : n)); emit(); },
  markAll() { items = items.map((n) => ({ ...n, read: true })); emit(); },
};

export function useNotis() {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => items);
}

/** Toast nổi phong cách khách hàng */
export function useCxToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const show = (m: string) => { setMsg(m); window.setTimeout(() => setMsg(null), 2600); };
  const node = (
    <AnimatePresence>
      {msg && (
        <motion.div className="cx-toast" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
          <Icon name="check" size={16} />{msg}
        </motion.div>
      )}
    </AnimatePresence>
  );
  return [node, show] as const;
}
