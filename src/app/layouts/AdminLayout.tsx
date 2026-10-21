import { useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { useAuth, type Role } from "@/features/auth";
import { adminMockNotifications } from "@/features/notifications";
import { Icon, type IconName } from "@/shared/ui";
import { canAccessAdminSection } from "@/app/router/adminRouteAccess";
import "./admin.css";

type StaffRole = Exclude<Role, "CUSTOMER" | "UNKNOWN">;
type NavItem = { label: string; path: string; icon: IconName; badge?: string };

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

const roles: Record<StaffRole, { title: string; scope: string; nav: NavItem[] }> = {
  ADMIN: { title: "Quản trị viên", scope: "Toàn hệ thống", nav: adminNav },
  QUAN_LY: {
    title: "Quản lý tòa nhà", scope: "The Fern House", nav: [
      { label: "Tổng quan", path: "overview", icon: "grid" }, { label: "Phòng & Tin đăng", path: "rooms", icon: "door" }, { label: "Hợp đồng", path: "contracts", icon: "contract" },
      { label: "Chốt chỉ số", path: "meter-readings", icon: "wallet" }, { label: "Hóa đơn", path: "invoices", icon: "split" }, { label: "Bảo trì", path: "maintenance", icon: "tools", badge: "3" }, { label: "Tài sản", path: "assets", icon: "grid" }, { label: "Khách thuê & Ở ghép", path: "tenants", icon: "users" },
    ]
  },
  KY_THUAT: {
    title: "Kỹ thuật viên", scope: "Mộc · Fern House", nav: [
      { label: "Việc của tôi", path: "my-tasks", icon: "tools", badge: "3" }, { label: "Bảng bảo trì", path: "maintenance-board", icon: "grid" }, { label: "Tài sản", path: "assets", icon: "building" },
    ]
  },
  SALE: {
    title: "Nhân viên kinh doanh", scope: "The Fern House", nav: [
      { label: "Khách tiềm năng", path: "leads", icon: "users" }, { label: "Phòng & Tin đăng", path: "rooms", icon: "door" }, { label: "Hợp đồng", path: "contracts", icon: "contract" },
    ]
  },
};

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  if (!user || user.role === "CUSTOMER" || user.role === "UNKNOWN") return null;
  const role = user.role;
  const current = roles[role];
  const navItems = current.nav.filter((item) => canAccessAdminSection(role, item.path));
  const pathParts = location.pathname.split("/").filter(Boolean);
  const section = pathParts.length > 1 ? pathParts[1] : undefined;
  const active = navItems.find((item) => item.path === section) ?? navItems[0];
  const initials = user.fullName.split(" ").slice(-2).map((word) => word[0]).join("");

  return (
    <div className="admin-shell">
      {mobileOpen && <button className="admin-overlay" aria-label="Đóng menu" onClick={() => setMobileOpen(false)} />}
      <aside className={`admin-sidebar ${mobileOpen ? "admin-sidebar-open" : ""}`}>
      <div className="admin-brand-row">
        <Link to="/admin" className="admin-brand">
          <span className="admin-logo-mark"><span></span><span></span><span></span></span>
          <span><strong>NHÀ MÌNH</strong><small>PROPERTY MANAGEMENT</small></span>
        </Link>
        <button className="admin-icon-button admin-mobile-close" onClick={() => setMobileOpen(false)} aria-label="Đóng menu"><Icon name="close" /></button>
      </div>
      <nav className="admin-nav">
        {/* <div className="admin-nav-scope">{user.buildings?.join(" · ") || current.scope}</div> */}
        {navItems.map((item) => (
          <NavLink key={item.path} to={`/admin/${item.path}`} end className={({ isActive }) => `admin-nav-item ${isActive || (!section && item.path === navItems[0].path) ? "admin-nav-active" : ""}`} onClick={() => setMobileOpen(false)}>
            <Icon name={item.icon} size={19} /><span>{item.label}</span>{item.badge && <i>{item.badge}</i>}
          </NavLink>
        ))}
      </nav>
      {/* <div className="admin-account">
        <div className="admin-account-info"><span className="admin-avatar admin-avatar-sidebar">{initials}</span><span className="admin-account-copy"><strong>{user.fullName}</strong><small>{current.title} · {role}</small></span></div>
        <button className="admin-logout" onClick={async () => { await logout(); navigate("/"); }}>Đăng xuất <Icon name="arrow" size={14} /></button>
      </div> */}
      </aside>
      <main className="admin-main">
        <header className="admin-header">
          <div className="admin-heading">
            <button className="admin-icon-button admin-mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Mở menu"><Icon name="menu" /></button>
            <div><div className="admin-date">{new Date().toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", weekday: "long", day: "numeric", month: "long" })}</div><div className="admin-page-title">{active.label}</div></div>
          </div>
          <div className="admin-header-actions">
            <div className="admin-search" aria-label="Tìm kiếm đang được phát triển"><Icon name="search" size={18} /><span>Tìm kiếm đang phát triển</span></div>
            <div className="admin-notifications"><button className="admin-icon-button admin-bell" onClick={() => setNotificationsOpen(!notificationsOpen)} aria-label="Thông báo mẫu" aria-expanded={notificationsOpen}><Icon name="bell" size={19} /><i /></button>
              {notificationsOpen && <div className="admin-notification-panel"><strong>Thông báo <small>Dữ liệu mẫu</small></strong>{adminMockNotifications.map((activity) => <div key={activity.name}><b>{activity.name}</b> {activity.action}<small>{activity.time}</small></div>)}</div>}
            </div>
            <span className="admin-avatar admin-avatar-header" aria-label={user.fullName}>{initials}</span>
          </div>
        </header>
        <div className="admin-content"><Outlet /></div>
      </main>
    </div>
  );
}
