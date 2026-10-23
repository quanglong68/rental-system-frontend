import { useCallback, useEffect, useState } from "react";
import { Drawer, Field, Icon, MiniStat, PageHead, Pill, Tabs, Toolbar, useToast, type Tone } from "@/shared/ui";
import { apiFetch } from "@/shared/api/httpClient";
import {
  getStaff,
  updateStaff,
  replaceStaffBuildings,
  type UserProfile,
} from "@/api/userNotification";

const roleOptions: Record<string, { label: string; tone: Tone }> = {
  QUAN_LY: { label: "Quản lý", tone: "violet" },
  KY_THUAT: { label: "Kỹ thuật", tone: "sky" },
  SALE: { label: "Sale", tone: "amber" },
  ADMIN: { label: "Quản trị", tone: "coral" },
};

function resolveRole(position: string | null, isAdmin: boolean | null): string {
  if (isAdmin) return "ADMIN";
  if (!position) return "SALE";
  const upper = position.toUpperCase();
  if (upper.includes("QUAN_LY") || upper.includes("QUẢN LÝ")) return "QUAN_LY";
  if (upper.includes("KY_THUAT") || upper.includes("KỸ THUẬT")) return "KY_THUAT";
  if (upper.includes("SALE")) return "SALE";
  return position in roleOptions ? position : "SALE";
}

