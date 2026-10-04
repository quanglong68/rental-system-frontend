import { useState } from "react";
import { segments, splitDaily } from "../../lib/split";
import { Drawer, Field, Icon, MiniStat, PageHead, Pill, Switch, Toolbar, useToast, vnd, type Tone } from "../../components/ui";

const invoices = [
  { id: "INV-1025-0402", room: "A.402", tenants: ["Hoàng Thị Mai", "Đỗ Minh Khoa"], days: [31, 22], rent: 4200000, elec: 612000, water: 180000, service: 300000, status: "Đã thu" },
  { id: "INV-1025-0201", room: "C.201", tenants: ["Trịnh Gia Huy", "Bùi Ngọc Ánh", "Mai Tuấn"], days: [31, 31, 18], rent: 5100000, elec: 845500, water: 270000, service: 450000, status: "Thu một phần" },
  { id: "INV-1025-0305", room: "B.305", tenants: ["Nguyễn Lam"], days: [31], rent: 3800000, elec: 402300, water: 90000, service: 150000, status: "Quá hạn" },
  { id: "INV-1025-0108", room: "A.108", tenants: ["Phan Hải Yến", "Lưu Bảo"], days: [31, 31], rent: 3500000, elec: 388000, water: 180000, service: 300000, status: "Chưa thu" },
];
const tones: Record<string, Tone> = { "Đã thu": "teal", "Thu một phần": "sky", "Quá hạn": "coral", "Chưa thu": "amber" };
const total = (i: (typeof invoices)[0]) => i.rent + i.elec + i.water + i.service;

