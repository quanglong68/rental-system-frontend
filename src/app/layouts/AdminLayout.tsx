import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { useAuth, type Role } from "@/features/auth";
import { Icon, type IconName } from "@/shared/ui";
import { canAccessAdminSection } from "@/app/router/adminRouteAccess";

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
  QUAN_LY: { title: "Quản lý tòa nhà", scope: "The Fern House", nav: [
    { label: "Tổng quan", path: "overview", icon: "grid" }, { label: "Phòng & Tin đăng", path: "rooms", icon: "door" }, { label: "Hợp đồng", path: "contracts", icon: "contract" },
    { label: "Chốt chỉ số", path: "meter-readings", icon: "wallet" }, { label: "Hóa đơn", path: "invoices", icon: "split" }, { label: "Bảo trì", path: "maintenance", icon: "tools", badge: "3" }, { label: "Tài sản", path: "assets", icon: "grid" }, { label: "Khách thuê & Ở ghép", path: "tenants", icon: "users" },
  ] },
  KY_THUAT: { title: "Kỹ thuật viên", scope: "Mộc · Fern House", nav: [
    { label: "Việc của tôi", path: "my-tasks", icon: "tools", badge: "3" }, { label: "Bảng bảo trì", path: "maintenance-board", icon: "grid" }, { label: "Tài sản", path: "assets", icon: "building" },
  ] },
  SALE: { title: "Nhân viên kinh doanh", scope: "The Fern House", nav: [
    { label: "Khách tiềm năng", path: "leads", icon: "users" }, { label: "Phòng & Tin đăng", path: "rooms", icon: "door" }, { label: "Hợp đồng", path: "contracts", icon: "contract" },
  ] },
};

const activities = [
  { name: "Hoàng Thị Mai", action: "đã thanh toán hóa đơn", time: "10 phút trước" },
  { name: "Kỹ thuật viên Minh", action: "đã hoàn tất phiếu sửa chữa", time: "42 phút trước" },
  { name: "Nguyễn Lam", action: "gửi yêu cầu thuê phòng", time: "1 giờ trước" },
];

export default function AdminLayout() {
  const { user } = useAuth();
  const location = useLocation();
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
  const Sidebar = () => (
    <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
      <div className="flex h-20 items-center justify-between px-6">
        <Link to="/admin" className="flex items-center gap-3 text-lg font-extrabold"><span className="logo-mark"><span></span><span></span><span></span></span>Nhà Mình</Link>
        <button className="icon-button md:hidden" aria-label="Đóng menu" onClick={() => setMobileOpen(false)}>×</button>
      </div>
      <div className="px-5 pb-4"><div className="rounded-xl bg-slate-50 p-3"><b className="block text-sm">{current.title}</b><small className="text-muted">{user.fullName} · {current.scope}</small></div></div>
      <nav className="space-y-1 px-3">
        {navItems.map((item) => (
          <NavLink key={item.path} to={`/admin/${item.path}`} onClick={() => setMobileOpen(false)} className={({ isActive }) => `sidebar-link ${isActive || (!section && item.path === navItems[0].path) ? "active" : ""}`}>
            <Icon name={item.icon} size={18} /><span>{item.label}</span>{item.badge && <i>{item.badge}</i>}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto border-t border-line p-4"><Link to="/" className="sidebar-link">← Về trang khách hàng</Link></div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-[#f5f7f8] text-ink">
      {mobileOpen && <button className="fixed inset-0 z-30 bg-black/30 md:hidden" aria-label="Đóng menu" onClick={() => setMobileOpen(false)} />}
      <Sidebar />
      <main className="min-h-screen md:pl-[248px]">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-line bg-white/95 px-4 backdrop-blur md:px-8">
          <div className="flex items-center gap-3">
            <button className="icon-button md:hidden" aria-label="Mở menu" onClick={() => setMobileOpen(true)}>☰</button>
            <div><div className="text-xs font-semibold text-muted">{new Date().toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", weekday: "long", day: "numeric", month: "long" })}</div><div className="hidden text-lg font-extrabold sm:block">{active.label}</div></div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <label className="search-box"><Icon name="search" size={18} /><input placeholder="Tìm phòng, khách thuê..." /><span>⌘ K</span></label>
            <div className="relative"><button className="icon-button relative" onClick={() => setNotificationsOpen(!notificationsOpen)} aria-label="Thông báo"><Icon name="bell" size={19} /><i></i></button>
              {notificationsOpen && <div className="notification-panel"><div className="border-b border-line p-4"><strong>Thông báo</strong></div><div className="p-2">{activities.map((activity) => <div key={activity.name} className="rounded-xl p-3 text-xs hover:bg-slate-50"><b>{activity.name}</b> {activity.action}<div className="mt-1 text-muted">{activity.time}</div></div>)}</div></div>}
            </div>
            <button className="avatar-button" aria-label={user.fullName}>{initials}</button>
          </div>
        </header>
        <div className="mx-auto max-w-[1500px] px-4 py-7 md:px-8 md:py-9"><Outlet /></div>
      </main>
    </div>
  );
}
