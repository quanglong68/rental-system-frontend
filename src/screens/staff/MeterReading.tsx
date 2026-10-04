import { useState } from "react";
import { Icon, PageHead, Pill, vnd } from "../../components/ui";

const ELEC = 3500, WATER = 18000;
const initial = [
  { room: "A.401", people: 2, eOld: 1204, wOld: 312, e: "1386", w: "322" },
  { room: "A.402", people: 2, eOld: 980, wOld: 241, e: "1155", w: "251" },
  { room: "A.403", people: 1, eOld: 2210, wOld: 508, e: "", w: "" },
  { room: "A.404", people: 3, eOld: 1502, wOld: 390, e: "1740", w: "405" },
  { room: "A.405", people: 1, eOld: 760, wOld: 188, e: "", w: "" },
];

export default function MeterReading() {
  const [rows, setRows] = useState(initial);
  const set = (i: number, k: "e" | "w", v: string) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v.replace(/\D/g, "") } : r)));
  const filled = rows.filter((r) => r.e && r.w).length;
  return (
    <>
      <PageHead eyebrow="QUAN_LY · Kỳ 10/2026" title="Chốt chỉ số điện nước" desc={`Đơn giá điện ${vnd(ELEC)}/kWh, nước ${vnd(WATER)}/m³. Tiền được chia đều theo đầu người và làm tròn đến hàng nghìn.`}
        actions={<><select className="select !h-[42px]"><option>Tầng 4</option><option>Tầng 3</option></select><button className="primary-button" disabled={filled < rows.length}><Icon name="check" size={16} /> Phát hành hóa đơn ({filled}/{rows.length})</button></>} />
      <article className="panel">
        <div className="toolbar"><div className="flex w-full items-center gap-3"><span className="text-xs font-bold text-muted">Tiến độ</span><div className="progress-track flex-1"><div style={{ width: `${(filled / rows.length) * 100}%` }}></div></div><b className="text-xs">{filled}/{rows.length} phòng</b></div></div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Phòng</th><th>Điện cũ → mới</th><th>Nước cũ → mới</th><th className="text-right">Điện + nước</th><th className="text-right">Mỗi người</th></tr></thead>
            <tbody>
              {rows.map((r, i) => {
                const de = r.e ? Number(r.e) - r.eOld : 0, dw = r.w ? Number(r.w) - r.wOld : 0;
                const bad = de < 0 || dw < 0;
                const sum = de * ELEC + dw * WATER;
                return (
                  <tr key={r.room} className="!cursor-default">
                    <td><b>{r.room}</b><div className="sub">{r.people} người ở</div></td>
                    <td><div className="flex items-center gap-2"><span className="w-12 text-muted">{r.eOld}</span>→<input className="meter-input" value={r.e} onChange={(ev) => set(i, "e", ev.target.value)} placeholder="kWh" /></div></td>
                    <td><div className="flex items-center gap-2"><span className="w-12 text-muted">{r.wOld}</span>→<input className="meter-input" value={r.w} onChange={(ev) => set(i, "w", ev.target.value)} placeholder="m³" /></div></td>
                    <td className="text-right">{bad ? <Pill tone="coral">Chỉ số nhỏ hơn kỳ trước</Pill> : r.e && r.w ? <><b>{vnd(sum)}</b><div className="sub">{de} kWh · {dw} m³</div></> : <span className="text-muted">—</span>}</td>
                    <td className="text-right font-bold text-teal">{!bad && r.e && r.w ? vnd(sum / r.people) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </article>
    </>
  );
}
