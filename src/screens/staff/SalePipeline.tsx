import { useState } from "react";
import { Icon, MiniStat, PageHead, Pill, vnd, type Tone } from "../../ui";

type Lead = { name: string; phone: string; want: string; budget: number; source: string; stage: string };
const stages: { key: string; tone: Tone }[] = [{ key: "Mới", tone: "sky" }, { key: "Hẹn xem phòng", tone: "amber" }, { key: "Đặt cọc", tone: "violet" }, { key: "Ký hợp đồng", tone: "teal" }];
const initial: Lead[] = [
  { name: "Phạm Quỳnh Như", phone: "0909 112 334", want: "Studio, có ban công", budget: 4500000, source: "Tin đăng tự động", stage: "Mới" },
  { name: "Đoàn Văn Hậu", phone: "0933 448 210", want: "Phòng ở ghép 2 người", budget: 2200000, source: "Tìm theo GPS", stage: "Mới" },
  { name: "Trương Mỹ Linh", phone: "0987 551 006", want: "A.305 · Fern House", budget: 4000000, source: "Tin đăng tự động", stage: "Hẹn xem phòng" },
  { name: "Nguyễn Lam", phone: "0912 004 931", want: "B.305 · Fern House", budget: 3800000, source: "Giới thiệu", stage: "Đặt cọc" },
  { name: "Cao Thảo Vy", phone: "0901 223 774", want: "A.207 · Fern House", budget: 3600000, source: "Tin đăng tự động", stage: "Ký hợp đồng" },
];
const viewings = [{ t: "10:00", who: "Trương Mỹ Linh", room: "A.305" }, { t: "14:30", who: "Phạm Quỳnh Như", room: "A.502" }, { t: "17:00", who: "Đoàn Văn Hậu", room: "C.201 (ở ghép)" }];

export default function SalePipeline() {
  const [leads, setLeads] = useState(initial);
  const advance = (name: string) => setLeads(leads.map((l) => { const i = stages.findIndex((s) => s.key === l.stage); return l.name === name && i < stages.length - 1 ? { ...l, stage: stages[i + 1].key } : l; }));
  return (
    <>
      <PageHead eyebrow="SALE · The Fern House" title="Khách tiềm năng" desc="Theo dõi khách quan tâm từ tin đăng tự động và tìm kiếm GPS, đến khi ký hợp đồng."
        actions={<button className="primary-button"><Icon name="plus" size={16} /> Thêm khách</button>} />
      <section className="stats-grid mb-6">
        <MiniStat label="Khách mới tuần này" value="14" note="9 từ tin đăng tự động" tone="sky" />
        <MiniStat label="Lịch xem hôm nay" value="3" note="Gần nhất lúc 10:00" tone="amber" />
        <MiniStat label="Tỷ lệ chốt" value="31%" note="Mục tiêu tháng: 35%" />
        <MiniStat label="Hợp đồng tháng 10" value="2/8" note="Còn 4 phòng trống" tone="violet" />
      </section>
      <div className="grid gap-6 2xl:grid-cols-[1fr_300px]">
        <div className="kanban">
          {stages.map((s) => {
            const items = leads.filter((l) => l.stage === s.key);
            return (
              <section key={s.key} className="kanban-col">
                <header><span className={`dot dot-${s.tone}`}></span><b>{s.key}</b><span className="ml-auto text-xs font-bold text-muted">{items.length}</span></header>
                {items.map((l) => (
                  <article key={l.name} className="ticket">
                    <div className="flex items-center justify-between"><b className="text-[13px]">{l.name}</b><Pill>{l.source}</Pill></div>
                    <div className="mt-2 text-xs text-muted">{l.want}</div>
                    <div className="mt-1 text-xs font-bold">Ngân sách {vnd(l.budget)}</div>
                    <div className="mt-3 flex items-center justify-between border-t border-line pt-3"><span className="text-[11px] text-muted">{l.phone}</span>{s.key !== "Ký hợp đồng" && <button className="text-button" onClick={() => advance(l.name)}>Bước tiếp <Icon name="arrow" size={13} /></button>}</div>
                  </article>
                ))}
              </section>
            );
          })}
        </div>
        <article className="panel h-fit">
          <div className="panel-header"><div><h2>Lịch xem phòng</h2><p>Hôm nay</p></div><Icon name="calendar" size={18} /></div>
          <div className="p-5">{viewings.map((v) => <div key={v.t} className="timeline-item"><span className="timeline-time">{v.t}</span><div><b className="text-[13px]">{v.who}</b><div className="text-xs text-muted">Phòng {v.room}</div></div></div>)}</div>
        </article>
      </div>
    </>
  );
}
