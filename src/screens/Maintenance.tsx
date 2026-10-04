import { Icon, PageHead, Pill, toVNTime, type Tone } from "../ui";

const cols: { title: string; tone: Tone; items: { id: string; title: string; room: string; prio: string; who?: string; at: string }[] }[] = [
  { title: "Mới tiếp nhận", tone: "coral", items: [
    { id: "BT-219", title: "Rò rỉ nước bồn rửa", room: "B.305 · Fern House", prio: "Cao", at: "2026-10-04T01:20:00Z" },
    { id: "BT-218", title: "Wifi chập chờn tầng 3", room: "Tầng 3 · An Nhiên", prio: "Trung bình", at: "2026-10-03T13:05:00Z" },
  ] },
  { title: "Đã phân công", tone: "amber", items: [
    { id: "BT-215", title: "Thay bóng đèn hành lang", room: "Tầng 2 · Mộc", prio: "Thấp", who: "Ng. Văn Tài", at: "2026-10-03T02:00:00Z" },
  ] },
  { title: "Đang xử lý", tone: "sky", items: [
    { id: "BT-211", title: "Máy lạnh không lạnh", room: "C.201 · Mộc", prio: "Cao", who: "Trần Minh", at: "2026-10-02T08:30:00Z" },
    { id: "BT-209", title: "Khóa cửa bị kẹt", room: "A.108 · An Nhiên", prio: "Trung bình", who: "Ng. Văn Tài", at: "2026-10-02T04:10:00Z" },
  ] },
  { title: "Hoàn tất", tone: "teal", items: [
    { id: "BT-204", title: "Sửa máy lạnh", room: "A.402 · Fern House", prio: "Cao", who: "Trần Minh", at: "2026-10-01T03:45:00Z" },
  ] },
];
const prioTone: Record<string, Tone> = { Cao: "coral", "Trung bình": "amber", Thấp: "slate" };

export default function Maintenance() {
  return (
    <>
      <PageHead eyebrow="Vận hành kỹ thuật" title="Bảo trì & Sửa chữa" desc="Phiếu yêu cầu từ khách thuê được phân công cho nhân viên KỸ THUẬT của từng tòa nhà."
        actions={<><select className="select !h-[42px]"><option>Tất cả tòa nhà</option><option>The Fern House</option></select><button className="primary-button"><Icon name="plus" size={16} /> Tạo phiếu</button></>} />
      <div className="kanban">
        {cols.map((c) => (
          <section key={c.title} className="kanban-col">
            <header><span className={`dot dot-${c.tone}`}></span><b>{c.title}</b><span className="ml-auto text-xs font-bold text-muted">{c.items.length}</span></header>
            {c.items.map((t) => (
              <article key={t.id} className="ticket">
                <div className="flex items-center justify-between"><span className="font-mono text-[11px] font-bold text-muted">{t.id}</span><Pill tone={prioTone[t.prio]}>{t.prio}</Pill></div>
                <h3>{t.title}</h3>
                <div className="flex items-center gap-1 text-xs text-muted"><Icon name="pin" size={12} />{t.room}</div>
                <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-[11px]">
                  {t.who ? <span className="flex items-center gap-1.5 font-semibold"><span className="avatar-chip !h-6 !w-6">{t.who.split(" ").pop()![0]}</span>{t.who}</span> : <button className="text-button">Phân công</button>}
                  <span className="text-muted">{toVNTime(t.at, true)}</span>
                </div>
              </article>
            ))}
          </section>
        ))}
      </div>
    </>
  );
}
