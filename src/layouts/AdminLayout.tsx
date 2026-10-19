import { useState, type ReactNode } from "react";
import { Navigate, NavLink, useLocation, useNavigate, useParams } from "react-router";
import { useAuth, type Role } from "../lib/auth";
import { Icon, toVNTime, type IconName } from "../components/ui";
import { getNotifications, notificationKind, type NotificationItem } from "../api/userNotification";
import { useNotifications } from "../lib/notifications";
import Dashboard from "../screens/admin/Dashboard";
import Buildings from "../screens/admin/Buildings";
import Rooms from "../screens/admin/Rooms";
import Contracts from "../screens/admin/Contracts";
import Finance from "../screens/admin/Finance";
import Maintenance from "../screens/admin/Maintenance";
import Tenants from "../screens/admin/Tenants";
import Staff from "../screens/admin/Staff";
import Reports from "../screens/admin/Reports";
import Assets from "../screens/admin/Assets";
import ManagerHome from "../screens/staff/ManagerHome";
import MeterReading from "../screens/staff/MeterReading";
import TechTasks from "../screens/staff/TechTasks";
import SalePipeline from "../screens/staff/SalePipeline";

type NavItem = { label: string; path: string; icon: IconName; badge?: string };
type StaffRole = Exclude<Role, "CUSTOMER">;

const adminNav: NavItem[] = [
  { label: "Tổng quan", path: "overview", icon: "grid" },
  { label: "Tòa nhà", path: "buildings", icon: "building" },
  { label: "Phòng & Tin đăng", path: "rooms", icon: "door" },
  { label: "Hợp đồng", path: "contracts", icon: "contract" },
  { label: "Tài chính", path: "finance", icon: "wallet" },
  { label: "Bảo trì", path: "maintenance", icon: "tools", badge: "5" },
  { label: "Tài sản", path: "assets", icon: "grid" },
  { label: "Khách thuê & Ở ghép", path: "tenants", icon: "users" },
  { label: "Nhân sự", path: "staff", icon: "shield" },
  { label: "Báo cáo", path: "reports", icon: "chart" },
];

const roles: Record<StaffRole, { user: string; initials: string; title: string; scope: string; nav: NavItem[] }> = {  ADMIN: { user: "Trần Minh Anh", initials: "TA", title: "Quản trị viên", scope: "Toàn hệ thống", nav: adminNav },
  QUAN_LY: { user: "Lê Quốc Bảo", initials: "QB", title: "Quản lý tòa nhà", scope: "The Fern House", nav: [
    { label: "Tổng quan", path: "overview", icon: "grid" }, { label: "Phòng & Tin đăng", path: "rooms", icon: "door" }, { label: "Hợp đồng", path: "contracts", icon: "contract" },
    { label: "Chốt chỉ số", path: "meter-readings", icon: "wallet" }, { label: "Hóa đơn", path: "invoices", icon: "split" }, { label: "Bảo trì", path: "maintenance", icon: "tools", badge: "3" }, { label: "Tài sản", path: "assets", icon: "grid" }, { label: "Khách thuê & Ở ghép", path: "tenants", icon: "users" },
  ] },
  KY_THUAT: { user: "Trần Minh", initials: "TM", title: "Kỹ thuật viên", scope: "Mộc · Fern House", nav: [
    { label: "Việc của tôi", path: "my-tasks", icon: "tools", badge: "3" }, { label: "Bảng bảo trì", path: "maintenance-board", icon: "grid" }, { label: "Tài sản", path: "assets", icon: "building" },
  ] },
  SALE: { user: "Đinh Khánh Linh", initials: "KL", title: "Nhân viên kinh doanh", scope: "The Fern House", nav: [
    { label: "Khách tiềm năng", path: "leads", icon: "users" }, { label: "Phòng & Tin đăng", path: "rooms", icon: "door" }, { label: "Hợp đồng", path: "contracts", icon: "contract" },
  ] },
};

/** Chặn trang quản trị: chưa login → /login kèm next, CUSTOMER → đá ra. */
export function RequireStaff({ children }: { children: ReactNode }) {
  const { user, initializing } = useAuth();
  const loc = useLocation();
  if (initializing) return null;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
  if (user.role === "CUSTOMER") return <Navigate to="/my-room" replace />;
  return <>{children}</>;
}

