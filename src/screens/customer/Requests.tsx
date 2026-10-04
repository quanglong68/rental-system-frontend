import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Link } from "react-router";
import { Icon, toVNTime, vnd } from "../../ui";
import { bookingStore, useBookings, type ApptStatus, type ReqStatus } from "./bookings";
import { useCxToast } from "./notifications";

const ease = [0.22, 1, 0.36, 1] as const;
const reqTone: Record<ReqStatus, string> = { "Chờ duyệt": "", "Đã duyệt": "ok", "Từ chối": "bad", "Đã hủy": "mute" };
const apptTone: Record<ApptStatus, string> = { "Chờ xác nhận": "", "Đã xác nhận": "info", "Hoàn tất": "ok", "Đã hủy": "mute" };

function CancelBox({ label, onConfirm }: { label: string; onConfirm: () => void }) {
  const [ask, setAsk] = useState(false);
  return (
    <AnimatePresence mode="wait" initial={false}>
      {ask ? (
        <motion.div key="ask" className="cx-confirm" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
          <p className="m-0 mb-3">Bạn chắc chắn muốn hủy {label}? Thao tác này không thể hoàn tác.</p>
          <div className="flex gap-2">
            <button className="cx-btn !h-10 flex-1" onClick={onConfirm}>Xác nhận hủy</button>
            <button className="cx-btn ghost !h-10 flex-1" onClick={() => setAsk(false)}>Giữ lại</button>
          </div>
        </motion.div>
      ) : (
        <motion.button key="btn" className="cx-btn ghost mt-4 !h-10 w-full" onClick={() => setAsk(true)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>Hủy {label}</motion.button>
      )}
    </AnimatePresence>
  );
}

export default function Requests() {
  const { reqs, appts } = useBookings();
  const [toast, show] = useCxToast();
  return (
    <section className="cx-section !pt-32">
      <div className="cx-eyebrow">Yêu cầu thuê · lịch xem phòng</div>
      <h1 className="cx-serif cx-h2">Những căn phòng <em>đang chờ</em> bạn.</h1>
      <div className="cx-two">
        <div className="cx-stack">
          <h3 className="cx-panel-title !mb-0">Lịch hẹn xem phòng · {appts.length}</h3>
          <AnimatePresence initial={false}>
            {appts.map((a, i) => (
              <motion.article key={a.id} layout className="cx-panel" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: i * 0.05, ease }}>
                <div className="flex items-center justify-between"><span className="cx-meta">{a.id} · {a.building}</span><span className={`cx-status ${apptTone[a.status]}`}>{a.status}</span></div>
                <h3 className="cx-serif mt-3 text-[28px] leading-none">Phòng {a.room}</h3>
                <dl className="cx-specs !my-4">
                  <div><dt>Thời gian</dt><dd className="!text-[15px]">{toVNTime(a.time, true)}</dd></div>
                  <div><dt>Nhân viên phụ trách</dt><dd className="!text-[15px]">{a.staff}</dd></div>
                </dl>
                <a href={`tel:${a.phone.replace(/\s/g, "")}`} className="cx-link inline-flex items-center gap-2 !p-0 text-sm"><Icon name="arrow" size={14} /> Gọi {a.phone}</a>
                {(a.status === "Chờ xác nhận" || a.status === "Đã xác nhận") && <CancelBox label="lịch hẹn" onConfirm={() => { bookingStore.cancelAppt(a.id); show("Đã hủy lịch hẹn " + a.id); }} />}
              </motion.article>
            ))}
          </AnimatePresence>
        </div>
        <div className="cx-stack">
          <h3 className="cx-panel-title !mb-0">Yêu cầu thuê · {reqs.length}</h3>
          <AnimatePresence initial={false}>
            {reqs.map((r, i) => (
              <motion.article key={r.id} layout className="cx-panel" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: i * 0.05, ease }}>
                <div className="flex items-center justify-between"><span className="cx-meta">{r.id} · gửi {toVNTime(r.at, true)}</span><span className={`cx-status ${reqTone[r.status]}`}>{r.status}</span></div>
                <div className="mt-3 flex items-end justify-between"><h3 className="cx-serif m-0 text-2xl">P.{r.room} · {r.building}</h3><b>{vnd(r.price)}</b></div>
                {r.note && <p className="mt-2 text-sm text-[#a23a22]">Lý do: {r.note}</p>}
                {r.status === "Chờ duyệt" && <CancelBox label="yêu cầu" onConfirm={() => { bookingStore.cancelReq(r.id); show("Đã hủy yêu cầu " + r.id); }} />}
              </motion.article>
            ))}
          </AnimatePresence>
          <Link to="/" className="cx-btn ghost">Tìm thêm phòng</Link>
        </div>
      </div>
      {toast}
    </section>
  );
}
