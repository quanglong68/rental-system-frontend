import { useState } from "react";
import { Drawer, Field, Icon, MiniStat, PageHead, Pill, Toolbar, useToast, vnd } from "../ui";

const data = [
  { code: "FERN", name: "The Fern House", address: "112 Nguyễn Gia Trí, Bình Thạnh", floors: 7, rooms: 50, rented: 46, revenue: 186400000, manager: "Lê Quốc Bảo", staff: 6, image: "https://images.unsplash.com/photo-1762792013200-d474b123e1b8?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=80&w=700" },
  { code: "ANN", name: "Căn hộ An Nhiên", address: "28 Nguyễn Thị Thập, Quận 7", floors: 6, rooms: 36, rented: 31, revenue: 142800000, manager: "Phạm Thu Hà", staff: 4, image: "https://images.unsplash.com/photo-1737737149038-e6532662659e?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=80&w=700" },
  { code: "MOC", name: "Mộc Residence", address: "9 Trần Quang Diệu, Quận 3", floors: 5, rooms: 28, rented: 25, revenue: 101500000, manager: "Võ Thanh Tùng", staff: 3, image: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=80&w=700" },
  { code: "LAM", name: "Lam Garden", address: "45 Lê Văn Việt, TP. Thủ Đức", floors: 4, rooms: 18, rented: 16, revenue: 55500000, manager: "Chưa phân công", staff: 1, image: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=80&w=700" },
];

export default function Buildings() {
  const [selected, setSelected] = useState(data[0]);
  const [form, setForm] = useState<null | "new" | "edit">(null);
  const [pos, setPos] = useState({ lat: "10.8031", lng: "106.7147" });
  const [toast, show] = useToast();
  const edit = form === "edit";
  return (
    <>
      <PageHead eyebrow="Danh mục tài sản" title="Tòa nhà" desc="Quản lý thông tin, tọa độ GPS, nhân sự phụ trách và hiệu quả khai thác của từng tòa nhà."
        actions={<><button className="secondary-button"><Icon name="download" size={16} /> Xuất Excel</button><button className="secondary-button" onClick={() => setForm("edit")}>Sửa {selected.code}</button><button className="primary-button" onClick={() => setForm("new")}><Icon name="plus" size={16} /> Thêm tòa nhà</button></>} />
      <section className="stats-grid mb-6">
        <MiniStat label="Tổng tòa nhà" value="4" note="Tại 4 quận, TP.HCM" />
        <MiniStat label="Tổng phòng" value="132" note="118 đang cho thuê" />
        <MiniStat label="Doanh thu tháng" value="486,2 tr" note="Tăng 12,8% so tháng trước" />
        <MiniStat label="Thiếu quản lý" value="1" note="Lam Garden cần phân công" tone="coral" />
      </section>
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <article className="panel min-w-0">
          <Toolbar placeholder="Tìm theo tên, địa chỉ..."><button className="secondary-button !h-9"><Icon name="filter" size={15} /> Khu vực</button></Toolbar>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Tòa nhà</th><th>Lấp đầy</th><th>Quản lý</th><th className="text-right">Doanh thu</th></tr></thead>
              <tbody>
                {data.map((b) => {
                  const pct = Math.round((b.rented / b.rooms) * 100);
                  return (
                    <tr key={b.code} onClick={() => setSelected(b)} className={selected.code === b.code ? "row-on" : ""}>
                      <td><div className="flex items-center gap-3"><img src={b.image} alt="" className="h-11 w-11 rounded-xl object-cover" /><div><b>{b.name}</b><div className="sub">{b.address}</div></div></div></td>
                      <td className="w-40"><div className="mb-1.5 text-xs font-bold">{pct}% <span className="font-medium text-muted">· {b.rented}/{b.rooms}</span></div><div className="progress-track"><div style={{ width: `${pct}%` }}></div></div></td>
                      <td>{b.manager === "Chưa phân công" ? <Pill tone="coral">Chưa phân công</Pill> : <span className="text-[13px] font-semibold">{b.manager}</span>}</td>
                      <td className="text-right font-bold">{vnd(b.revenue)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </article>
        <article className="panel">
          <img src={selected.image} alt={selected.name} className="h-48 w-full object-cover" />
          <div className="p-5">
            <div className="flex items-start justify-between gap-3"><div><Pill tone="teal">Mã {selected.code}</Pill><h2 className="mt-2 text-xl font-extrabold tracking-tight">{selected.name}</h2><div className="mt-1 flex items-center gap-1 text-xs text-muted"><Icon name="pin" size={13} />{selected.address}</div></div><button className="icon-button"><Icon name="more" size={18} /></button></div>
            <dl className="detail-grid mt-5">
              <div><dt>Số tầng</dt><dd>{selected.floors}</dd></div>
              <div><dt>Số phòng</dt><dd>{selected.rooms}</dd></div>
              <div><dt>Nhân sự</dt><dd>{selected.staff} người</dd></div>
              <div><dt>Phòng trống</dt><dd>{selected.rooms - selected.rented}</dd></div>
            </dl>
            <div className="map-box mt-5"><Icon name="pin" size={22} /><span>10.8031° B · 106.7140° Đ</span></div>
            <div className="mt-5 grid grid-cols-2 gap-2"><button className="secondary-button">Sơ đồ phòng</button><button className="primary-button">Phân công nhân sự</button></div>
          </div>
        </article>
      </div>
      <Drawer open={!!form} eyebrow="Danh mục tài sản" title={edit ? `Sửa ${selected.name}` : "Thêm tòa nhà"} onClose={() => setForm(null)}
        footer={<><button className="secondary-button" onClick={() => setForm(null)}>Hủy</button><button className="primary-button" onClick={() => { setForm(null); show(edit ? "Đã cập nhật tòa nhà" : "Đã tạo tòa nhà mới"); }}>{edit ? "Lưu" : "Tạo tòa nhà"}</button></>}>
        <div className="form-grid" key={form ?? ""}>
          <Field label="Mã"><input defaultValue={edit ? selected.code : ""} placeholder="SEN" /></Field>
          <Field label="Tên tòa nhà"><input defaultValue={edit ? selected.name : ""} placeholder="Sen Garden" /></Field>
          <div className="span-2"><Field label="Địa chỉ"><input defaultValue={edit ? selected.address : ""} placeholder="Số nhà, đường" /></Field></div>
          <Field label="Tỉnh / Thành"><select><option>TP. Hồ Chí Minh</option><option>Hà Nội</option></select></Field>
          <Field label="Quận / Huyện"><select><option>Bình Thạnh</option><option>Quận 3</option><option>Quận 7</option><option>TP. Thủ Đức</option></select></Field>
          <Field label="Vĩ độ (lat)" hint="Dùng cho tìm kiếm bán kính"><input value={pos.lat} onChange={(e) => setPos({ ...pos, lat: e.target.value })} /></Field>
          <Field label="Kinh độ (lng)"><input value={pos.lng} onChange={(e) => setPos({ ...pos, lng: e.target.value })} /></Field>
          <div className="span-2 relative h-40 overflow-hidden rounded-xl border border-line bg-[#e9efe9] [background-image:linear-gradient(#d7e1db_1px,transparent_1px),linear-gradient(90deg,#d7e1db_1px,transparent_1px)] [background-size:28px_28px]">
            <span className="absolute left-1/2 top-1/2 grid h-9 w-9 -translate-x-1/2 -translate-y-full place-items-center rounded-full rounded-bl-none bg-navy text-lime shadow-lg [transform:translate(-50%,-100%)_rotate(-45deg)]"><span className="rotate-45"><Icon name="pin" size={16} /></span></span>
            <span className="absolute bottom-2 left-2 rounded-lg bg-white/90 px-2 py-1 font-mono text-[11px] font-bold">{pos.lat}, {pos.lng}</span>
          </div>
          <Field label="Số tầng"><input type="number" defaultValue={edit ? selected.floors : 5} /></Field>
          <Field label="Quản lý phụ trách"><select defaultValue={edit ? selected.manager : ""}><option value="">Chưa phân công</option><option>Lê Quốc Bảo</option><option>Phạm Thu Hà</option><option>Võ Thanh Tùng</option></select></Field>
        </div>
      </Drawer>
      {toast}
    </>
  );
}
