import { useState } from "react";
import { segments, splitDaily } from "../lib/split";
import { Drawer, Field, Icon, MiniStat, PageHead, Pill, Tabs, Toolbar, toVNTime, useToast, vnd, type Tone } from "../ui";

type Status = "Nháp" | "Chờ ký" | "Hiệu lực" | "Sắp hết hạn" | "Đã thanh lý";
type Occupant = { name: string; phone: string; from: string; to?: string; rep?: boolean };
type Contract = { id: string; tenant: string; room: string; capacity: number; rent: number; deposit: number; start: string; end: string; status: Status; occupants: Occupant[]; moveOut?: { name: string; date: string; reason: string } };

const seed: Contract[] = [
  { id: "HĐ-0431", tenant: "Hoàng Thị Mai", room: "A.402 · Fern House", capacity: 3, rent: 4200000, deposit: 8400000, start: "2026-01-01T00:00:00Z", end: "2026-12-31T00:00:00Z", status: "Hiệu lực",
    occupants: [{ name: "Hoàng Thị Mai", phone: "0903218447", from: "2026-01-01T00:00:00Z", rep: true }, { name: "Đỗ Minh Khoa", phone: "0938112045", from: "2026-10-10T00:00:00Z" }],
    moveOut: { name: "Đỗ Minh Khoa", date: "2026-11-30T00:00:00Z", reason: "Chuyển công tác ra Hà Nội" } },
  { id: "HĐ-0428", tenant: "Nguyễn Lam", room: "B.305 · Fern House", capacity: 2, rent: 3800000, deposit: 7600000, start: "2026-10-05T00:00:00Z", end: "2027-10-04T00:00:00Z", status: "Chờ ký", occupants: [{ name: "Nguyễn Lam", phone: "0907665120", from: "2026-10-05T00:00:00Z", rep: true }] },
  { id: "HĐ-0399", tenant: "Trịnh Gia Huy", room: "C.201 · Mộc Residence", capacity: 3, rent: 5100000, deposit: 10200000, start: "2025-11-01T00:00:00Z", end: "2026-10-31T00:00:00Z", status: "Sắp hết hạn",
    occupants: [{ name: "Trịnh Gia Huy", phone: "0912004771", from: "2025-11-01T00:00:00Z", rep: true }, { name: "Lê Bảo Trâm", phone: "0988120334", from: "2025-11-01T00:00:00Z" }, { name: "Vũ Anh Tú", phone: "0977431209", from: "2026-03-15T00:00:00Z", to: "2026-10-18T00:00:00Z" }] },
  { id: "HĐ-0377", tenant: "Lý Khánh Vy", room: "A.108 · An Nhiên", capacity: 1, rent: 3500000, deposit: 7000000, start: "2025-06-01T00:00:00Z", end: "2026-05-31T00:00:00Z", status: "Đã thanh lý", occupants: [{ name: "Lý Khánh Vy", phone: "0901223344", from: "2025-06-01T00:00:00Z", to: "2026-05-31T00:00:00Z", rep: true }] },
];
const tones: Record<Status, Tone> = { "Nháp": "violet", "Chờ ký": "sky", "Hiệu lực": "teal", "Sắp hết hạn": "amber", "Đã thanh lý": "slate" };

/** Kỳ tháng 10/2026 — số ngày ở của từng người trong kỳ */
const PERIOD = { start: Date.UTC(2026, 9, 1), end: Date.UTC(2026, 9, 31), days: 31 };
const DAY = 86400000;
function daysIn(o: Occupant) {
  const a = Math.max(PERIOD.start, Date.parse(o.from));
  const b = Math.min(PERIOD.end, o.to ? Date.parse(o.to) : PERIOD.end);
  return b < a ? 0 : Math.round((b - a) / DAY) + 1;
}
const bill = (rent: number) => [["Tiền phòng", rent], ["Điện · 182 kWh", 637000], ["Nước · 10 m³", 180000], ["Gửi xe · 2 xe", 200000], ["Internet & vệ sinh", 150000]] as [string, number][];

const dayOf = (iso: string) => Math.round((Date.parse(iso) - PERIOD.start) / DAY) + 1;

