import { Icon, PageHead, vnd } from "../ui";

const months = [{ m: "T5", r: 432 }, { m: "T6", r: 448 }, { m: "T7", r: 455 }, { m: "T8", r: 470 }, { m: "T9", r: 461 }, { m: "T10", r: 486 }];
const byBuilding = [{ n: "The Fern House", v: 186.4 }, { n: "Căn hộ An Nhiên", v: 142.8 }, { n: "Mộc Residence", v: 101.5 }, { n: "Lam Garden", v: 55.5 }];
const costs = [{ k: "Bảo trì", v: 38200000 }, { k: "Điện nước khu chung", v: 24600000 }, { k: "Lương nhân sự", v: 96000000 }, { k: "Marketing tin đăng", v: 8400000 }];

export default function Reports() {
  const max = 500;
  return (
    <>
      <PageHead eyebrow="Phân tích" title="Báo cáo" desc="Doanh thu, chi phí và lợi nhuận toàn hệ thống trong 6 tháng gần nhất."
        actions={<><select className="select !h-[42px]"><option>6 tháng gần nhất</option><option>Năm 2026</option></select><button className="primary-button"><Icon name="download" size={16} /> Xuất PDF</button></>} />
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <article className="panel">
          <div className="panel-header"><div><h2>Doanh thu theo tháng</h2><p>Đơn vị: triệu đồng</p></div></div>
          <div className="flex h-72 items-end gap-3 px-6 pb-6 pt-8">
            {months.map((d, i) => (
              <div key={d.m} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <span className="text-[11px] font-bold">{d.r}</span>
                <div className={`w-full max-w-14 rounded-t-lg ${i === months.length - 1 ? "bg-teal" : "bg-[#cfe3dc]"}`} style={{ height: `${(d.r / max) * 100}%` }}></div>
                <span className="text-[11px] text-muted">{d.m}</span>
              </div>
            ))}
          </div>
        </article>
        <article className="panel">
          <div className="panel-header"><div><h2>Đóng góp theo tòa nhà</h2><p>Tháng 10/2026</p></div></div>
          <div className="space-y-4 p-5">
            {byBuilding.map((b) => (
              <div key={b.n}><div className="mb-1.5 flex justify-between text-[13px]"><span className="font-semibold">{b.n}</span><b>{b.v.toLocaleString("vi-VN")} tr</b></div><div className="progress-track !h-2"><div style={{ width: `${(b.v / 186.4) * 100}%` }}></div></div></div>
            ))}
          </div>
        </article>
      </div>
      <article className="panel mt-6">
        <div className="panel-header"><div><h2>Lãi / lỗ tháng 10</h2><p>Sau khi trừ chi phí vận hành</p></div></div>
        <div className="grid gap-6 p-5 md:grid-cols-[1fr_1.4fr]">
          <div className="pnl-box"><span>Lợi nhuận ròng</span><b>{vnd(486200000 - 167200000)}</b><small>Biên lợi nhuận 65,6%</small></div>
          <div>{costs.map((c) => <div key={c.k} className="flex justify-between border-b border-line py-3 text-[13px] last:border-0"><span className="text-muted">{c.k}</span><b>− {vnd(c.v)}</b></div>)}</div>
        </div>
      </article>
    </>
  );
}
