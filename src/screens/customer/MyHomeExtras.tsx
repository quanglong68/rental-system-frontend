import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Icon, toVNTime, vnd } from "../../components/ui";

const ease = [0.22, 1, 0.36, 1] as const;
const invoices = [
  { id: "HD-2610", month: "Tháng 10/2026", due: "2026-10-10T16:59:00Z", paid: false, lines: [["Tiền phòng", 2710000], ["Điện", 411000], ["Nước", 116000], ["Dịch vụ", 193000]] as [string, number][] },
  { id: "HD-2609", month: "Tháng 9/2026", due: "2026-09-10T16:59:00Z", paid: true, paidAt: "2026-09-08T04:20:00Z", lines: [["Tiền phòng", 4200000], ["Điện", 588000], ["Nước", 162000], ["Dịch vụ", 300000]] as [string, number][] },
  { id: "HD-2608", month: "Tháng 8/2026", due: "2026-08-10T16:59:00Z", paid: true, paidAt: "2026-08-09T13:05:00Z", lines: [["Tiền phòng", 4200000], ["Điện", 702000], ["Nước", 171000], ["Dịch vụ", 300000]] as [string, number][] },
  { id: "HD-2607", month: "Tháng 7/2026", due: "2026-07-10T16:59:00Z", paid: true, paidAt: "2026-07-11T02:30:00Z", lines: [["Tiền phòng", 4200000], ["Điện", 744000], ["Nước", 180000], ["Dịch vụ", 300000]] as [string, number][] },
];
const terms = [
  "Thanh toán hóa đơn trước ngày 10 hằng tháng qua chuyển khoản.",
  "Báo trước ít nhất 30 ngày khi muốn trả phòng để được hoàn cọc đầy đủ.",
  "Không nuôi thú cưng, không hút thuốc trong phòng.",
  "Khách ở qua đêm cần đăng ký với quản lý tòa nhà.",
  "Người ở ghép mới phải được đại diện phòng và quản lý đồng ý.",
];
const reasons = ["Chuyển nơi làm việc", "Tìm phòng khác phù hợp hơn", "Về quê", "Lý do cá nhân", "Khác"];