function SplitBilling({ c }: { c: Contract }) {
  const lines = bill(c.rent);
  const total = lines.reduce((s, [, v]) => s + v, 0);
  const rows = c.occupants.filter((o) => daysIn(o) > 0).map((o) => ({ o, from: Math.max(1, dayOf(o.from)), to: o.to ? Math.min(PERIOD.days, dayOf(o.to)) : PERIOD.days }));
  const { shares, headcount, daily } = splitDaily(total, PERIOD.days, rows.map((r) => [r.from, r.to]));
  return (
    <>
      <div className="alert alert-info mb-4"><Icon name="split" size={18} /><div>Mỗi ngày, chi phí ngày ({vnd(total)} ÷ {PERIOD.days} ≈ <b>{vnd(daily)}</b>) được chia đều cho số người có mặt hôm đó, rồi cộng dồn thành hóa đơn cá nhân. Làm tròn đến nghìn đồng.</div></div>
      <div className="kv mb-4">{lines.map(([k, v]) => <div key={k}><span>{k}</span><b>{vnd(v)}</b></div>)}<div className="!bg-[#f3f8f5]"><span>Tổng kỳ 10/2026</span><b>{vnd(total)}</b></div></div>
      <div className="mb-5 rounded-xl border border-line p-3.5">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">Số người có mặt theo ngày</div>
        <div className="flex h-10 items-end gap-[2px]">{headcount.map((n, i) => <div key={i} title={`Ngày ${i + 1}: ${n} người`} className="flex-1 rounded-sm bg-teal" style={{ height: `${(n / Math.max(...headcount, 1)) * 100}%`, opacity: 0.35 + (n / Math.max(...headcount, 1)) * 0.65 }} />)}</div>
        <div className="mt-2 space-y-0.5 text-[11.5px] text-muted">{segments(headcount).map((g) => <div key={g.from}>Ngày {g.from}–{g.to}: {g.n} người → {g.n ? vnd(daily / g.n) : "—"}/người/ngày</div>)}</div>
      </div>
      <div className="space-y-3">
        {rows.map(({ o, from, to }, i) => (
          <div key={o.name} className="rounded-xl border border-line p-3.5">
            <div className="flex items-center justify-between gap-3 text-sm"><b>{o.name}{o.rep && <span className="ml-2"><Pill tone="teal">Đại diện</Pill></span>}</b><b>{vnd(shares[i])}</b></div>
            <div className="relative mt-2.5 h-2.5 rounded-full bg-[#e6eeea]"><div className="absolute h-full rounded-full bg-teal" style={{ left: `${((from - 1) / PERIOD.days) * 100}%`, width: `${((to - from + 1) / PERIOD.days) * 100}%` }} /></div>
            <div className="mt-1.5 text-[11px] text-muted">Có mặt ngày {from}–{to} ({to - from + 1}/{PERIOD.days} ngày) · {Math.round((shares[i] / total) * 1000) / 10}% tổng hóa đơn</div>
          </div>
        ))}
      </div>
    </>
  );
}

