import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLocation } from "react-router";
import { toVNTime } from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { getMyProfile, getNotifications, notificationKind, updateMyProfile, type NotificationItem } from "../../api/userNotification";
import { useNotifications } from "../../lib/notifications";
import { useCxToast } from "../../mocks/notifications";

const ease = [0.22, 1, 0.36, 1] as const;

export default function Profile() {
  const { user, updateFullName } = useAuth();
  const loc = useLocation();
  const [toast, show] = useCxToast();
  const { unreadCount, markRead, markAllRead } = useNotifications();
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [pw, setPw] = useState({ cur: "", next: "", again: "" });
  const [pwErr, setPwErr] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [notificationsError, setNotificationsError] = useState("");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getMyProfile()
      .then((result) => {
        if (!active) return;
        setForm({ name: result.fullName ?? "", phone: result.phone ?? "", email: result.email ?? "" });
      })
      .catch(() => { if (active) setLoadError("Không tải được hồ sơ. Vui lòng tải lại trang."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setNotificationsLoading(true);
    setNotificationsError("");
    getNotifications(page, unreadOnly)
      .then((result) => {
        if (!active) return;
        setNotifications((current) => page === 0 ? result.content : [...current, ...result.content]);
        setTotalPages(result.totalPages);
      })
      .catch(() => { if (active) setNotificationsError("Không tải được thông báo. Vui lòng thử lại."); })
      .finally(() => { if (active) setNotificationsLoading(false); });
    return () => { active = false; };
  }, [page, unreadOnly]);

  useEffect(() => { if (loc.hash === "#notifications") document.getElementById("notifications")?.scrollIntoView({ behavior: "smooth" }); }, [loc.hash]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });
  const save = async () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Vui lòng nhập họ tên.";
    if (form.phone.length > 32) e.phone = "Số điện thoại không được vượt quá 32 ký tự.";
    if (form.email && (!/^\S+@\S+\.\S+$/.test(form.email) || form.email.length > 320)) e.email = "Email không hợp lệ.";
    setErrs(e);
    setSaveError("");
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      const updated = await updateMyProfile({ fullName: form.name.trim(), phone: form.phone.trim() || null, email: form.email.trim() || null });
      setForm({ name: updated.fullName ?? "", phone: updated.phone ?? "", email: updated.email ?? "" });
      updateFullName(updated.fullName ?? form.name.trim());
      show("Đã lưu hồ sơ của bạn");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Không lưu được hồ sơ. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  };
  const changePw = () => {
    if (!pw.cur) return setPwErr("Vui lòng nhập mật khẩu hiện tại.");
    if (pw.next.length < 8) return setPwErr("Mật khẩu mới phải có ít nhất 8 ký tự.");
    if (pw.next !== pw.again) return setPwErr("Mật khẩu nhập lại không khớp.");
    setPwErr(""); setPw({ cur: "", next: "", again: "" }); show("Đã đổi mật khẩu");
  };
  const initials = form.name.split(" ").filter(Boolean).slice(-2).map((w) => w[0]).join("");

  const input = (k: keyof typeof form, label: string, type = "text", full = false) => (
    <label className={`cx-field ${full ? "full" : ""}`}>
      {label}
      <input className={`cx-input ${errs[k] ? "bad" : ""}`} type={type} value={form[k]} onChange={set(k)} />
      {errs[k] && <span className="cx-err">{errs[k]}</span>}
    </label>
  );

  return (
    <section className="cx-section !pt-32">
      <div className="cx-eyebrow">Tài khoản · {user?.sub}</div>
      <h1 className="cx-serif cx-h2">Hồ sơ <em>của bạn</em>.</h1>
      {loadError && <p className="cx-err mb-4">{loadError}</p>}
      <div className="cx-two">
        <div className="cx-stack">
          <motion.article className="cx-panel" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }}>
            <h3 className="cx-panel-title">Thông tin cá nhân</h3>
            <div className="mb-6 flex items-center gap-4">
              <div className="cx-avatar-lg">{initials}</div>
              <div><b className="block">{form.name || "Chưa có tên"}</b><button className="cx-link !p-0 text-sm underline" onClick={() => show("Tải ảnh đại diện sẽ có sớm")}>Đổi ảnh đại diện</button></div>
            </div>
            {loading ? <p className="text-sm text-[#6b777d]">Đang tải hồ sơ…</p> : <div className="cx-form">
              {input("name", "Họ và tên", "text", true)}
              {input("phone", "Số điện thoại", "tel")}
              {input("email", "Email", "email")}
            </div>}
            {saveError && <p className="cx-err mt-3">{saveError}</p>}
            <motion.button className="cx-btn mt-6 w-full disabled:opacity-50" whileTap={{ scale: 0.97 }} onClick={() => void save()} disabled={loading || saving}>{saving ? "Đang lưu…" : "Lưu thay đổi"}</motion.button>
          </motion.article>

          <motion.article className="cx-panel" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1, ease }}>
            <h3 className="cx-panel-title">Đổi mật khẩu</h3>
            <div className="cx-form">
              <label className="cx-field full">Mật khẩu hiện tại<input className="cx-input" type="password" value={pw.cur} onChange={(e) => setPw({ ...pw, cur: e.target.value })} /></label>
              <label className="cx-field">Mật khẩu mới<input className="cx-input" type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} placeholder="Ít nhất 8 ký tự" /></label>
              <label className="cx-field">Nhập lại<input className="cx-input" type="password" value={pw.again} onChange={(e) => setPw({ ...pw, again: e.target.value })} /></label>
            </div>
            {pwErr && <p className="cx-err mt-3">{pwErr}</p>}
            <button className="cx-btn ghost mt-5 w-full" onClick={changePw}>Cập nhật mật khẩu</button>
          </motion.article>
        </div>

        <motion.article id="notifications" className="cx-panel scroll-mt-28" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15, ease }}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="cx-panel-title !m-0">Thông báo · {unreadCount} chưa đọc</h3>
            <button className="cx-link !p-0 text-sm underline disabled:opacity-40" disabled={!unreadCount} onClick={() => void markAllRead().then(() => {
              setNotifications((items) => items.map((item) => ({ ...item, isRead: true })));
              if (unreadOnly) { setPage(0); setNotifications([]); setTotalPages(0); }
            }).catch(() => setNotificationsError("Không thể cập nhật thông báo. Vui lòng thử lại."))}>Đánh dấu đã đọc tất cả</button>
          </div>
          <div className="cx-chips mb-3">
            {[{ label: "Tất cả", value: false }, { label: "Chưa đọc", value: true }].map((option) => <button key={option.label} className={`cx-chip ${unreadOnly === option.value ? "on" : ""}`} onClick={() => {
              if (unreadOnly === option.value) return;
              setUnreadOnly(option.value); setPage(0); setNotifications([]);
            }}>{option.label}</button>)}
          </div>
          <AnimatePresence initial={false} mode="popLayout">
            {notifications.map((n) => (
              <motion.button type="button" key={n.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`cx-noti w-full text-left ${n.isRead ? "read" : ""}`} onClick={() => {
                if (!n.isRead) void markRead(n.id).then(() => {
                  setNotifications((items) => unreadOnly ? items.filter((item) => item.id !== n.id) : items.map((item) => item.id === n.id ? { ...item, isRead: true } : item));
                }).catch(() => setNotificationsError("Không thể cập nhật thông báo. Vui lòng thử lại."));
              }}>
                <span className="dot" />
                <span className="flex-1">
                  <b className="block">{n.title}</b>
                  <span className="block text-[13px] text-[#56636a]">{n.content}</span>
                  <small className="cx-meta">{notificationKind(n.type)} · {toVNTime(n.createdAt, true)}</small>
                </span>
              </motion.button>
            ))}
          </AnimatePresence>
          {notificationsLoading && <p className="py-3 text-sm text-[#6b777d]">Đang tải thông báo…</p>}
          {notificationsError && <p className="cx-err py-3">{notificationsError}</p>}
          {!notificationsLoading && !notificationsError && notifications.length === 0 && <p className="text-sm text-[#6b777d]">Không có thông báo nào.</p>}
          {!notificationsLoading && page + 1 < totalPages && <button className="cx-link mt-3 text-sm underline" onClick={() => setPage((current) => current + 1)}>Tải thêm thông báo</button>}
        </motion.article>
      </div>
      {toast}
    </section>
  );
}
