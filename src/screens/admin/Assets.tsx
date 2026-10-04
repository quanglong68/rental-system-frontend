import { useState } from "react";
import { Drawer, Field, Icon, MiniStat, PageHead, Pill, Tabs, Toolbar, toVNTime, useToast, vnd, type Tone } from "../../components/ui";

const NOW = Date.parse("2026-10-04T00:00:00Z");
const DAY = 86400000;
const assets = [
  { code: "ML-A402", name: "Máy lạnh Daikin 1HP", room: "A.402 · Fern House", cat: "Điện lạnh", cost: 8900000, bought: "2024-05-10T00:00:00Z", warranty: "2027-05-10T00:00:00Z", state: "Tốt" },
  { code: "NL-A402", name: "Máy nước nóng Ariston 20L", room: "A.402 · Fern House", cat: "Nước", cost: 3200000, bought: "2023-11-02T00:00:00Z", warranty: "2026-11-02T00:00:00Z", state: "Tốt" },
  { code: "ML-C201", name: "Máy lạnh Panasonic 1.5HP", room: "C.201 · Mộc", cat: "Điện lạnh", cost: 11500000, bought: "2022-03-20T00:00:00Z", warranty: "2025-03-20T00:00:00Z", state: "Đang sửa" },
  { code: "TL-B305", name: "Tủ lạnh Aqua 130L", room: "B.305 · Fern House", cat: "Gia dụng", cost: 4100000, bought: "2025-01-15T00:00:00Z", warranty: "2027-01-15T00:00:00Z", state: "Tốt" },
  { code: "TM-T1", name: "Thang máy Mitsubishi", room: "Khu chung · Fern House", cat: "Kết cấu", cost: 420000000, bought: "2021-08-01T00:00:00Z", warranty: "2026-10-20T00:00:00Z", state: "Tốt" },
  { code: "BOM-01", name: "Máy bơm tăng áp", room: "Tầng mái · An Nhiên", cat: "Nước", cost: 6700000, bought: "2020-06-12T00:00:00Z", warranty: "2022-06-12T00:00:00Z", state: "Cần thay" },
];
const stateTone: Record<string, Tone> = { "Tốt": "teal", "Đang sửa": "sky", "Cần thay": "coral" };
const plans = [
  { task: "Vệ sinh máy lạnh toàn tòa", scope: "Fern House · 50 máy", every: "3 tháng", next: "2026-10-12T01:00:00Z", who: "Trần Minh", last: "2026-07-10T01:00:00Z" },
  { task: "Kiểm định thang máy", scope: "Fern House · TM-T1", every: "6 tháng", next: "2026-10-20T02:00:00Z", who: "Đối tác Mitsubishi", last: "2026-04-18T02:00:00Z" },
  { task: "Súc rửa bồn nước mái", scope: "An Nhiên · 2 bồn", every: "6 tháng", next: "2026-11-05T00:30:00Z", who: "Nguyễn Văn Tài", last: "2026-05-05T00:30:00Z" },
  { task: "Kiểm tra PCCC & bình chữa cháy", scope: "Tất cả tòa", every: "12 tháng", next: "2026-10-06T02:00:00Z", who: "Nguyễn Văn Tài", last: "2025-10-06T02:00:00Z" },
];
const initialReports = [
  { id: "BC-88", title: "Vòi sen bị rỉ, nước chảy yếu", room: "A.402 · Fern House", by: "Hoàng Thị Mai", at: "2026-10-04T00:40:00Z", photos: 3, asset: "NL-A402" },
  { id: "BC-87", title: "Ổ cắm gần bàn bị cháy xém", room: "B.305 · Fern House", by: "Nguyễn Lam", at: "2026-10-03T14:10:00Z", photos: 2, asset: "" },
  { id: "BC-86", title: "Cửa sổ không đóng kín", room: "C.201 · Mộc", by: "Trịnh Gia Huy", at: "2026-10-03T03:25:00Z", photos: 1, asset: "" },
];
const photos = ["photo-1584622650111-993a426fbf0a", "photo-1585128792020-803d29415281", "photo-1621905251189-08b45d6a269e"];

