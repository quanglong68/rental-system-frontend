import { useCallback, useEffect, useState } from "react";
import { Drawer, Field, Icon, MiniStat, PageHead, Pill, Tabs, Toolbar, useToast, type Tone } from "@/shared/ui";
import { apiFetch } from "@/shared/api/httpClient";
import {
  getStaff,
  updateStaff,
  replaceStaffBuildings,
  type PageResponse,
  type UserProfile,
} from "@/api/userNotification";
import { hasAnyRole, useAuth } from "@/features/auth";
import { propertyApi } from "@/features/properties/api/propertyApi";
import { useBuildingLookup } from "@/shared/lib/refLabels";

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

const ROLE_PRIORITY = ["ADMIN", "QUAN_LY", "KY_THUAT", "SALE"];

type AccountSummary = { accountId: number | string; roles: string[] };

/** Hồ sơ staff do user-notification tạo bất đồng bộ từ event AccountRegistered. */
async function waitForStaffProfile(id: number | string, attempts = 15, delayMs = 300): Promise<boolean> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const first = await getStaff(0, 100);
      const totalPages = first.totalPages || 1;
      const batches = totalPages > 1 ? [first, await getStaff(totalPages - 1, 100)] : [first];
      if (batches.some((page) => page.content.some((s) => String(s.id) === String(id)))) return true;
    } catch {
      // Lỗi tạm thời khi service vừa khởi động — thử lại.
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return false;
}

