import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLocation } from "react-router";
import { toVNTime } from "@/shared/ui";
import { useAuth } from "@/features/auth";
import { useCxToast } from "@/features/notifications";
import {
  getMyProfile,
  updateMyProfile,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  notificationKind,
  type NotificationItem,
} from "@/api/userNotification";

const filters = ["Tất cả", "Hóa đơn", "Lịch hẹn", "Sửa chữa", "Ở ghép", "Hợp đồng", "Hệ thống"] as const;
const ease = [0.22, 1, 0.36, 1] as const;

export default function Profile() {
  const { user, updateFullName } = useAuth();
  const loc = useLocation();
  const [toast, show] = useCxToast();

  const [form, setForm] = useState({
    name: user?.fullName ?? "",
    phone: "",
    email: "",
    position: "",
  });
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileErr, setProfileErr] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});

  const [filter, setFilter] = useState<(typeof filters)[number]>("Tất cả");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loadingNotis, setLoadingNotis] = useState(true);
  const [notisErr, setNotisErr] = useState("");

  const loadProfileData = useCallback(async () => {
    setLoadingProfile(true);
    setProfileErr("");
    try {
      const data = await getMyProfile();
      setForm({
        name: data.fullName ?? "",
        phone: data.phone ?? "",
        email: data.email ?? "",
        position: data.position ?? "",
      });
    } catch {
      setProfileErr("Không tải được thông tin cá nhân từ máy chủ.");
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  const loadNotificationData = useCallback(async () => {
    setLoadingNotis(true);
    setNotisErr("");
    try {
      const res = await getNotifications(0, false, 50);
      setNotifications(res.content || []);
    } catch {
      setNotisErr("Không tải được danh sách thông báo.");
    } finally {
      setLoadingNotis(false);
    }
  }, []);

  useEffect(() => {
    void loadProfileData();
    void loadNotificationData();
  }, [loadProfileData, loadNotificationData]);

  useEffect(() => {
    if (loc.hash === "#notifications") {
      document.getElementById("notifications")?.scrollIntoView({ behavior: "smooth" });
    }
  }, [loc.hash]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const save = async () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Vui lòng nhập họ tên.";
    if (form.phone && !/^0\d{9}$/.test(form.phone)) {
      e.phone = "Số điện thoại gồm 10 chữ số, bắt đầu bằng 0.";
    }
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) {
      e.email = "Email không hợp lệ.";
    }
    setErrs(e);
    if (Object.keys(e).length > 0) return;

    setSavingProfile(true);
    try {
      const updated = await updateMyProfile({
        fullName: form.name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
      });
      updateFullName(updated.fullName);
      show("Đã lưu hồ sơ của bạn");
    } catch {
      show("Lưu hồ sơ thất bại. Vui lòng thử lại.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleMarkRead = async (id: number) => {
    try {
      await markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch {
      // Ignored
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      show("Đã đánh dấu đã đọc tất cả");
    } catch {
      show("Không thể cập nhật trạng thái thông báo.");
    }
  };

  const initials =
    form.name
      .split(" ")
      .filter(Boolean)
      .slice(-2)
      .map((w) => w[0])
      .join("") || "NM";

  const shown = notifications.filter(
    (n) => filter === "Tất cả" || notificationKind(n.type) === filter
  );
  const unread = notifications.filter((n) => !n.isRead).length;

  const input = (k: keyof typeof form, label: string, type = "text", full = false) => (
    <label className={`cx-field ${full ? "full" : ""}`}>
      {label}
      <input
        className={`cx-input ${errs[k] ? "bad" : ""}`}
        type={type}
        value={form[k]}
        onChange={set(k)}
      />
      {errs[k] && <span className="cx-err">{errs[k]}</span>}
    </label>
  );

  return (
    <section className="cx-section !pt-32">
      <div className="cx-eyebrow">Tài khoản · {user?.sub}</div>
      <h1 className="cx-serif cx-h2">
        Hồ sơ <em>của bạn</em>.
      </h1>
      <div className="cx-two">
        <div className="cx-stack">
          <motion.article
            className="cx-panel"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease }}
          >
            <h3 className="cx-panel-title">Thông tin cá nhân</h3>
            {loadingProfile ? (
              <p className="text-sm text-muted">Đang tải thông tin hồ sơ…</p>
            ) : profileErr ? (
              <div className="alert alert-error mb-4">
                {profileErr}
                <button className="text-button ml-2" onClick={() => void loadProfileData()}>
                  Thử lại
                </button>
              </div>
            ) : (
              <>
                <div className="mb-6 flex items-center gap-4">
                  <div className="cx-avatar-lg">{initials}</div>
                  <div>
                    <b className="block">{form.name || "Chưa có tên"}</b>
                    {form.position && <small className="text-xs text-muted">{form.position}</small>}
                  </div>
                </div>
                <div className="cx-form">
                  {input("name", "Họ và tên", "text", true)}
                  {input("phone", "Số điện thoại", "tel")}
                  {input("email", "Email", "email")}
                </div>
                <motion.button
                  className="cx-btn mt-6 w-full"
                  whileTap={{ scale: 0.97 }}
                  disabled={savingProfile}
                  onClick={() => void save()}
                >
                  {savingProfile ? "Đang lưu…" : "Lưu thay đổi"}
                </motion.button>
              </>
            )}
          </motion.article>

          <motion.article
            className="cx-panel"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease }}
          >
            <h3 className="cx-panel-title">Bảo mật tài khoản</h3>
            <p className="text-[13px] leading-6 text-muted">
              Mật khẩu và thông tin xác thực do hệ thống xác thực (auth-service) quản lý an toàn.
              Liên hệ quản trị viên hoặc sử dụng quy trình cấp lại mật khẩu khi cần thiết.
            </p>
          </motion.article>
        </div>

        <motion.article
          id="notifications"
          className="cx-panel scroll-mt-28"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease }}
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="cx-panel-title !m-0">Thông báo · {unread} chưa đọc</h3>
            <button
              className="cx-link !p-0 text-sm underline disabled:opacity-40"
              disabled={!unread}
              onClick={() => void handleMarkAllRead()}
            >
              Đánh dấu đã đọc tất cả
            </button>
          </div>
          <div className="cx-chips mb-3">
            {filters.map((f) => (
              <button
                key={f}
                className={`cx-chip ${filter === f ? "on" : ""}`}
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>

          {loadingNotis ? (
            <p className="text-sm text-muted">Đang tải thông báo…</p>
          ) : notisErr ? (
            <div className="alert alert-error">
              {notisErr}
              <button className="text-button ml-2" onClick={() => void loadNotificationData()}>
                Thử lại
              </button>
            </div>
          ) : (
            <AnimatePresence initial={false} mode="popLayout">
              {shown.map((n) => (
                <motion.div
                  key={n.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`cx-noti ${n.isRead ? "read" : ""}`}
                  onClick={() => {
                    if (!n.isRead) void handleMarkRead(n.id);
                  }}
                >
                  <span className="dot" />
                  <span className="flex-1">
                    <b className="block">{n.title}</b>
                    <span className="block text-[13px] text-[#56636a]">{n.content}</span>
                    <small className="cx-meta">
                      {notificationKind(n.type)} · {toVNTime(n.createdAt, true)}
                    </small>
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
          {!loadingNotis && shown.length === 0 && !notisErr && (
            <p className="text-sm text-[#6b777d]">Không có thông báo nào.</p>
          )}
        </motion.article>
      </div>
      {toast}
    </section>
  );
}