export default function Assets() {
  const [tab, setTab] = useState("Báo hỏng");
  const [reports, setReports] = useState(initialReports);
  const [convert, setConvert] = useState<(typeof initialReports)[number] | null>(null);
  const [prio, setPrio] = useState("Cao");
  const [adding, setAdding] = useState(false);
  const [toast, show] = useToast();
  const left = (iso: string) => Math.round((Date.parse(iso) - NOW) / DAY);
  return (
    <>
      <PageHead eyebrow="Vận hành" title="Tài sản & Bảo trì định kỳ" desc="Danh mục thiết bị theo phòng, hạn bảo hành, lịch bảo trì định kỳ và tiếp nhận báo hỏng từ khách thuê."
        actions={<><Tabs items={["Báo hỏng", "Thiết bị", "Định kỳ"]} value={tab} onChange={setTab} /><button className="primary-button" onClick={() => setAdding(true)}><Icon name="plus" size={16} /> Thêm thiết bị</button></>} />
      <section className="stats-grid mb-6">
        <MiniStat label="Thiết bị đang quản lý" value="412" note="Giá trị 2,1 tỷ" />
        <MiniStat label="Hết bảo hành 30 ngày" value="2" note="NL-A402, TM-T1" tone="amber" />
        <MiniStat label="Báo hỏng chờ xử lý" value={String(reports.length)} note="Chuyển thành phiếu sửa chữa" tone="coral" />
        <MiniStat label="Bảo trì tuần tới" value="2" note="PCCC, vệ sinh máy lạnh" tone="sky" />
      </section>

      {tab === "Báo hỏng" && (
        <article className="panel">
          <div className="panel-header"><div><h2>Báo hỏng từ khách thuê</h2><p>Xem ảnh, gắn thiết bị, đặt độ ưu tiên và giao cho kỹ thuật</p></div></div>
          {reports.length === 0 && <div className="p-10 text-center text-sm text-muted">Đã xử lý hết báo hỏng. 🎉</div>}
          {reports.map((r) => (
            <div key={r.id} className="approval">
              <div className="flex -space-x-3">{photos.slice(0, r.photos).map((p) => <img key={p} src={`https://images.unsplash.com/${p}?w=120&h=120&fit=crop`} alt="" className="h-11 w-11 rounded-xl border-2 border-white object-cover" />)}</div>
              <div className="min-w-[220px] flex-1"><b className="text-sm">{r.title}</b><div className="text-xs text-muted">{r.id} · {r.room} · {r.by} · {toVNTime(r.at, true)} · {r.photos}/5 ảnh</div></div>
              <button className="primary-button !h-9" onClick={() => setConvert(r)}>Tạo phiếu sửa chữa <Icon name="arrow" size={14} /></button>
            </div>
          ))}
        </article>
      )}

      {tab === "Thiết bị" && (
        <article className="panel">
          <Toolbar placeholder="Tìm mã, tên thiết bị, phòng..."><select className="select"><option>Mọi nhóm</option><option>Điện lạnh</option><option>Nước</option><option>Gia dụng</option><option>Kết cấu</option></select></Toolbar>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Thiết bị</th><th>Vị trí</th><th>Nhóm</th><th className="text-right">Nguyên giá</th><th>Bảo hành</th><th>Tình trạng</th></tr></thead>
              <tbody>{assets.map((a) => { const d = left(a.warranty); return (
                <tr key={a.code}>
                  <td><b>{a.name}</b><div className="sub font-mono">{a.code} · mua {toVNTime(a.bought)}</div></td>
                  <td className="text-[13px]">{a.room}</td><td className="text-[13px]">{a.cat}</td>
                  <td className="text-right font-bold">{vnd(a.cost)}</td>
                  <td className="whitespace-nowrap text-xs"><div>{toVNTime(a.warranty)}</div>{d < 0 ? <span className="font-bold text-muted">Hết hạn</span> : d <= 30 ? <span className="font-bold text-[#a6640b]">Còn {d} ngày</span> : <span className="text-teal">Còn hạn</span>}</td>
                  <td><Pill tone={stateTone[a.state]}>{a.state}</Pill></td>
                </tr>); })}</tbody>
            </table>
          </div>
        </article>
      )}

      {tab === "Định kỳ" && (
        <div className="grid gap-4 md:grid-cols-2">
          {plans.map((p) => { const d = left(p.next); return (
            <article key={p.task} className="panel p-5">
              <div className="flex items-start justify-between gap-3"><div><Pill tone={d <= 7 ? "amber" : "slate"}>Mỗi {p.every}</Pill><h3 className="mt-3 text-base font-extrabold">{p.task}</h3><div className="text-xs text-muted">{p.scope}</div></div>
                <div className="text-right"><div className="text-3xl font-extrabold tracking-tight">{d}</div><div className="text-[10px] font-bold uppercase text-muted">ngày nữa</div></div></div>
              <div className="mt-4 h-1.5 rounded-full bg-[#e6eeea]"><div className="h-full rounded-full bg-teal" style={{ width: `${Math.max(6, 100 - (d / ((Date.parse(p.next) - Date.parse(p.last)) / DAY)) * 100)}%` }} /></div>
              <div className="mt-3 flex items-center justify-between text-xs text-muted"><span>Lần trước {toVNTime(p.last)}</span><span>Kế tiếp <b className="text-ink">{toVNTime(p.next, true)}</b></span></div>
              <div className="mt-4 flex items-center justify-between border-t border-line pt-3"><span className="text-xs">Phụ trách: <b>{p.who}</b></span><button className="text-button" onClick={() => show(`Đã tạo phiếu cho “${p.task}”`)}>Tạo phiếu ngay <Icon name="chevron" size={12} /></button></div>
            </article>); })}
        </div>
      )}

      <Drawer open={!!convert} eyebrow={convert ? `${convert.id} · ${convert.room}` : ""} title="Chuyển thành phiếu sửa chữa" onClose={() => setConvert(null)}
        footer={<><button className="secondary-button" onClick={() => setConvert(null)}>Hủy</button><button className="primary-button" onClick={() => { setReports(reports.filter((r) => r.id !== convert!.id)); setConvert(null); show("Đã tạo phiếu BT-220 và giao cho kỹ thuật"); }}>Tạo & giao việc</button></>}>
        {convert && (
          <>
            <div className="mb-4 grid grid-cols-3 gap-2">{photos.slice(0, convert.photos).map((p) => <img key={p} src={`https://images.unsplash.com/${p}?w=300&h=300&fit=crop`} alt="" className="aspect-square w-full rounded-xl object-cover" />)}</div>
            <div className="form-grid">
              <div className="span-2"><Field label="Tiêu đề phiếu"><input defaultValue={convert.title} /></Field></div>
              <div className="span-2"><Field label="Độ ưu tiên"><div className="tabs !w-fit">{["Khẩn cấp", "Cao", "Trung bình", "Thấp"].map((p) => <button key={p} type="button" className={prio === p ? "tab-on" : ""} onClick={() => setPrio(p)}>{p}</button>)}</div></Field></div>
              <Field label="Giao cho KY_THUAT"><select><option>Trần Minh · 3 việc đang mở</option><option>Nguyễn Văn Tài · 1 việc đang mở</option></select></Field>
              <Field label="Hạn hoàn thành"><input type="datetime-local" defaultValue="2026-10-05T10:00" /></Field>
              <div className="span-2"><Field label="Thiết bị liên quan" hint="Để trống nếu không gắn với thiết bị"><select defaultValue={convert.asset}><option value="">—</option>{assets.map((a) => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}</select></Field></div>
              <div className="span-2"><Field label="Ghi chú cho kỹ thuật"><textarea defaultValue="Khách có mặt sau 18:00, liên hệ trước khi tới." /></Field></div>
            </div>
          </>
        )}
      </Drawer>

      <Drawer open={adding} eyebrow="Danh mục" title="Thêm thiết bị" onClose={() => setAdding(false)}
        footer={<><button className="secondary-button" onClick={() => setAdding(false)}>Hủy</button><button className="primary-button" onClick={() => { setAdding(false); show("Đã thêm thiết bị"); }}>Lưu</button></>}>
        <div className="form-grid">
          <div className="span-2"><Field label="Tên thiết bị"><input placeholder="Máy lạnh LG 1HP" /></Field></div>
          <Field label="Mã"><input placeholder="ML-B306" /></Field>
          <Field label="Nhóm"><select><option>Điện lạnh</option><option>Nước</option><option>Gia dụng</option><option>Kết cấu</option></select></Field>
          <Field label="Vị trí"><select><option>B.306 · Fern House</option><option>Khu chung · Fern House</option></select></Field>
          <Field label="Nguyên giá (₫)"><input placeholder="9.500.000" /></Field>
          <Field label="Ngày mua"><input type="date" defaultValue="2026-10-04" /></Field>
          <Field label="Hết bảo hành"><input type="date" defaultValue="2028-10-04" /></Field>
          <div className="span-2"><Field label="Bảo trì định kỳ"><select><option>Không</option><option>Mỗi 3 tháng</option><option>Mỗi 6 tháng</option><option>Mỗi 12 tháng</option></select></Field></div>
        </div>
      </Drawer>
      {toast}
    </>
  );
}
