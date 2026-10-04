import { useState } from "react";
import { Icon, MiniStat, PageHead, Pill, toVNTime, vnd, type Tone } from "../../components/ui";

const approvals = [
  { id: 1, type: "Yêu cầu thuê", who: "Nguyễn Lam", what: "Phòng B.305 · từ 05/10", by: "Sale Khánh Linh", tone: "sky" as Tone },
  { id: 2, type: "Gia hạn hợp đồng", who: "Trịnh Gia Huy", what: "HĐ-0399 · thêm 12 tháng", by: "Khách tự gửi", tone: "teal" as Tone },
  { id: 3, type: "Thanh lý", who: "Lý Khánh Vy", what: "A.108 · hoàn cọc " + vnd(7000000), by: "Khách tự gửi", tone: "amber" as Tone },
  { id: 4, type: "Chi phí sửa chữa", who: "KT Trần Minh", what: "Thay block máy lạnh C.201 · " + vnd(2850000), by: "Kỹ thuật", tone: "coral" as Tone },
];
const agenda = [
  { at: "2026-10-04T02:00:00Z", title: "Bàn giao phòng B.305", note: "Cùng Sale Khánh Linh" },
  { at: "2026-10-04T04:30:00Z", title: "Kiểm tra PCCC định kỳ", note: "Tầng 1–7" },
  { at: "2026-10-04T09:00:00Z", title: "Chốt chỉ số điện nước", note: "Hạn cuối kỳ 10/2026" },
];

export default function ManagerHome({ onNavigate }: { onNavigate: (s: string) => void }) {
  const [done, setDone] = useState<number[]>([]);
  return (
    <>
      <PageHead eyebrow="QUAN_LY · The Fern House" title="Chào Quốc Bảo, hôm nay có 4 việc cần duyệt." desc="Tổng quan vận hành tòa nhà bạn phụ trách. Dữ liệu chỉ trong phạm vi tòa nhà được phân công."
        actions={<><button className="secondary-button" onClick={() => onNavigate("Chốt chỉ số")}><Icon name="wallet" size={16} /> Chốt chỉ số</button><button className="primary-button"><Icon name="plus" size={16} /> Tạo hợp đồng</button></>} />
      <section className="stats-grid mb-6">
        <MiniStat label="Lấp đầy" value="92%" note="46/50 phòng" />
        <MiniStat label="Đã thu kỳ này" value="171,3 tr" note="Còn 15,1 tr chưa thu" tone="amber" />
        <MiniStat label="Phiếu bảo trì mở" value="3" note="1 ưu tiên cao" tone="coral" />
        <MiniStat label="Phòng sắp trống" value="2" note="Đã đăng tin tự động" tone="sky" />
      </section>
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <article className="panel">
          <div className="panel-header"><div><h2>Chờ bạn phê duyệt</h2><p>Yêu cầu từ khách thuê, Sale và Kỹ thuật</p></div><Pill tone="coral">{approvals.length - done.length} chờ</Pill></div>
          <div>
            {approvals.map((a) => (
              <div key={a.id} className={`approval ${done.includes(a.id) ? "approval-done" : ""}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><Pill tone={a.tone}>{a.type}</Pill><span className="text-[11px] text-muted">{a.by}</span></div>
                  <div className="mt-2 text-[14px] font-extrabold">{a.who}</div>
                  <div className="text-xs text-muted">{a.what}</div>
                </div>
                {done.includes(a.id) ? <span className="flex items-center gap-1 text-xs font-bold text-teal"><Icon name="check" size={15} /> Đã duyệt</span> : (
                  <div className="flex gap-2"><button className="secondary-button !h-9">Từ chối</button><button className="primary-button !h-9" onClick={() => setDone([...done, a.id])}>Duyệt</button></div>
                )}
              </div>
            ))}
          </div>
        </article>
        <article className="panel">
          <div className="panel-header"><div><h2>Lịch hôm nay</h2><p>Giờ Việt Nam (UTC+7)</p></div></div>
          <div className="p-5">
            {agenda.map((e) => (
              <div key={e.title} className="timeline-item">
                <span className="timeline-time">{new Date(e.at).toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" })}</span>
                <div><b className="text-[13px]">{e.title}</b><div className="text-xs text-muted">{e.note}</div></div>
              </div>
            ))}
            <div className="mt-3 rounded-xl bg-[#f3f8f5] p-4 text-xs text-muted">Cập nhật lần cuối {toVNTime("2026-10-04T01:58:00Z", true)}</div>
          </div>
        </article>
      </div>
    </>
  );
}
