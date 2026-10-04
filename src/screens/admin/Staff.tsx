import { useState } from "react";
import { Drawer, Field, Icon, MiniStat, PageHead, Pill, Tabs, Toolbar, useToast, type Tone } from "../../components/ui";

const allBuildings = ["The Fern House", "Căn hộ An Nhiên", "Mộc Residence", "Lam Garden"];
type Member = (typeof staff)[number];

const roles: Record<string, { label: string; tone: Tone }> = { QUAN_LY: { label: "Quản lý", tone: "violet" }, KY_THUAT: { label: "Kỹ thuật", tone: "sky" }, SALE: { label: "Sale", tone: "amber" } };
const staff = [
  { name: "Lê Quốc Bảo", email: "bao.le@nhaminh.vn", role: "QUAN_LY", building: "The Fern House", active: true, kpi: "46/50 phòng" },
  { name: "Phạm Thu Hà", email: "ha.pham@nhaminh.vn", role: "QUAN_LY", building: "Căn hộ An Nhiên", active: true, kpi: "31/36 phòng" },
  { name: "Trần Minh", email: "minh.tran@nhaminh.vn", role: "KY_THUAT", building: "Fern House, Mộc", active: true, kpi: "18 phiếu / tháng" },
  { name: "Nguyễn Văn Tài", email: "tai.nguyen@nhaminh.vn", role: "KY_THUAT", building: "An Nhiên, Mộc", active: true, kpi: "12 phiếu / tháng" },
  { name: "Đinh Khánh Linh", email: "linh.dinh@nhaminh.vn", role: "SALE", building: "The Fern House", active: true, kpi: "7 hợp đồng mới" },
  { name: "Hồ Gia Bảo", email: "giabao.ho@nhaminh.vn", role: "SALE", building: "Lam Garden", active: false, kpi: "—" },
];