export default function Staff() {
  const [tab, setTab] = useState("Tất cả");
  const [staffList, setStaffList] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const [edit, setEdit] = useState<UserProfile | "new" | null>(null);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState("SALE");
  const [formBuildings, setFormBuildings] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [toast, show] = useToast();

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getStaff(0, 100);
      setStaffList(res.content || []);
    } catch {
      setError("Không thể tải danh sách nhân sự từ máy chủ.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const openForm = (x: UserProfile | "new") => {
    setEdit(x);
    setFormError("");
    if (x === "new") {
      setFormName("");
      setFormEmail("");
      setFormPhone("");
      setFormPassword("");
      setFormRole("SALE");
      setFormBuildings("");
    } else {
      setFormName(x.fullName || "");
      setFormEmail(x.email || "");
      setFormPhone(x.phone || "");
      setFormPassword("");
      setFormRole(resolveRole(x.position, x.isAdmin));
      setFormBuildings((x.buildingIds || []).join(", "));
    }
  };

  const save = async () => {
    setFormError("");
    if (!formName.trim()) {
      setFormError("Vui lòng nhập họ tên.");
      return;
    }
    const buildingIdList = formBuildings
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter((s) => /^\d+$/.test(s))
      .map(Number);

    setSaving(true);
    try {
      if (edit === "new") {
        if (!formEmail.trim() && !formPhone.trim()) {
          setFormError("Vui lòng nhập email hoặc số điện thoại làm tài khoản.");
          setSaving(false);
          return;
        }
        if (!formPassword || formPassword.length < 8) {
          setFormError("Mật khẩu khởi tạo tối thiểu 8 ký tự.");
          setSaving(false);
          return;
        }
        const username = (formEmail.trim() || formPhone.trim()).toLowerCase();
        await apiFetch("/api/v1/auth/accounts", {
          method: "POST",
          body: {
            username,
            password: formPassword,
            fullName: formName.trim(),
            email: formEmail.trim() || undefined,
            phone: formPhone.trim() || undefined,
            accountType: "STAFF",
            roles: [formRole],
          },
        });
        show("Đã tạo tài khoản nhân viên.");
      } else if (edit) {
        const currentRole = resolveRole(edit.position, edit.isAdmin);
        const roleChanged = formRole !== currentRole;

        // B1: Cập nhật role thật trong auth-service (nếu role thay đổi)
        if (roleChanged) {
          try {
            await apiFetch(`/api/v1/auth/accounts/${edit.id}/roles`, {
              method: "PUT",
              body: { roles: [formRole] },
            });
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Lỗi kết nối auth-service";
            setFormError(`Cập nhật vai trò thất bại trên auth-service: ${msg}. Vai trò chưa được thay đổi.`);
            setSaving(false);
            return;
          }
        }

        // B2: Cập nhật profile & position trong user-notification-service
        try {
          await updateStaff(edit.id, {
            fullName: formName.trim(),
            phone: formPhone.trim() || null,
            email: formEmail.trim() || null,
            position: formRole,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Lỗi kết nối user-notification-service";
          if (roleChanged) {
            setFormError(`Đã đổi vai trò sang ${formRole} trong auth-service, nhưng cập nhật hồ sơ thất bại: ${msg}`);
          } else {
            setFormError(`Cập nhật hồ sơ nhân viên thất bại: ${msg}`);
          }
          setSaving(false);
          return;
        }

        // B3: Cập nhật phân công tòa nhà
        try {
          await replaceStaffBuildings(edit.id, buildingIdList);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Lỗi cập nhật phân công tòa nhà";
          if (roleChanged) {
            setFormError(
              `Đã đổi vai trò (${formRole}) trong auth-service và cập nhật hồ sơ trong user-notification-service thành công, nhưng phân công tòa nhà thất bại: ${msg}. Vui lòng thử lại thao tác phân công.`
            );
          } else {
            setFormError(
              `Đã cập nhật thông tin hồ sơ nhân viên trong user-notification-service thành công, nhưng phân công tòa nhà thất bại: ${msg}. Vui lòng thử lại thao tác phân công.`
            );
          }
          void loadData();
          setSaving(false);
          return;
        }

        show(roleChanged ? "Đã cập nhật thông tin và vai trò nhân sự thành công." : "Đã cập nhật thông tin nhân viên.");
        setEdit(null);
        await loadData();
      }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Thao tác thất bại. Vui lòng kiểm tra lại quyền.");
    } finally {
      setSaving(false);
    }
  };

  const q = query.trim().toLowerCase();
  const filtered = staffList.filter((s) => {
    const roleKey = resolveRole(s.position, s.isAdmin);
    const matchesTab =
      tab === "Tất cả" ||
      (tab === "Quản lý" && roleKey === "QUAN_LY") ||
      (tab === "Kỹ thuật" && roleKey === "KY_THUAT") ||
      (tab === "Sale" && roleKey === "SALE");
    const matchesQuery =
      !q ||
      (s.fullName && s.fullName.toLowerCase().includes(q)) ||
      (s.email && s.email.toLowerCase().includes(q)) ||
      (s.phone && s.phone.includes(q));
    return matchesTab && matchesQuery;
  });

  const countByRole = (r: string) =>
    staffList.filter((s) => resolveRole(s.position, s.isAdmin) === r).length;

  const m = edit && edit !== "new" ? edit : null;

  return (
    <>
      <PageHead
        eyebrow="ADMIN · Toàn hệ thống"
        title="Nhân sự"
        desc="Quản lý nhân sự, vai trò QUAN_LY / KY_THUAT / SALE và phân công theo tòa nhà từ dữ liệu thực tế."
        actions={
          <button className="primary-button" onClick={() => openForm("new")}>
            <Icon name="plus" size={16} /> Thêm nhân viên
          </button>
        }
      />
      <section className="stats-grid mb-6">
        <MiniStat label="Tổng nhân sự" value={String(staffList.length)} note="Nhân sự trong hệ thống" />
        <MiniStat label="Quản lý" value={String(countByRole("QUAN_LY"))} note="Vai trò QUAN_LY" tone="violet" />
        <MiniStat label="Kỹ thuật" value={String(countByRole("KY_THUAT"))} note="Vai trò KY_THUAT" tone="sky" />
        <MiniStat label="Sale" value={String(countByRole("SALE"))} note="Vai trò SALE" tone="amber" />
      </section>

      <article className="panel">
        <Toolbar placeholder="Tìm tên, email, số điện thoại..." value={query} onChange={(e) => setQuery(e.target.value)}>
          <Tabs items={["Tất cả", "Quản lý", "Kỹ thuật", "Sale"]} value={tab} onChange={setTab} />
        </Toolbar>

        {loading ? (
          <div className="p-8 text-center text-sm text-muted">Đang tải danh sách nhân sự…</div>
        ) : error ? (
          <div className="p-8 text-center">
            <p className="text-sm text-red-600 mb-2">{error}</p>
            <button className="secondary-button" onClick={() => void loadData()}>
              Thử lại
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted">Không tìm thấy nhân sự phù hợp.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nhân viên</th>
                  <th>Vai trò</th>
                  <th>Tòa nhà phụ trách</th>
                  <th>Số điện thoại</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const roleKey = resolveRole(s.position, s.isAdmin);
                  const roleCfg = roleOptions[roleKey] || { label: s.position || "Staff", tone: "slate" as Tone };
                  const buildingsText =
                    s.buildingIds && s.buildingIds.length > 0
                      ? s.buildingIds.map((id) => `Tòa #${id}`).join(", ")
                      : "Chưa phân công";

                  return (
                    <tr key={s.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <span className="avatar-chip !h-9 !w-9">
                            {(s.fullName || "NV").split(" ").pop()![0]}
                          </span>
                          <div>
                            <b>{s.fullName || "Chưa đặt tên"}</b>
                            <div className="sub">{s.email || "Không có email"}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <Pill tone={roleCfg.tone}>{roleCfg.label}</Pill>
                      </td>
                      <td className="text-[13px]">{buildingsText}</td>
                      <td className="text-[13px] font-mono">{s.phone || "—"}</td>
                      <td>
                        <button className="text-button" onClick={() => openForm(s)}>
                          Sửa <Icon name="chevron" size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </article>

      <Drawer
        open={!!edit}
        eyebrow="Nhân sự"
        title={m ? m.fullName : "Thêm nhân viên"}
        onClose={() => setEdit(null)}
        footer={
          <>
            <button className="secondary-button" disabled={saving} onClick={() => setEdit(null)}>
              Hủy
            </button>
            <button className="primary-button" disabled={saving} onClick={() => void save()}>
              {saving ? "Đang xử lý…" : m ? "Lưu" : "Tạo tài khoản"}
            </button>
          </>
        }
      >
        <div className="form-grid">
          {formError && <div className="span-2 alert alert-error">{formError}</div>}
          <div className="span-2">
            <Field label="Họ tên">
              <input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Nguyễn Văn A"
              />
            </Field>
          </div>
          <Field label="Email">
            <input
              type="email"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              placeholder="nhanvien@nhaminh.vn"
            />
          </Field>
          <Field label="Số điện thoại">
            <input
              value={formPhone}
              onChange={(e) => setFormPhone(e.target.value)}
              placeholder="09xxxxxxxx"
            />
          </Field>
          {edit === "new" && (
            <div className="span-2">
              <Field label="Mật khẩu khởi tạo" hint="Tối thiểu 8 ký tự">
                <input
                  type="password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </Field>
            </div>
          )}
          <div className="span-2">
            <Field label="Vai trò">
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(roleOptions)
                  .filter(([k]) => k !== "ADMIN")
                  .map(([k, v]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setFormRole(k)}
                      className={`rounded-xl border p-3 text-left transition ${
                        formRole === k
                          ? "border-teal bg-[#eef8f4] ring-2 ring-teal/20"
                          : "border-line"
                      }`}
                    >
                      <b className="block text-sm">{v.label}</b>
                      <span className="font-mono text-[10px] text-muted">{k}</span>
                    </button>
                  ))}
              </div>
            </Field>
          </div>
          {m && (
            <div className="span-2">
              <Field
                label="ID các tòa nhà phụ trách"
                hint="Nhập danh sách ID các tòa nhà, phân cách bằng dấu phẩy (vd: 1, 2, 3)"
              >
                <input
                  value={formBuildings}
                  onChange={(e) => setFormBuildings(e.target.value)}
                  placeholder="1, 2, 3"
                />
              </Field>
            </div>
          )}
        </div>
      </Drawer>
      {toast}
    </>
  );
}