export function HomeExtras({ people }: { people: string[] }) {
  const [open, setOpen] = useState<string | null>(invoices[0].id);
  const [date, setDate] = useState("");
  const [reason, setReason] = useState(reasons[0]);
  const [note, setNote] = useState("");
  const [stage, setStage] = useState<"form" | "confirm" | "pending">("form");
  const minDate = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const dateErr = date && date < minDate ? "Ngày trả phòng phải cách hôm nay ít nhất 30 ngày." : "";

  return (
    <div className="cx-two mt-6">
      <motion.article className="cx-panel" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2, ease }}>
        <h3 className="cx-panel-title">Lịch sử hóa đơn của bạn</h3>
        {invoices.map((inv) => {
          const sum = inv.lines.reduce((s, [, v]) => s + v, 0);
          const on = open === inv.id;
          return (
            <div key={inv.id} className="cx-inv">
              <button onClick={() => setOpen(on ? null : inv.id)}>
                <span className="flex-1"><b className="block">{inv.month}</b><small className="cx-meta">{inv.id} · hạn {toVNTime(inv.due)}</small></span>
                <b>{vnd(sum)}</b>
                <span className={`cx-status ${inv.paid ? "ok" : ""}`}>{inv.paid ? "Đã trả" : "Chưa trả"}</span>
                <motion.span animate={{ rotate: on ? 90 : 0 }}><Icon name="chevron" size={16} /></motion.span>
              </button>
              <AnimatePresence initial={false}>
                {on && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="pb-4">
                      {inv.lines.map(([k, v]) => <div key={k} className="cx-line"><span>{k}</span><b>{vnd(v)}</b></div>)}
                      <div className="cx-line total"><span>Phần của bạn</span><b>{vnd(sum)}</b></div>
                      <p className="cx-meta m-0">{inv.paid && inv.paidAt ? `Đã thanh toán lúc ${toVNTime(inv.paidAt, true)}` : "Chưa thanh toán · chia theo ngày ở trong kỳ"}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </motion.article>

      <div className="cx-stack">
        <motion.article className="cx-panel" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.25, ease }}>
          <h3 className="cx-panel-title">Hợp đồng HĐ-0431</h3>
          <div className="cx-contract-bar"><motion.div initial={{ width: 0 }} animate={{ width: "78%" }} transition={{ duration: 1.2, delay: 0.3 }} /></div>
          <div className="mt-2 flex justify-between text-xs text-[#6b777d]"><span>{toVNTime("2026-01-01T00:00:00Z")}</span><span>còn 88 ngày</span><span>{toVNTime("2026-12-31T00:00:00Z")}</span></div>
          <dl className="cx-specs !mt-6"><div><dt>Giá thuê</dt><dd>{vnd(4200000)}</dd></div><div><dt>Tiền cọc</dt><dd>{vnd(8400000)}</dd></div></dl>
          <h4 className="cx-panel-title !mt-2">Người ở</h4>
          {people.map((n, i) => (
            <div key={n} className="cx-person">
              <span className="cx-av">{n.split(" ").pop()![0]}</span>
              <span className="flex-1">{n}</span>
              {i === 0 ? <span className="cx-status ok">Đại diện phòng</span> : <span className="cx-status mute">Ở ghép</span>}
            </div>
          ))}
          <h4 className="cx-panel-title !mt-5">Điều khoản chính</h4>
          <ol className="m-0 grid gap-2 pl-5 text-sm leading-6 text-[#4b585e]">{terms.map((t) => <li key={t}>{t}</li>)}</ol>
          <button className="cx-btn ghost mt-5 w-full">Yêu cầu gia hạn</button>
        </motion.article>

        <motion.article className="cx-panel" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3, ease }}>
          <h3 className="cx-panel-title">Yêu cầu trả phòng</h3>
          <AnimatePresence mode="wait">
            {stage === "pending" ? (
              <motion.div key="p" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <div className="flex items-center justify-between"><b>Trả phòng ngày {toVNTime(`${date}T00:00:00+07:00`)}</b><span className="cx-status">Chờ duyệt</span></div>
                <p className="text-sm text-[#56636a]">Lý do: {reason}{note && ` · ${note}`}. Quản lý sẽ liên hệ để hẹn kiểm tra phòng và hoàn cọc.</p>
                <button className="cx-btn ghost !h-10 w-full" onClick={() => setStage("form")}>Rút lại yêu cầu</button>
              </motion.div>
            ) : (
              <motion.div key="f" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div className="cx-form">
                  <label className="cx-field">Ngày muốn trả<input type="date" className={`cx-input ${dateErr ? "bad" : ""}`} min={minDate} value={date} onChange={(e) => { setDate(e.target.value); setStage("form"); }} /></label>
                  <label className="cx-field">Lý do<select className="cx-input" value={reason} onChange={(e) => setReason(e.target.value)}>{reasons.map((r) => <option key={r}>{r}</option>)}</select></label>
                  <label className="cx-field full">Ghi chú<textarea className="cx-textarea !m-0" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Thông tin thêm cho quản lý (không bắt buộc)" /></label>
                </div>
                {dateErr && <p className="cx-err mt-2">{dateErr}</p>}
                {stage === "confirm" ? (
                  <div className="cx-confirm">
                    <p className="m-0 mb-3">Xác nhận gửi yêu cầu trả phòng vào ngày <b>{toVNTime(`${date}T00:00:00+07:00`)}</b>? Tiền cọc {vnd(8400000)} sẽ được hoàn sau khi kiểm tra phòng.</p>
                    <div className="flex gap-2"><button className="cx-btn !h-10 flex-1" onClick={() => setStage("pending")}>Gửi yêu cầu</button><button className="cx-btn ghost !h-10 flex-1" onClick={() => setStage("form")}>Quay lại</button></div>
                  </div>
                ) : (
                  <button className="cx-btn mt-4 w-full" disabled={!date || !!dateErr} onClick={() => setStage("confirm")}>Tiếp tục</button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.article>
      </div>
    </div>
  );
}

export default HomeExtras;