const contractServices = [
  { k: "Gửi xe máy", price: 100000, unit: "xe", qty: 2, scope: "Cá nhân" },
  { k: "Internet", price: 100000, unit: "phòng", qty: 1, scope: "Dùng chung" },
  { k: "Vệ sinh", price: 50000, unit: "người", qty: 2, scope: "Dùng chung" },
];
function Services({ toast }: { toast: (m: string) => void }) {
  const [list, setList] = useState(contractServices);
  return (
    <>
      <div className="divide-y divide-line rounded-xl border border-line">
        {list.map((x, i) => (
          <div key={x.k} className="flex flex-wrap items-center gap-3 p-3.5">
            <div className="flex-1"><b className="text-sm">{x.k}</b> <Pill tone={x.scope === "Cá nhân" ? "violet" : "sky"}>{x.scope}</Pill><div className="text-xs text-muted">{vnd(x.price)} / {x.unit}</div></div>
            <div className="flex items-center gap-1"><button className="icon-button !h-8 !w-8" onClick={() => setList(list.map((y, j) => (j === i ? { ...y, qty: Math.max(0, y.qty - 1) } : y)))}>−</button><b className="w-6 text-center text-sm">{x.qty}</b><button className="icon-button !h-8 !w-8" onClick={() => setList(list.map((y, j) => (j === i ? { ...y, qty: y.qty + 1 } : y)))}>+</button></div>
            <b className="w-24 text-right text-sm">{vnd(x.price * x.qty)}</b>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between"><button className="text-button !text-xs" onClick={() => setList([...list, { k: "Gửi ô tô", price: 1200000, unit: "xe", qty: 1, scope: "Cá nhân" }])}><Icon name="plus" size={13} /> Đăng ký thêm dịch vụ</button><button className="primary-button !h-9" onClick={() => toast("Dịch vụ áp dụng từ kỳ hóa đơn kế tiếp")}>Lưu</button></div>
    </>
  );
}

function Detail({ c, onChange, toast }: { c: Contract; onChange: (c: Contract) => void; toast: (m: string) => void }) {
  const [tab, setTab] = useState("Thông tin");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", from: "2026-10-15" });
  const [error, setError] = useState("");
  const active = c.occupants.filter((o) => !o.to || Date.parse(o.to) >= Date.now());
  const addOccupant = () => {
    if (!form.name || !/^(0|\+84)(3|5|7|8|9)\d{8}$/.test(form.phone)) return setError("Nhập họ tên và số điện thoại hợp lệ.");
    if (active.length >= c.capacity) return setError("ROOM_CAPACITY_EXCEEDED");
    onChange({ ...c, occupants: [...c.occupants, { name: form.name, phone: form.phone, from: `${form.from}T00:00:00Z` }] });
    setAdding(false); setError(""); setForm({ name: "", phone: "", from: "2026-10-15" }); toast("Đã thêm người ở");
  };
  return (
    <>
      <div className="mb-5"><Tabs items={["Thông tin", "Người ở", "Dịch vụ", "Chia hóa đơn"]} value={tab} onChange={setTab} /></div>
      {tab === "Thông tin" && (
        <>
          <div className="kv">
            <div><span>Khách đứng tên</span><b>{c.tenant}</b></div><div><span>Phòng</span><b>{c.room}</b></div>
            <div><span>Giá thuê chốt</span><b>{vnd(c.rent)}</b></div><div><span>Tiền cọc</span><b>{vnd(c.deposit)}</b></div>
            <div><span>Bắt đầu</span><b>{toVNTime(c.start)}</b></div><div><span>Kết thúc</span><b>{toVNTime(c.end)}</b></div>
            <div><span>Sức chứa tối đa</span><b>{c.capacity} người</b></div><div><span>Đang ở</span><b>{active.length} người</b></div>
          </div>
          {c.status === "Nháp" && <div className="alert alert-info mt-4"><Icon name="contract" size={18} />Hợp đồng nháp: có thể chỉnh giá trước khi gửi ký. Sau khi ký, giá thuê được cố định suốt thời hạn.</div>}
          {c.moveOut && (
            <>
              <div className="section-title">Yêu cầu dọn đi</div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
                <b>{c.moveOut.name}</b> muốn dọn đi ngày <b>{toVNTime(c.moveOut.date)}</b><p className="mt-1 text-muted">“{c.moveOut.reason}”</p>
                <div className="mt-3 flex gap-2">
                  <button className="primary-button !h-9" onClick={() => { onChange({ ...c, moveOut: undefined, occupants: c.occupants.map((o) => o.name === c.moveOut!.name ? { ...o, to: c.moveOut!.date } : o) }); toast("Đã duyệt yêu cầu dọn đi"); }}>Duyệt</button>
                  <button className="secondary-button !h-9" onClick={() => { onChange({ ...c, moveOut: undefined }); toast("Đã từ chối yêu cầu"); }}>Từ chối</button>
                </div>
              </div>
            </>
          )}
        </>
      )}
      {tab === "Người ở" && (
        <>
          <div className="mb-3 flex items-center justify-between"><span className="text-sm text-muted">{active.length}/{c.capacity} chỗ đã dùng</span><button className="text-button !text-xs" onClick={() => setAdding(!adding)}><Icon name="plus" size={14} /> Thêm người ở</button></div>
          {adding && (
            <div className="mb-4 rounded-xl border border-line bg-[#fafbf9] p-4">
              <div className="form-grid">
                <Field label="Họ tên"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
                <Field label="Số điện thoại"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="09xxxxxxxx" /></Field>
                <Field label="Ngày vào ở" hint="Dùng để chia hóa đơn theo ngày"><input type="date" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} /></Field>
              </div>
              {error === "ROOM_CAPACITY_EXCEEDED" ? (
                <div className="alert alert-error mt-3"><Icon name="shield" size={18} /><div><code>422 · ROOM_CAPACITY_EXCEEDED</code><br />Phòng đã đủ {c.capacity} người. Cần một người rời đi trước khi thêm người mới.</div></div>
              ) : error && <div className="field-error mt-3">{error}</div>}
              <div className="mt-3 flex justify-end gap-2"><button className="secondary-button !h-9" onClick={() => { setAdding(false); setError(""); }}>Hủy</button><button className="primary-button !h-9" onClick={addOccupant}>Thêm</button></div>
            </div>
          )}
          <div className="divide-y divide-line rounded-xl border border-line">
            {c.occupants.map((o) => (
              <div key={o.name} className="flex flex-wrap items-center gap-3 p-3.5">
                <span className="avatar-chip !h-9 !w-9">{o.name.split(" ").pop()![0]}</span>
                <div className="min-w-0 flex-1"><b className="text-sm">{o.name}</b> {o.rep && <Pill tone="teal">Đại diện phòng</Pill>}<div className="sub text-xs text-muted">{o.phone} · Vào {toVNTime(o.from)}{o.to && ` · Rời ${toVNTime(o.to)}`}</div></div>
                {!o.to && !o.rep && <button className="text-button" onClick={() => { onChange({ ...c, occupants: c.occupants.map((x) => ({ ...x, rep: x.name === o.name })) }); toast(`${o.name} là đại diện phòng mới`); }}>Đặt làm đại diện</button>}
                {!o.to && !o.rep && <button className="text-button !text-[#a63e28]" onClick={() => { onChange({ ...c, occupants: c.occupants.map((x) => x.name === o.name ? { ...x, to: new Date().toISOString() } : x) }); toast("Đã ghi nhận ngày rời đi"); }}>Ghi nhận rời đi</button>}
              </div>
            ))}
          </div>
        </>
      )}
      {tab === "Dịch vụ" && <Services toast={toast} />}
      {tab === "Chia hóa đơn" && <SplitBilling c={c} />}
    </>
  );
}

export default function Contracts() {
  const [rows, setRows] = useState(seed);
  const [tab, setTab] = useState("Tất cả");
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirm, setConfirm] = useState<"renew" | "terminate" | null>(null);
  const [toast, show] = useToast();
  const list = tab === "Tất cả" ? rows : rows.filter((r) => r.status === tab);
  const open = rows.find((r) => r.id === openId);
  const update = (c: Contract) => setRows(rows.map((r) => (r.id === c.id ? c : r)));
  const setStatus = (s: Status, msg: string) => { if (open) { update({ ...open, status: s }); show(msg); } };
  return (
    <>
      <PageHead eyebrow="Pháp lý" title="Hợp đồng thuê" desc="Tạo nháp, chốt giá, ký, gia hạn và thanh lý. Quản lý người ở và chia hóa đơn theo ngày. Giờ hiển thị theo UTC+7."
        actions={<button className="primary-button" onClick={() => setCreating(true)}><Icon name="plus" size={16} /> Tạo hợp đồng</button>} />
      <section className="stats-grid mb-6">
        <MiniStat label="Đang hiệu lực" value="118" note="Trên 4 tòa nhà" />
        <MiniStat label="Chờ ký" value="6" note="3 gửi qua email hôm nay" tone="sky" />
        <MiniStat label="Hết hạn trong 30 ngày" value="9" note="Cần liên hệ gia hạn" tone="amber" />
        <MiniStat label="Yêu cầu dọn đi" value="2" note="Chờ quản lý duyệt" tone="coral" />
      </section>
      <article className="panel">
        <Toolbar placeholder="Tìm số hợp đồng, khách thuê..."><Tabs items={["Tất cả", "Nháp", "Chờ ký", "Hiệu lực", "Sắp hết hạn", "Đã thanh lý"]} value={tab} onChange={setTab} /></Toolbar>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Số HĐ</th><th>Khách thuê</th><th>Phòng</th><th>Thời hạn</th><th className="text-right">Giá thuê</th><th className="text-right">Cọc</th><th>Trạng thái</th><th></th></tr></thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id} className="cursor-pointer" onClick={() => setOpenId(r.id)}>
                  <td className="font-mono text-xs font-bold">{r.id}</td>
                  <td><b>{r.tenant}</b><div className="sub">{r.occupants.filter((o) => !o.to).length}/{r.capacity} người ở{r.moveOut && " · có yêu cầu dọn đi"}</div></td>
                  <td className="text-[13px]">{r.room}</td>
                  <td className="whitespace-nowrap text-xs">{toVNTime(r.start)} → {toVNTime(r.end)}</td>
                  <td className="text-right font-bold">{vnd(r.rent)}</td>
                  <td className="text-right text-muted">{vnd(r.deposit)}</td>
                  <td><Pill tone={tones[r.status]}>{r.status}</Pill></td>
                  <td><button className="text-button">Chi tiết <Icon name="chevron" size={13} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <Drawer open={!!open} wide eyebrow={open?.room} title={`Hợp đồng ${open?.id ?? ""}`} onClose={() => { setOpenId(null); setConfirm(null); }}
        footer={open && (confirm ? (
          <>
            <span className="mr-auto self-center text-sm">{confirm === "renew" ? "Gia hạn thêm 12 tháng, giữ nguyên giá?" : "Thanh lý sớm và hoàn cọc theo điều khoản?"}</span>
            <button className="secondary-button" onClick={() => setConfirm(null)}>Hủy</button>
            <button className={confirm === "renew" ? "primary-button" : "danger-button"} onClick={() => { if (confirm === "renew") { update({ ...open, status: "Hiệu lực", end: new Date(Date.parse(open.end) + 365 * DAY).toISOString() }); show("Đã gia hạn hợp đồng"); } else setStatus("Đã thanh lý", "Đã thanh lý hợp đồng"); setConfirm(null); }}>Xác nhận</button>
          </>
        ) : (
          <>
            {open.status === "Nháp" && <button className="primary-button" onClick={() => setStatus("Chờ ký", "Đã chốt giá và gửi ký")}>Chốt giá & gửi ký</button>}
            {open.status === "Chờ ký" && <button className="primary-button" onClick={() => setStatus("Hiệu lực", "Hợp đồng đã được ký")}><Icon name="check" size={15} /> Xác nhận đã ký</button>}
            {(open.status === "Hiệu lực" || open.status === "Sắp hết hạn") && <><button className="danger-button" onClick={() => setConfirm("terminate")}>Thanh lý sớm</button><button className="primary-button" onClick={() => setConfirm("renew")}>Gia hạn</button></>}
            <button className="secondary-button"><Icon name="download" size={15} /> Xuất PDF</button>
          </>
        ))}>
        {open && <Detail key={open.id} c={open} onChange={update} toast={show} />}
      </Drawer>

      <Drawer open={creating} eyebrow="Bước 1 · Nháp" title="Tạo hợp đồng mới" onClose={() => setCreating(false)}
        footer={<><button className="secondary-button" onClick={() => setCreating(false)}>Hủy</button><button className="primary-button" onClick={() => { setRows([{ ...seed[1], id: "HĐ-0432", tenant: "Phan Ngọc Hân", status: "Nháp", occupants: [{ name: "Phan Ngọc Hân", phone: "0909876543", from: "2026-10-15T00:00:00Z", rep: true }] }, ...rows]); setCreating(false); show("Đã lưu hợp đồng nháp HĐ-0432"); }}>Lưu nháp</button></>}>
        <div className="form-grid">
          <Field label="Tòa nhà"><select><option>The Fern House</option><option>Mộc Residence</option><option>Căn hộ An Nhiên</option></select></Field>
          <Field label="Phòng" hint="Chỉ phòng Trống / Sắp trống"><select><option>B.305 · tối đa 2 người</option><option>A.305 · tối đa 3 người</option></select></Field>
          <Field label="Khách đứng tên" ><input defaultValue="Phan Ngọc Hân" /></Field>
          <Field label="SĐT / Email"><input defaultValue="0909876543" /></Field>
          <Field label="Ngày bắt đầu"><input type="date" defaultValue="2026-10-15" /></Field>
          <Field label="Thời hạn"><select><option>12 tháng</option><option>6 tháng</option><option>24 tháng</option></select></Field>
          <Field label="Giá thuê (₫/tháng)" hint="Có thể chỉnh đến khi chốt giá"><input defaultValue="3.800.000" /></Field>
          <Field label="Tiền cọc"><input defaultValue="7.600.000" /></Field>
          <div className="span-2"><Field label="Điều khoản bổ sung"><textarea placeholder="Ví dụ: miễn phí gửi 1 xe máy…" /></Field></div>
        </div>
      </Drawer>
      {toast}
    </>
  );
}