export default function Finance() {
  const [open, setOpen] = useState(invoices[1]);
  const [paid, setPaid] = useState<Record<string, boolean>>({ "INV-1025-0402:0": true, "INV-1025-0402:1": true, "INV-1025-0201:0": true });
  const [cash, setCash] = useState<number | null>(null);
  const [services, setServices] = useState(false);
  const [svc, setSvc] = useState([{ k: "Điện", unit: "kWh", price: 3500, on: true }, { k: "Nước", unit: "m³", price: 18000, on: true }, { k: "Gửi xe máy", unit: "xe/tháng", price: 100000, on: true }, { k: "Gửi ô tô", unit: "xe/tháng", price: 1200000, on: false }, { k: "Internet", unit: "phòng/tháng", price: 100000, on: true }, { k: "Vệ sinh", unit: "người/tháng", price: 50000, on: true }]);
  const [toast, show] = useToast();
  const [gen, setGen] = useState(0);
  const split = splitDaily(total(open), 31, open.days.map((d) => [32 - d, 31]));
  const share = (idx: number) => split.shares[idx];
  return (
    <>
      <PageHead eyebrow="Kỳ thu tháng 10/2026" title="Tài chính & Hóa đơn" desc="Mỗi ngày, chi phí được chia đều cho số người có mặt hôm đó rồi cộng dồn thành hóa đơn cá nhân, làm tròn đến hàng nghìn đồng. Ghi nhận thu tiền mặt tại quầy."
        actions={<><button className="secondary-button" onClick={() => setServices(true)}><Icon name="tools" size={16} /> Bảng giá dịch vụ</button><button className="primary-button" onClick={() => setGen(1)}><Icon name="plus" size={16} /> Sinh hóa đơn tháng</button></>} />
      <section className="stats-grid mb-6">
        <MiniStat label="Phải thu" value="529 tr" note="132 hóa đơn kỳ này" tone="slate" />
        <MiniStat label="Đã thu" value="486,2 tr" note="91,9% tổng phải thu" />
        <MiniStat label="Công nợ" value="42,8 tr" note="12 hóa đơn chưa tất toán" tone="amber" />
        <MiniStat label="Quá hạn" value="8" note="Đã gửi nhắc nợ tự động" tone="coral" />
      </section>
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <article className="panel min-w-0">
          <Toolbar placeholder="Tìm mã hóa đơn, phòng..." />
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Hóa đơn</th><th>Người ở</th><th className="text-right">Tổng</th><th>Trạng thái</th></tr></thead>
              <tbody>{invoices.map((i) => (
                <tr key={i.id} onClick={() => setOpen(i)} className={open.id === i.id ? "row-on" : ""}>
                  <td><b>Phòng {i.room}</b><div className="sub font-mono">{i.id}</div></td>
                  <td><div className="flex -space-x-2">{i.tenants.map((t) => <span key={t} title={t} className="avatar-chip">{t.split(" ").pop()![0]}</span>)}</div></td>
                  <td className="text-right font-bold">{vnd(total(i))}</td>
                  <td><Pill tone={tones[i.status]}>{i.status}</Pill></td>
                </tr>))}
              </tbody>
            </table>
          </div>
        </article>
        <article className="panel">
          <div className="panel-header"><div><h2>Chi tiết · Phòng {open.room}</h2><p>{open.id}</p></div><Pill tone={tones[open.status]}>{open.status}</Pill></div>
          <div className="p-5">
            {[["Tiền phòng", open.rent], ["Điện", open.elec], ["Nước", open.water], ["Dịch vụ (wifi, rác, giữ xe)", open.service]].map(([k, v]) => (
              <div key={k as string} className="flex justify-between py-2 text-[13px]"><span className="text-muted">{k}</span><b>{vnd(v as number)}</b></div>
            ))}
            <div className="mt-2 flex justify-between border-t border-dashed border-line pt-3"><b>Tổng cộng</b><b className="text-lg">{vnd(total(open))}</b></div>
            <div className="split-box mt-5">
              <div className="mb-1 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-teal"><Icon name="split" size={15} /> Chia theo ngày có mặt</div>
              <div className="mb-2 text-[11px] text-muted">{segments(split.headcount).map((g) => `Ngày ${g.from}–${g.to}: ${g.n} người`).join(" · ")}</div>
              {open.tenants.map((t, idx) => { const ok = paid[`${open.id}:${idx}`]; return (
                <div key={t} className="flex items-center justify-between gap-2 py-2 text-[13px]">
                  <span className="flex min-w-0 items-center gap-2"><span className="avatar-chip">{t.split(" ").pop()![0]}</span><span className="truncate">{t}<small className="block text-[10.5px] text-muted">{open.days[idx]}/31 ngày</small></span></span>
                  <span className="flex items-center gap-2"><b>{vnd(share(idx))}</b>{ok ? <span className="text-teal"><Icon name="check" size={15} /></span> : <button className="text-button" onClick={() => setCash(idx)}>Thu tiền mặt</button>}</span>
                </div>); })}
            </div>
            <button className="primary-button mt-5 w-full" onClick={() => show("Đã gửi nhắc thanh toán cho người chưa trả")}>Gửi nhắc thanh toán</button>
          </div>
        </article>
      </div>
      <Drawer open={cash !== null} eyebrow={`${open.id} · Phòng ${open.room}`} title="Ghi nhận thu tiền mặt" onClose={() => setCash(null)}
        footer={<><button className="secondary-button" onClick={() => setCash(null)}>Hủy</button><button className="primary-button" onClick={() => { setPaid({ ...paid, [`${open.id}:${cash}`]: true }); setCash(null); show("Đã ghi nhận và gửi biên nhận cho khách"); }}><Icon name="check" size={15} /> Xác nhận đã thu</button></>}>
        {cash !== null && (
          <>
            <div className="mb-5 rounded-2xl bg-navy p-5 text-white"><span className="text-xs text-white/60">{open.tenants[cash]} · {open.days[cash]} ngày</span><div className="mt-1 text-3xl font-extrabold tracking-tight text-lime">{vnd(share(cash))}</div></div>
            <div className="form-grid">
              <Field label="Số tiền nhận (₫)"><input defaultValue={(Math.round(share(cash) / 1000) * 1000).toLocaleString("vi-VN")} /></Field>
              <Field label="Thời điểm thu (UTC+7)"><input type="datetime-local" defaultValue="2026-10-04T09:30" /></Field>
              <div className="span-2"><Field label="Người thu"><input defaultValue="Lê Quốc Bảo · QUAN_LY" readOnly /></Field></div>
              <div className="span-2"><Field label="Ghi chú"><textarea placeholder="Số biên lai, mệnh giá…" /></Field></div>
            </div>
          </>
        )}
      </Drawer>
      <Drawer open={services} eyebrow="The Fern House" title="Bảng giá dịch vụ" onClose={() => setServices(false)}
        footer={<><button className="secondary-button" onClick={() => setServices(false)}>Đóng</button><button className="primary-button" onClick={() => { setServices(false); show("Bảng giá áp dụng từ kỳ tháng 11/2026"); }}>Lưu bảng giá</button></>}>
        <div className="divide-y divide-line rounded-xl border border-line">
          {svc.map((x, i) => (
            <div key={x.k} className={`flex items-center gap-3 p-3.5 ${x.on ? "" : "opacity-55"}`}>
              <div className="flex-1"><b className="text-sm">{x.k}</b><div className="text-xs text-muted">{vnd(x.price)} / {x.unit}</div></div>
              <input className="meter-input !w-28 text-right" defaultValue={x.price.toLocaleString("vi-VN")} />
              <Switch on={x.on} label={`Bật ${x.k}`} onChange={(v) => setSvc(svc.map((y, j) => (j === i ? { ...y, on: v } : y)))} />
            </div>
          ))}
        </div>
        <button className="text-button mt-3 !text-xs"><Icon name="plus" size={13} /> Thêm dịch vụ</button>
      </Drawer>
      <Drawer open={gen > 0} eyebrow="Kỳ tháng 10/2026 · The Fern House" title="Sinh hóa đơn hàng tháng" onClose={() => setGen(0)}
        footer={gen === 1 ? <><button className="secondary-button" onClick={() => setGen(0)}>Hủy</button><button className="primary-button" onClick={() => setGen(2)}>Chạy sinh hóa đơn</button></> : <button className="primary-button" onClick={() => { setGen(0); show("Đã phát hành 46 hóa đơn cá nhân và gửi thông báo"); }}>Phát hành & gửi thông báo</button>}>
        <div className="space-y-3">
          {[["Chỉ số điện/nước", "46/48 phòng đã chốt", "2 phòng chưa chốt sẽ dùng chỉ số ước tính", true], ["Dịch vụ theo hợp đồng", "Gửi xe 61 xe · Internet 46 phòng", "Lấy từ đăng ký dịch vụ của từng hợp đồng", true], ["Người ở thực tế", "8 thay đổi trong kỳ", "Ngày vào/rời được dùng để chia theo ngày", true], ["Hóa đơn cá nhân", gen === 2 ? "Đã tạo 46 hóa đơn phòng → 79 hóa đơn cá nhân" : "Chưa chạy", "Tổng phải thu 214.380.000 ₫", gen === 2]].map(([t, v, h, ok]) => (
            <div key={t as string} className="flex gap-3 rounded-xl border border-line p-4">
              <span className={`grid h-8 w-8 flex-none place-items-center rounded-full ${ok ? "bg-teal text-white" : "bg-[#eef1ef] text-muted"}`}><Icon name={ok ? "check" : "clock"} size={15} /></span>
              <div><b className="text-sm">{t as string}</b><div className="text-[13px]">{v as string}</div><div className="text-xs text-muted">{h as string}</div></div>
            </div>
          ))}
        </div>
      </Drawer>
      {toast}
    </>
  );
}