export default function Staff() {
  const [tab, setTab] = useState("Tất cả");
  const [rows, setRows] = useState(staff);
  const [edit, setEdit] = useState<Member | "new" | null>(null);
  const [assigned, setAssigned] = useState<string[]>([]);
  const [role, setRole] = useState("SALE");
  const [toast, show] = useToast();
  const list = tab === "Tất cả" ? rows : rows.filter((s) => roles[s.role].label === tab);
  const m = edit && edit !== "new" ? edit : null;
  const openForm = (x: Member | "new") => { setEdit(x); setRole(x === "new" ? "SALE" : x.role); setAssigned(x === "new" ? [] : allBuildings.filter((b) => x.building.split(", ").some((p) => b.includes(p)))); };
  const save = () => {
    const building = assigned.join(", ") || "Chưa phân công";
    if (m) setRows(rows.map((r) => (r.email === m.email ? { ...r, role, building } : r)));
    else setRows([{ name: "Nhân viên mới", email: "moi@nhaminh.vn", role, building, active: true, kpi: "—" }, ...rows]);
    setEdit(null); show(m ? "Đã cập nhật nhân viên" : "Đã tạo tài khoản và gửi mật khẩu tạm qua email");
  };
  return (
    <>
      <PageHead eyebrow="ADMIN · Toàn hệ thống" title="Nhân sự" desc="Tạo tài khoản STAFF, gán vai trò QUAN_LY / KY_THUAT / SALE và phân công theo tòa nhà."
        actions={<button className="primary-button" onClick={() => openForm("new")}><Icon name="plus" size={16} /> Thêm nhân viên</button>} />
      <section className="stats-grid mb-6">
        <MiniStat label="Tổng nhân sự" value="14" note="13 đang hoạt động" />
        <MiniStat label="Quản lý" value="3" note="1 tòa nhà còn trống" tone="violet" />
        <MiniStat label="Kỹ thuật" value="5" note="Trung bình 3,1 phiếu / ngày" tone="sky" />
        <MiniStat label="Sale" value="6" note="21 hợp đồng mới quý này" tone="amber" />
      </section>
      <article className="panel">
        <Toolbar placeholder="Tìm tên, email..."><Tabs items={["Tất cả", "Quản lý", "Kỹ thuật", "Sale"]} value={tab} onChange={setTab} /></Toolbar>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Nhân viên</th><th>Vai trò</th><th>Tòa nhà phụ trách</th><th>Hiệu suất</th><th>Trạng thái</th><th></th></tr></thead>
            <tbody>{list.map((s) => (
              <tr key={s.email} className={s.active ? "" : "opacity-60"}>
                <td><div className="flex items-center gap-3"><span className="avatar-chip !h-9 !w-9">{s.name.split(" ").pop()![0]}</span><div><b>{s.name}</b><div className="sub">{s.email}</div></div></div></td>
                <td><Pill tone={roles[s.role].tone}>{s.role}</Pill></td>
                <td className="text-[13px]">{s.building}</td>
                <td className="text-[13px] font-semibold">{s.kpi}</td>
                <td>{s.active ? <span className="flex items-center gap-1.5 text-xs font-bold text-teal"><span className="dot dot-teal"></span>Hoạt động</span> : <span className="flex items-center gap-1.5 text-xs font-bold text-muted"><span className="dot dot-slate"></span>Tạm khóa</span>}</td>
                <td><button className="text-button" onClick={() => openForm(s)}>Sửa <Icon name="chevron" size={12} /></button></td>
              </tr>))}
            </tbody>
          </table>
        </div>
      </article>
      <Drawer open={!!edit} eyebrow="Nhân sự" title={m ? m.name : "Thêm nhân viên"} onClose={() => setEdit(null)}
        footer={<>{m && <button className="danger-button mr-auto" onClick={() => { setRows(rows.map((r) => (r.email === m.email ? { ...r, active: !r.active } : r))); setEdit(null); show(m.active ? "Đã tạm khóa tài khoản" : "Đã mở khóa tài khoản"); }}>{m.active ? "Tạm khóa" : "Mở khóa"}</button>}<button className="secondary-button" onClick={() => setEdit(null)}>Hủy</button><button className="primary-button" onClick={save}>{m ? "Lưu" : "Tạo tài khoản"}</button></>}>
        <div className="form-grid" key={m?.email ?? "new"}>
          <div className="span-2"><Field label="Họ tên"><input defaultValue={m?.name} placeholder="Nguyễn Văn A" /></Field></div>
          <Field label="Email đăng nhập"><input defaultValue={m?.email} placeholder="ten@nhaminh.vn" /></Field>
          <Field label="Số điện thoại"><input placeholder="09xxxxxxxx" defaultValue={m ? "0901234567" : ""} /></Field>
          <div className="span-2"><Field label="Vai trò">
            <div className="grid grid-cols-3 gap-2">{Object.entries(roles).map(([k, v]) => (
              <button key={k} type="button" onClick={() => setRole(k)} className={`rounded-xl border p-3 text-left transition ${role === k ? "border-teal bg-[#eef8f4] ring-2 ring-teal/20" : "border-line"}`}><b className="block text-sm">{v.label}</b><span className="font-mono text-[10px] text-muted">{k}</span></button>
            ))}</div>
          </Field></div>
          <div className="span-2"><Field label="Tòa nhà phụ trách" hint={role === "QUAN_LY" ? "Quản lý chỉ thấy dữ liệu của tòa được gán" : "Có thể gán nhiều tòa"}>
            <div className="grid grid-cols-2 gap-2">{allBuildings.map((b) => { const on = assigned.includes(b); return (
              <button key={b} type="button" onClick={() => setAssigned(on ? assigned.filter((x) => x !== b) : [...assigned, b])} className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold ${on ? "border-teal bg-[#eef8f4] text-teal" : "border-line"}`}>
                <span className={`grid h-4 w-4 place-items-center rounded ${on ? "bg-teal text-white" : "border border-line"}`}>{on && <Icon name="check" size={11} />}</span>{b}</button>); })}</div>
          </Field></div>
        </div>
      </Drawer>
      {toast}
    </>
  );
}
