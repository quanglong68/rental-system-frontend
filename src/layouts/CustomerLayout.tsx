import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router";
import { Icon, toVNTime } from "../components/ui";
import { getNotifications, notificationKind, type NotificationItem } from "../api/userNotification";
import { homeFor, useAuth } from "../lib/auth";
import { useNotifications } from "../lib/notifications";
import "../screens/customer/customer.css";

const publicTabs = [{ to: "/", label: "Khám phá", icon: "search" as const }];
const memberTabs = [
  ...publicTabs,
  { to: "/my-room", label: "Phòng của tôi", icon: "home" as const },
  { to: "/requests", label: "Lịch hẹn", icon: "calendar" as const },
  { to: "/repairs", label: "Sửa chữa", icon: "tools" as const },
  { to: "/roommates", label: "Ở ghép", icon: "users" as const },
];

/** Chặn trang chỉ dành cho CUSTOMER đã đăng nhập */
export function RequireCustomer({ children }: { children: React.ReactNode }) {
  const { user, initializing } = useAuth();
  const loc = useLocation();
  if (initializing) return null;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
  if (user.role !== "CUSTOMER") return <Navigate to={homeFor(user.role)} replace />;
  return <>{children}</>;
}

export default function CustomerLayout() {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [bell, setBell] = useState(false);
  const [bellItems, setBellItems] = useState<NotificationItem[]>([]);
  const [bellLoading, setBellLoading] = useState(false);
  const [bellError, setBellError] = useState("");
  const { unreadCount, markRead } = useNotifications();
  const isCustomer = user?.role === "CUSTOMER";
  const tabs = isCustomer ? memberTabs : publicTabs;
  const initials = user ? user.fullName.split(" ").slice(-2).map((w) => w[0]).join("") : "";
  const authPage = loc.pathname === "/login" || loc.pathname === "/register";

  const toggleBell = () => {
    const opening = !bell;
    setBell(opening);
    setMenu(false);
    if (!opening) return;
    setBellLoading(true);
    setBellError("");
    void getNotifications(0, false, 5)
      .then((page) => setBellItems(page.content))
      .catch(() => setBellError("Không tải được thông báo. Vui lòng thử lại."))
      .finally(() => setBellLoading(false));
  };

  return (
    <div className="cx">
      {!authPage && (
        <motion.header className="cx-nav" initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
          <Link to="/" className="cx-brand">
            <span className="logo-mark !h-8 !w-8"><span></span><span></span><span></span></span>
            <span>Nhà Mình</span>
          </Link>
          <nav className="cx-tabs">
            {tabs.map((t) => (
              <NavLink key={t.to} to={t.to} end className={({ isActive }) => (isActive ? "on" : "")}>
                {({ isActive }) => (<>
                  {isActive && <motion.span layoutId="cx-pill" className="cx-pill" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                  <span className="relative">{t.label}</span>
                </>)}
              </NavLink>
            ))}
          </nav>
          {user ? (
            <div className="relative flex items-center gap-2">
              {isCustomer && <button className="cx-icon" aria-label="Thông báo" onClick={toggleBell}><Icon name="bell" size={18} />{unreadCount > 0 && <i />}</button>}
              <button className="cx-avatar" onClick={() => { setMenu(!menu); setBell(false); }}>{initials}</button>
              <AnimatePresence>
                {bell && (
                  <motion.div className="cx-dropdown" initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.97 }}>
                    <div className="flex items-center justify-between py-1"><b className="text-sm">Thông báo</b><span className="cx-meta">{unreadCount} chưa đọc</span></div>
                    {bellLoading && <p className="py-4 text-center text-sm text-[#6b777d]">Đang tải thông báo…</p>}
                    {bellError && <p className="py-3 text-sm text-[#a63e28]">{bellError}</p>}
                    {!bellLoading && !bellError && bellItems.length === 0 && <p className="py-4 text-center text-sm text-[#6b777d]">Chưa có thông báo.</p>}
                    {bellItems.map((n) => (
                      <button key={n.id} type="button" className={`cx-noti w-full text-left ${n.isRead ? "read" : ""}`} onClick={() => {
                        if (!n.isRead) void markRead(n.id)
                          .then(() => setBellItems((items) => items.map((item) => item.id === n.id ? { ...item, isRead: true } : item)))
                          .catch(() => setBellError("Không thể cập nhật thông báo. Vui lòng thử lại."));
                      }}>
                        <span className="dot" />
                        <span className="flex-1"><b className="block text-[13px]">{n.title}</b><small className="cx-meta">{notificationKind(n.type)} · {toVNTime(n.createdAt, true)}</small></span>
                      </button>
                    ))}
                    <Link to="/profile#notifications" className="cx-btn ghost !mt-2 !h-10 w-full" onClick={() => setBell(false)}>Xem tất cả thông báo</Link>
                  </motion.div>
                )}
              </AnimatePresence>
              <AnimatePresence>
                {menu && (
                  <motion.div className="cx-menu" initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.97 }}>
                    <div className="px-3 py-2"><b className="block text-sm">{user.fullName}</b><span className="cx-meta">{user.sub} · {user.role}</span></div>
                    {isCustomer && <Link to="/profile" onClick={() => setMenu(false)}>Hồ sơ</Link>}
                    {!isCustomer && <button onClick={() => { setMenu(false); navigate(homeFor(user.role)); }}>Vào trang quản trị</button>}
                    <button onClick={() => { setMenu(false); void logout().finally(() => navigate("/")); }}>Đăng xuất</button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login" className="cx-link">Đăng nhập</Link>
              <Link to="/register" className="cx-btn !h-10 !rounded-xl !px-4">Đăng ký</Link>
            </div>
          )}
        </motion.header>
      )}

      <AnimatePresence mode="wait">
        <motion.main key={loc.pathname} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}>
          <Outlet />
        </motion.main>
      </AnimatePresence>

      {!authPage && isCustomer && (
        <nav className="cx-bottom">
          {tabs.map((t) => (
            <NavLink key={t.to} to={t.to} end className={({ isActive }) => (isActive ? "on" : "")}>
              <Icon name={t.icon} size={20} /><span>{t.label}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