export default function Staff() {
  const { user } = useAuth();
  const isAdmin = hasAnyRole(user, ["ADMIN"]);
  const [tab, setTab] = useState("Tất cả");
  const [staffList, setStaffList] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [buildingOptions, setBuildingOptions] = useState<{ id: string; name: string }[]>([]);
  const [accountRoles, setAccountRoles] = useState<Record<string, string[]>>({});

  const buildingOf = useBuildingLookup(staffList.flatMap((s) => s.buildingIds ?? []));

  const roleKeyOf = (s: UserProfile) => {
    const roles = accountRoles[String(s.id)] ?? [];
    return ROLE_PRIORITY.find((r) => roles.includes(r)) ?? resolveRole(s.position, s.isAdmin);
  };

  const [edit, setEdit] = useState<UserProfile | "new" | null>(null);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState("SALE");
  const [formBuildings, setFormBuildings] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [toast, show] = useToast();

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getStaff(0, 100);
      setStaffList(res.content || []);
      if (isAdmin) {
        // Role thật nằm ở auth-service; hồ sơ user-notification chỉ có position hiển thị.
        try {
          const [staffAccounts, adminAccounts] = await Promise.all([
            apiFetch<PageResponse<AccountSummary>>("/api/v1/auth/accounts?accountType=STAFF&page=0&size=100"),
            apiFetch<PageResponse<AccountSummary>>("/api/v1/auth/accounts?accountType=ADMIN&page=0&size=100"),
          ]);
          const rolesById: Record<string, string[]> = {};
          for (const account of [...staffAccounts.content, ...adminAccounts.content]) {
            rolesById[String(account.accountId)] = account.roles || [];
          }
          setAccountRoles(rolesById);
        } catch {
          setAccountRoles({});
        }
      }
    } catch {
      setError("Không thể tải danh sách nhân sự từ máy chủ.");
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    propertyApi
      .buildings(0, 100, "", "", "")
      .then((res) => {
        if (!cancelled) {
          setBuildingOptions(res.content.map((b) => ({ id: String(b.buildingId), name: b.name })));
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const openForm = (x: UserProfile | "new") => {
    if (!isAdmin) return;
    setEdit(x);
    setFormError("");
    if (x === "new") {
      setFormName("");
      setFormEmail("");
      setFormPhone("");
      setFormPassword("");
      setFormRole("SALE");
      setFormBuildings([]);
    } else {
      setFormName(x.fullName || "");
      setFormEmail(x.email || "");
      setFormPhone(x.phone || "");
      setFormPassword("");
      setFormRole(roleKeyOf(x));
      setFormBuildings((x.buildingIds || []).map(String));
    }
  };

  const save = async () => {
    setFormError("");
    if (!formName.trim()) {
      setFormError("Vui lòng nhập họ tên.");
      return;
    }
    const buildingIdList = formBuildings;

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
        const created = await apiFetch<{ accountId: number | string }>("/api/v1/auth/accounts", {
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

        // Hồ sơ staff được user-notification tạo sau khi nhận event AccountRegistered.
        const profileReady = await waitForStaffProfile(created.accountId);
        if (!profileReady) {
          show("Đã tạo tài khoản nhân viên. Hồ sơ chưa kịp đồng bộ, vui lòng tải lại trang sau ít phút.");
          setEdit(null);
          await loadData();
          return;
        }

        try {
          await updateStaff(created.accountId, {
            fullName: formName.trim(),
            phone: formPhone.trim() || null,
            email: formEmail.trim() || null,
            position: formRole,
          });
          await replaceStaffBuildings(created.accountId, buildingIdList);
          show("Đã tạo tài khoản nhân viên.");
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Lỗi đồng bộ hồ sơ nhân viên";
          show(`Đã tạo tài khoản nhưng chưa lưu được hồ sơ/phân công: ${msg}. Mở "Sửa" để cập nhật lại.`);
        }
        setEdit(null);
        await loadData();
      } else if (edit) {
        const currentRole = roleKeyOf(edit);
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
    const roleKey = roleKeyOf(s);
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
    staffList.filter((s) => roleKeyOf(s) === r).length;

  const m = edit && edit !== "new" ? edit : null;

  return (
    <>
      <PageHead
        eyebrow={isAdmin ? "ADMIN · Toàn hệ thống" : "Nhân sự · Theo phân công"}
        title="Nhân sự"
        desc={
          isAdmin
            ? "Quản lý nhân sự, vai trò QUAN_LY / KY_THUAT / SALE và phân công theo tòa nhà từ dữ liệu thực tế."
            : "Danh sách nhân sự trong phạm vi tòa nhà bạn phụ trách. Chỉ quản trị viên mới được thêm hoặc sửa hồ sơ."
        }
        actions={
          isAdmin ? (
            <button className="primary-button" onClick={() => openForm("new")}>
              <Icon name="plus" size={16} /> Thêm nhân viên
            </button>
          ) : undefined
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
                  const roleKey = roleKeyOf(s);
                  const roleCfg = roleOptions[roleKey] || { label: s.position || "Staff", tone: "slate" as Tone };
                  const buildingsText =
                    s.buildingIds && s.buildingIds.length > 0
                      ? s.buildingIds.map((id) => buildingOf(id) ?? `Tòa #${id}`).join(", ")
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
                        {isAdmin && (
                          <button className="text-button" onClick={() => openForm(s)}>
                            Sửa <Icon name="chevron" size={12} />
                          </button>
                        )}
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
        open={isAdmin && !!edit}
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
              {m?.isAdmin ? (
                <div className="rounded-xl border border-line p-3 text-sm text-muted">
                  Tài khoản quản trị (ADMIN) — vai trò do auth-service quản lý, không đổi tại đây.
                </div>
              ) : (
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
              )}
            </Field>
          </div>
          {(m || edit === "new") && (
            <div className="span-2">
              <Field
                label="Tòa nhà phụ trách"
                hint={
                  buildingOptions.length > 0
                    ? "Chọn các tòa nhà nhân sự phụ trách."
                    : "Chưa tải được danh sách tòa nhà — nhập ID cách nhau bằng dấu phẩy (vd: 1, 2, 3)."
                }
              >
                {buildingOptions.length > 0 ? (
                  <div className="grid max-h-56 gap-1 overflow-y-auto rounded-xl border border-line p-2">
                    {buildingOptions.map((b) => (
                      <label key={b.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={formBuildings.includes(b.id)}
                          onChange={(e) =>
                            setFormBuildings((prev) =>
                              e.target.checked ? [...prev, b.id] : prev.filter((id) => id !== b.id),
                            )
                          }
                        />
                        {b.name}
                      </label>
                    ))}
                  </div>
                ) : (
                  <input
                    value={formBuildings.join(", ")}
                    onChange={(e) => setFormBuildings(e.target.value.split(/[,;\s]+/).filter(Boolean))}
                    placeholder="1, 2, 3"
                  />
                )}
              </Field>
            </div>
          )}
        </div>
      </Drawer>
      {toast}
    </>
  );
}