export default function AdminLayout() {
  const { user, initializing, logout } = useAuth();
  const { section } = useParams();
  const loc = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationItems, setNotificationItems] = useState<NotificationItem[]>([]);
  const [notificationError, setNotificationError] = useState("");
  const { unreadCount, markRead, markAllRead } = useNotifications();
  if (initializing) return null;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
  if (user.role === "CUSTOMER") return <Navigate to="/my-room" replace />;
  const role = user.role;
  const current = { ...roles[role], user: user.fullName, initials: user.fullName.split(" ").slice(-2).map((w) => w[0]).join(""), scope: user.buildings?.join(" · ") ?? roles[role].scope };
  const navItems = current.nav;
  const item = section ? navItems.find((n) => n.path === section) : navItems[0];
  if (!item) return <Navigate to="/admin" replace />;
  const activeNav = item.label;
  const setActiveNav = (label: string) => {
    const target = navItems.find((n) => n.label === label) ?? navItems[0];
    navigate(`/admin/${target.path}`);
  };

  const screens: Record<string, ReactNode> = {
    "Tổng quan": role === "QUAN_LY" ? <ManagerHome onNavigate={setActiveNav} /> : <Dashboard onNavigate={setActiveNav} />,
    "Chốt chỉ số": <MeterReading />,
    "Hóa đơn": <Finance />,
    "Việc của tôi": <TechTasks />,
    "Bảng bảo trì": <Maintenance />,
    "Khách tiềm năng": <SalePipeline />,
    "Tòa nhà": <Buildings />,
    "Phòng & Tin đăng": <Rooms />,
    "Hợp đồng": <Contracts />,
    "Tài chính": <Finance />,
    "Bảo trì": <Maintenance />,
    "Khách thuê & Ở ghép": <Tenants />,
    "Nhân sự": <Staff />,
    "Báo cáo": <Reports />,
    "Tài sản": <Assets />,
  };
  const screen = screens[activeNav];

  const toggleNotifications = () => {
    const opening = !notificationsOpen;
    setNotificationsOpen(opening);
    if (!opening) return;
    setNotificationError("");
    void getNotifications(0, false, 5)
      .then((page) => setNotificationItems(page.content))
      .catch(() => setNotificationError("Không tải được thông báo. Vui lòng thử lại."));
  };

  const Sidebar = () => (
    <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
      <div className="flex h-20 items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="logo-mark"><span></span><span></span><span></span></div>
          <div>
            <div className="text-[17px] font-extrabold tracking-tight text-white">NHÀ MÌNH</div>
            <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-slate-400">Property Management</div>
          </div>
        </div>
        <button className="icon-button-dark lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Đóng menu"><Icon name="close" /></button>
      </div>
      <nav className="mt-5 flex-1 px-3">
        <div className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{current.scope}</div>
        <div className="space-y-1">
          {navItems.map((item) => (
            <NavLink key={item.path} to={`/admin/${item.path}`} className={`nav-item ${activeNav === item.label ? "nav-active" : ""}`} onClick={() => setMobileOpen(false)}>
              <Icon name={item.icon} size={19} />
              <span>{item.label}</span>
              {item.badge && <span className="ml-auto rounded-full bg-coral px-2 py-0.5 text-[10px] font-bold text-white">{item.badge}</span>}
            </NavLink>
          ))}
        </div>
      </nav>
      <div className="m-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-lime text-xs font-extrabold text-navy">{current.initials}</div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-white">{current.user}</div>
            <div className="text-[11px] text-slate-400">{current.title} · {role}</div>
          </div>
          <Icon name="more" size={17} />
        </div>
        <div className="h-px bg-white/10"></div>
        <button className="mt-3 flex w-full items-center justify-between text-xs font-semibold text-slate-300" onClick={() => { void logout().finally(() => navigate("/")); }}>
          Đăng xuất <Icon name="arrow" size={14} />
        </button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <Sidebar />
      {mobileOpen && <button className="fixed inset-0 z-30 bg-navy/50 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Đóng lớp phủ"></button>}

      <main className="lg:ml-[248px]">
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-line bg-canvas/95 px-4 backdrop-blur md:px-8">
          <div className="flex items-center gap-3">
            <button className="icon-button lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Mở menu"><Icon name="menu" /></button>
            <div>
              <div className="text-xs font-semibold text-muted">{new Date().toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", weekday: "long", day: "numeric", month: "long" })}</div>
              <div className="hidden text-lg font-extrabold sm:block">{activeNav}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <label className="search-box">
              <Icon name="search" size={18} />
              <input placeholder="Tìm phòng, khách thuê..." />
              <span>⌘ K</span>
            </label>
            <div className="relative">
              <button className="icon-button relative" onClick={toggleNotifications} aria-label="Thông báo">
                <Icon name="bell" size={19} />{unreadCount > 0 && <i></i>}
              </button>
              {notificationsOpen && (
                <div className="notification-panel">
                  <div className="flex items-center justify-between border-b border-line p-4">
                    <strong>Thông báo · {unreadCount} chưa đọc</strong><button className="text-xs font-bold text-teal disabled:opacity-40" disabled={!unreadCount} onClick={() => void markAllRead().then(() => setNotificationItems((items) => items.map((item) => ({ ...item, isRead: true })))).catch(() => setNotificationError("Không thể cập nhật thông báo. Vui lòng thử lại."))}>Đánh dấu đã đọc</button>
                  </div>
                  <div className="p-2">
                    {notificationError && <p className="p-3 text-xs text-[#a63e28]">{notificationError}</p>}
                    {!notificationError && notificationItems.length === 0 && <p className="p-3 text-xs text-muted">Chưa có thông báo.</p>}
                    {notificationItems.map((item) => <button key={item.id} type="button" className={`w-full rounded-xl p-3 text-left text-xs hover:bg-slate-50 ${item.isRead ? "opacity-65" : ""}`} onClick={() => {
                      if (!item.isRead) void markRead(item.id)
                        .then(() => setNotificationItems((items) => items.map((value) => value.id === item.id ? { ...value, isRead: true } : value)))
                        .catch(() => setNotificationError("Không thể cập nhật thông báo. Vui lòng thử lại."));
                    }}><b className="block">{item.title}</b><span>{item.content}</span><div className="mt-1 text-muted">{notificationKind(item.type)} · {toVNTime(item.createdAt, true)}</div></button>)}
                  </div>
                </div>
              )}
            </div>
            <button className="avatar-button">{current.initials}</button>
          </div>
        </header>

        <div className="mx-auto max-w-[1500px] px-4 py-7 md:px-8 md:py-9">
          {screen}
        </div>
      </main>
    </div>
  );
}
