import { useState } from "react";
import { Icon, PageHead, Pill, Tabs, toVNTime, type Tone } from "../../ui";

type Task = { id: string; title: string; room: string; tenant: string; phone: string; prio: string; status: string; at: string; desc: string; steps: string[] };
const tasks: Task[] = [
  { id: "BT-211", title: "Máy lạnh không lạnh", room: "C.201 · Mộc Residence", tenant: "Trịnh Gia Huy", phone: "0938 772 105", prio: "Cao", status: "Đang xử lý", at: "2026-10-02T08:30:00Z", desc: "Máy chạy nhưng chỉ ra gió, có tiếng kêu ở cục nóng.", steps: ["Kiểm tra gas", "Vệ sinh dàn lạnh", "Kiểm tra block cục nóng", "Chụp ảnh nghiệm thu"] },
  { id: "BT-219", title: "Rò rỉ nước bồn rửa", room: "B.305 · Fern House", tenant: "Nguyễn Lam", phone: "0912 004 931", prio: "Cao", status: "Mới giao", at: "2026-10-04T01:20:00Z", desc: "Nước rỉ dưới chân bồn rửa chén, sàn ướt.", steps: ["Xác định điểm rò", "Thay ron / ống xả", "Chụp ảnh nghiệm thu"] },
  { id: "BT-215", title: "Thay bóng đèn hành lang", room: "Tầng 2 · Mộc Residence", tenant: "Khu vực chung", phone: "—", prio: "Thấp", status: "Mới giao", at: "2026-10-03T02:00:00Z", desc: "3 bóng LED hành lang tầng 2 bị cháy.", steps: ["Lấy vật tư kho", "Thay bóng"] },
];
const prio: Record<string, Tone> = { Cao: "coral", "Trung bình": "amber", Thấp: "slate" };

export default function TechTasks() {
  const [tab, setTab] = useState("Cần làm");
  const [sel, setSel] = useState(tasks[0]);
  const [checked, setChecked] = useState<Record<string, number[]>>({ "BT-211": [0, 1] });
  const c = checked[sel.id] ?? [];
  const toggle = (i: number) => setChecked({ ...checked, [sel.id]: c.includes(i) ? c.filter((x) => x !== i) : [...c, i] });
  return (
    <>
      <PageHead eyebrow="KY_THUAT · Mộc Residence, Fern House" title="Việc của tôi" desc="Danh sách phiếu bảo trì được giao. Hoàn tất checklist và chụp ảnh nghiệm thu trước khi đóng phiếu."
        actions={<Tabs items={["Cần làm", "Đã xong"]} value={tab} onChange={setTab} />} />
      <div className="grid gap-6 xl:grid-cols-[1fr_1.3fr]">
        <div className="space-y-3">
          {tasks.map((t) => (
            <button key={t.id} onClick={() => setSel(t)} className={`ticket w-full text-left ${sel.id === t.id ? "ticket-on" : ""}`}>
              <div className="flex items-center justify-between"><span className="font-mono text-[11px] font-bold text-muted">{t.id}</span><div className="flex gap-1.5"><Pill tone={t.status === "Đang xử lý" ? "sky" : "amber"}>{t.status}</Pill><Pill tone={prio[t.prio]}>{t.prio}</Pill></div></div>
              <h3>{t.title}</h3>
              <div className="flex items-center justify-between text-xs text-muted"><span className="flex items-center gap-1"><Icon name="pin" size={12} />{t.room}</span><span>{toVNTime(t.at, true)}</span></div>
            </button>
          ))}
        </div>
        <article className="panel">
          <div className="panel-header"><div><h2>{sel.title}</h2><p>{sel.id} · {sel.room}</p></div><Pill tone={prio[sel.prio]}>Ưu tiên {sel.prio.toLowerCase()}</Pill></div>
          <div className="space-y-5 p-5">
            <p className="m-0 rounded-xl bg-[#f8faf8] p-4 text-[13px] leading-6">“{sel.desc}”</p>
            <dl className="detail-grid"><div><dt>Người báo</dt><dd className="!text-[13px]">{sel.tenant}</dd></div><div><dt>Liên hệ</dt><dd className="!text-[13px]">{sel.phone}</dd></div></dl>
            <div>
              <div className="mb-2 flex justify-between text-xs font-bold"><span>Checklist</span><span className="text-muted">{c.length}/{sel.steps.length}</span></div>
              {sel.steps.map((s, i) => (
                <label key={s} className="check-row"><input type="checkbox" checked={c.includes(i)} onChange={() => toggle(i)} /><span className={c.includes(i) ? "line-through text-muted" : ""}>{s}</span></label>
              ))}
            </div>
            <div className="upload-box"><Icon name="plus" size={18} /> Thêm ảnh trước / sau sửa chữa</div>
            <div className="grid grid-cols-2 gap-2"><button className="secondary-button">Đề xuất chi phí</button><button className="primary-button" disabled={c.length < sel.steps.length}>{sel.status === "Mới giao" ? "Bắt đầu" : "Hoàn tất phiếu"}</button></div>
          </div>
        </article>
      </div>
    </>
  );
}
