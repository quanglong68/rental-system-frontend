import { useEffect, useState } from "react";
import { Drawer, Field, Icon, MiniStat, PageHead, useToast } from "../../components/ui";
import { getStaff, getStaffBuildings, replaceStaffBuildings, updateStaff, type UserProfile } from "../../api/userNotification";

type Member = UserProfile;

export default function Staff() {
  const [rows, setRows] = useState<Member[]>([]);
  const [edit, setEdit] = useState<Member | null>(null);
  const [assigned, setAssigned] = useState("");
  const [form, setForm] = useState({ fullName: "", phone: "", email: "", position: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [toast, show] = useToast();
  const loadStaff = async () => {
    setLoading(true); setError("");
    try { setRows((await getStaff(0, 100)).content); }
    catch (e) { setError(e instanceof Error ? e.message : "Không tải được danh sách nhân viên."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void loadStaff(); }, []);
  const openForm = async (person: Member) => {
    setEdit(person);
    setForm({ fullName: person.fullName ?? "", phone: person.phone ?? "", email: person.email ?? "", position: person.position ?? "" });
    setAssigned((person.buildingIds ?? []).join(", "));
    try { setAssigned((await getStaffBuildings(person.id)).join(", ")); }
    catch (e) { setError(e instanceof Error ? e.message : "Không tải được tòa nhà được phân công."); }
  };
  const save = async () => {
    if (!edit) return;
    const buildingIds = assigned.split(",").map((value) => value.trim()).filter(Boolean).map(Number);
    if (buildingIds.some((id) => !Number.isSafeInteger(id) || id < 1)) {
      setError("Mã tòa nhà phải là số nguyên dương, ngăn cách bằng dấu phẩy."); return;
    }
    setSaving(true); setError("");
    try {
      await updateStaff(edit.id, { ...form, phone: form.phone.trim() || null, email: form.email.trim() || null, position: form.position.trim() || null });
      await replaceStaffBuildings(edit.id, buildingIds);
      await loadStaff(); setEdit(null); show("Đã cập nhật nhân viên");
    } catch (e) { setError(e instanceof Error ? e.message : "Không lưu được thông tin nhân viên."); }
    finally { setSaving(false); }
  };
  const list = rows.filter((person) => `${person.fullName} ${person.email ?? ""}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <>
      <PageHead eyebrow="ADMIN · Toàn hệ thống" title="Nhân sự" desc="Xem và cập nhật hồ sơ nhân viên cùng mã các tòa nhà được phân công." />
      <section className="stats-grid mb-6">
        <MiniStat label="Nhân viên" value={String(rows.length)} note={loading ? "Đang đồng bộ" : "Dữ liệu từ user-notification-service"} />
      </section>
      <article className="panel">
        <div className="toolbar"><label className="field-search"><Icon name="search" size={16} /><input placeholder="Tìm tên, email..." value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Tìm nhân viên" /></label></div>
        {error && <p className="alert alert-error mx-4 mt-4">{error}</p>}
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Nhân viên</th><th>Chức vụ</th><th>Mã tòa nhà</th><th></th></tr></thead>
            <tbody>{list.map((person) => (
              <tr key={person.id}>
                <td><div className="flex items-center gap-3"><span className="avatar-chip !h-9 !w-9">{person.fullName?.trim().split(" ").pop()?.[0] ?? "?"}</span><div><b>{person.fullName}</b><div className="sub">{person.email || person.phone || "Chưa có email hoặc số điện thoại"}</div></div></div></td>
                <td className="text-[13px]">{person.isAdmin ? "Quản trị viên" : person.position || "Chưa cập nhật"}</td>
                <td className="text-[13px]">{person.buildingIds?.length ? person.buildingIds.map((id) => `#${id}`).join(", ") : "Chưa phân công"}</td>
                <td><button className="text-button" onClick={() => void openForm(person)}>Sửa <Icon name="chevron" size={12} /></button></td>
              </tr>))}
              {!loading && list.length === 0 && <tr><td colSpan={4} className="text-center text-muted">Không có nhân viên phù hợp.</td></tr>}
              {loading && <tr><td colSpan={4} className="text-center text-muted">Đang tải danh sách…</td></tr>}
            </tbody>
          </table>
        </div>
      </article>
      <Drawer open={!!edit} eyebrow="Nhân sự" title={edit?.fullName ?? "Sửa nhân viên"} onClose={() => setEdit(null)}
        footer={<><button className="secondary-button" onClick={() => setEdit(null)}>Hủy</button><button className="primary-button" onClick={() => void save()} disabled={saving}>{saving ? "Đang lưu…" : "Lưu thay đổi"}</button></>}>
        <div className="form-grid" key={edit?.id ?? "none"}>
          <div className="span-2"><Field label="Họ tên"><input value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} placeholder="Nguyễn Văn A" /></Field></div>
          <Field label="Email"><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="ten@example.com" /></Field>
          <Field label="Số điện thoại"><input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="09xxxxxxxx" /></Field>
          <div className="span-2"><Field label="Chức vụ"><input value={form.position} onChange={(event) => setForm({ ...form, position: event.target.value })} placeholder="Quản lý, kỹ thuật…" /></Field></div>
          <div className="span-2"><Field label="Mã tòa nhà" hint="Nhập ID số, ngăn cách bằng dấu phẩy. Backend hiện chưa cung cấp danh sách tên tòa nhà."><input value={assigned} onChange={(event) => setAssigned(event.target.value)} placeholder="1, 2" /></Field></div>
          {error && <p className="field-error span-2">{error}</p>}
        </div>
      </Drawer>
      {toast}
    </>
  );
}
