import { useState, type ReactNode } from "react";
import { Navigate, NavLink, useNavigate, useParams } from "react-router";
import { useAuth, type Role } from "../lib/auth";
import { Icon, type IconName } from "../components/ui";
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

type NavItem = { label: string; icon: IconName; badge?: string };
type StaffRole = Exclude<Role, "CUSTOMER">;

/** "Phòng & Tin đăng" → "phong-tin-dang" */
export const slug = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const adminNav: NavItem[] = [
  { label: "Tổng quan", icon: "grid" },
  { label: "Tòa nhà", icon: "building" },
  { label: "Phòng & Tin đăng", icon: "door" },
  { label: "Hợp đồng", icon: "contract" },
  { label: "Tài chính", icon: "wallet" },
  { label: "Bảo trì", icon: "tools", badge: "5" },
  { label: "Tài sản", icon: "grid" },
  { label: "Khách thuê & Ở ghép", icon: "users" },
  { label: "Nhân sự", icon: "shield" },
  { label: "Báo cáo", icon: "chart" },
];

const activities = [
  { initials: "HT", color: "bg-amber-100 text-amber-700", name: "Hoàng Thị Mai", action: "đã thanh toán hóa đơn", detail: "HĐ-0425 · 3.650.000 ₫", time: "10 phút trước" },
  { initials: "KT", color: "bg-sky-100 text-sky-700", name: "Kỹ thuật viên Minh", action: "đã hoàn tất phiếu sửa chữa", detail: "Máy lạnh phòng A.402", time: "42 phút trước" },
  { initials: "NL", color: "bg-violet-100 text-violet-700", name: "Nguyễn Lam", action: "gửi yêu cầu thuê phòng", detail: "Phòng B.305 · The Fern House", time: "1 giờ trước" },
  { initials: "HN", color: "bg-emerald-100 text-emerald-700", name: "Hệ thống", action: "đã tạo tin đăng tự động", detail: "Phòng C.201 chuyển sang sắp trống", time: "2 giờ trước" },
];

const roles: Record<StaffRole, { user: string; initials: string; title: string; scope: string; nav: NavItem[] }> = {
  ADMIN: { user: "Trần Minh Anh", initials: "TA", title: "Quản trị viên", scope: "Toàn hệ thống", nav: adminNav },
  QUAN_LY: { user: "Lê Quốc Bảo", initials: "QB", title: "Quản lý tòa nhà", scope: "The Fern House", nav: [
    { label: "Tổng quan", icon: "grid" }, { label: "Phòng & Tin đăng", icon: "door" }, { label: "Hợp đồng", icon: "contract" },
    { label: "Chốt chỉ số", icon: "wallet" }, { label: "Hóa đơn", icon: "split" }, { label: "Bảo trì", icon: "tools", badge: "3" }, { label: "Tài sản", icon: "grid" }, { label: "Khách thuê & Ở ghép", icon: "users" },
  ] },
  KY_THUAT: { user: "Trần Minh", initials: "TM", title: "Kỹ thuật viên", scope: "Mộc · Fern House", nav: [
    { label: "Việc của tôi", icon: "tools", badge: "3" }, { label: "Bảng bảo trì", icon: "grid" }, { label: "Tài sản", icon: "building" },
  ] },
  SALE: { user: "Đinh Khánh Linh", initials: "KL", title: "Nhân viên kinh doanh", scope: "The Fern House", nav: [
    { label: "Khách tiềm năng", icon: "users" }, { label: "Phòng & Tin đăng", icon: "door" }, { label: "Hợp đồng", icon: "contract" },
  ] },
};

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const { section } = useParams();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  if (!user) return <Navigate to="/dang-nhap" replace />;
  if (user.role === "CUSTOMER") return <Navigate to="/phong-cua-toi" replace />;
  const role = user.role;
  const current = { ...roles[role], user: user.fullName, initials: user.fullName.split(" ").slice(-2).map((w) => w[0]).join(""), scope: user.buildings?.join(" · ") ?? roles[role].scope };
  const navItems = current.nav;
  const item = section ? navItems.find((n) => slug(n.label) === section) : navItems[0];
  if (!item) return <Navigate to="/quan-tri" replace />;
  const activeNav = item.label;
  const setActiveNav = (label: string) => navigate(`/quan-tri/${slug(label)}`);

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
            <NavLink key={item.label} to={`/quan-tri/${slug(item.label)}`} className={`nav-item ${activeNav === item.label ? "nav-active" : ""}`} onClick={() => setMobileOpen(false)}>
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
        <button className="mt-3 flex w-full items-center justify-between text-xs font-semibold text-slate-300" onClick={() => { logout(); navigate("/"); }}>
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
              <button className="icon-button relative" onClick={() => setNotificationsOpen(!notificationsOpen)} aria-label="Thông báo">
                <Icon name="bell" size={19} /><i></i>
              </button>
              {notificationsOpen && (
                <div className="notification-panel">
                  <div className="flex items-center justify-between border-b border-line p-4">
                    <strong>Thông báo</strong><button className="text-xs font-bold text-teal">Đánh dấu đã đọc</button>
                  </div>
                  <div className="p-2">
                    {activities.slice(0, 3).map((a) => <div key={a.detail} className="rounded-xl p-3 text-xs hover:bg-slate-50"><b>{a.name}</b> {a.action}<div className="mt-1 text-muted">{a.time}</div></div>)}
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
