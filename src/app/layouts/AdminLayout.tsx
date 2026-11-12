import { useCallback, useEffect, useState } from "react";
import type { Id } from "@/shared/lib/id";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { useAuth, type Role } from "@/features/auth";
import {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  notificationAdminTarget,
  type NotificationItem,
} from "@/api/userNotification";
import { Icon, toVNTime, type IconName } from "@/shared/ui";
import { canAccessAdminSection } from "@/app/router/adminRouteAccess";
import { propertyApi } from "@/features/properties/api/propertyApi";
import { getMyProfile } from "@/api/userNotification";
import { useChatRealtime } from "@/features/chat";
import ChatDock from "@/features/chat/ui/ChatDock";
import "./admin.css";

type StaffRole = Exclude<Role, "CUSTOMER" | "UNKNOWN">;
type NavItem = { label: string; path: string; icon: IconName; badge?: string };

const adminNav: NavItem[] = [
  { label: "Tổng quan", path: "overview", icon: "grid" },
  { label: "Tin nhắn", path: "messages", icon: "chat" },
  { label: "Tòa nhà", path: "buildings", icon: "building" },
  { label: "Phòng & Tin đăng", path: "rooms", icon: "door" },
  { label: "Hợp đồng", path: "contracts", icon: "contract" },
  { label: "Hóa đơn", path: "invoices", icon: "wallet" },
  { label: "Chốt chỉ số", path: "meter-readings", icon: "calendar" },
  { label: "Bảo trì", path: "maintenance", icon: "tools" },
  { label: "Khách thuê & Ở ghép", path: "tenants", icon: "users" },
  { label: "Yêu cầu", path: "leads", icon: "calendar" },
  { label: "Nhân sự", path: "staff", icon: "shield" },
];

// Trang nghiệp vụ có route nhưng không nằm trong menu của một số vai trò.
const sectionTitles: Record<string, string> = {
  "meter-readings": "Chốt chỉ số",
  notifications: "Thông báo",
};

const roles: Record<StaffRole, { title: string; nav: NavItem[] }> = {
  ADMIN: { title: "Quản trị viên", nav: adminNav },
  QUAN_LY: {
    title: "Quản lý tòa nhà", nav: [
      { label: "Tổng quan", path: "overview", icon: "grid" }, { label: "Tin nhắn", path: "messages", icon: "chat" }, { label: "Phòng & Tin đăng", path: "rooms", icon: "door" }, { label: "Hợp đồng", path: "contracts", icon: "contract" },
      { label: "Chốt chỉ số", path: "meter-readings", icon: "wallet" }, { label: "Hóa đơn", path: "invoices", icon: "split" }, { label: "Bảo trì", path: "maintenance", icon: "tools" }, { label: "Khách thuê & Ở ghép", path: "tenants", icon: "users" }, { label: "Yêu cầu", path: "leads", icon: "calendar" }, { label: "Nhân sự", path: "staff", icon: "shield" },
    ]
  },
  KY_THUAT: {
    title: "Kỹ thuật viên", nav: [
      { label: "Việc của tôi", path: "my-tasks", icon: "tools" }, { label: "Bảng bảo trì", path: "maintenance-board", icon: "grid" },
      { label: "Chốt chỉ số", path: "meter-readings", icon: "wallet" }, { label: "Tin nhắn", path: "messages", icon: "chat" }, { label: "Nhân sự", path: "staff", icon: "shield" },
    ]
  },
  SALE: {
    title: "Nhân viên kinh doanh", nav: [
      { label: "Yêu cầu", path: "leads", icon: "calendar" }, { label: "Tin nhắn", path: "messages", icon: "chat" }, { label: "Phòng & Tin đăng", path: "rooms", icon: "door" }, { label: "Hợp đồng", path: "contracts", icon: "contract" },
      { label: "Nhân sự", path: "staff", icon: "shield" },
    ]
  },
};

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const { unreadCount: chatUnread } = useChatRealtime();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notis, setNotis] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [scopeLabel, setScopeLabel] = useState("");
  const [query, setQuery] = useState("");

  const fetchNotis = useCallback(async () => {
    if (!user) return;
    try {
      const [res, count] = await Promise.all([
        getNotifications(0, false, 6),
        getUnreadCount(),
      ]);
      setNotis(res.content || []);
      setUnread(count);
    } catch {
      // background poll error ignored
    }
  }, [user]);

  useEffect(() => {
    void fetchNotis();
  }, [fetchNotis]);

  // Trang Thông báo đánh dấu đã đọc ở nơi khác; đồng bộ lại chuông trên header.
  useEffect(() => {
    const onUpdated = () => void fetchNotis();
    window.addEventListener("notifications:updated", onUpdated);
    return () => window.removeEventListener("notifications:updated", onUpdated);
  }, [fetchNotis]);

  // Phạm vi tòa nhà hiển thị theo phân công thật, không dùng tên cố định.
  useEffect(() => {
    if (!user) return;
    if (user.roles.includes("ADMIN")) {
      setScopeLabel("Toàn hệ thống");
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const ids = (await getMyProfile()).buildingIds ?? [];
        if (ids.length === 0) {
          if (!cancelled) setScopeLabel("Chưa được phân công tòa nhà");
          return;
        }
        const result = await propertyApi.buildings(0, 100, "", "", "");
        const names = new Map(result.content.map((b) => [String(b.buildingId), b.name]));
        if (!cancelled) {
          setScopeLabel(ids.map((id) => names.get(String(id)) ?? `Tòa #${id}`).join(" · "));
        }
      } catch {
        if (!cancelled) setScopeLabel("");
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const handleMarkRead = async (id: Id) => {
    try {
      await markNotificationRead(id);
      setNotis((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      setUnread((c) => Math.max(0, c - 1));
    } catch {
      // ignored
    }
  };

  const handleNotificationClick = async (n: NotificationItem) => {
    if (!n.isRead) {
      await handleMarkRead(n.id);
    }
    const target = notificationAdminTarget(n);
    if (target) {
      setNotificationsOpen(false);
      navigate(target);
    }
  };

  if (!user || user.role === "CUSTOMER" || user.role === "UNKNOWN") return null;
  const role = user.role as StaffRole;
  const current = roles[role];
  const staffRoles = user.roles.filter((item): item is StaffRole => item in roles);
  const navByPath = new Map<string, NavItem>();
  for (const staffRole of staffRoles) {
    for (const item of roles[staffRole].nav) {
      if (!navByPath.has(item.path)) navByPath.set(item.path, item);
    }
  }
  const navItems = [...navByPath.values()]
    .filter((item) => canAccessAdminSection(user.roles, item.path))
    .map((item) =>
      item.path === "messages" && chatUnread > 0
        ? { ...item, badge: chatUnread > 99 ? "99+" : String(chatUnread) }
        : item,
    );
  const needle = query.trim().toLocaleLowerCase("vi");
  const searchResults = needle
    ? navItems.filter((item) => item.label.toLocaleLowerCase("vi").includes(needle))
    : [];
  const pathParts = location.pathname.split("/").filter(Boolean);
  const section = pathParts.length > 1 ? pathParts[1] : undefined;
  const activeSection = section === "buildings" && !user.roles.includes("ADMIN") ? "rooms" : section;
  const active = navItems.find((item) => item.path === activeSection)
    ?? (activeSection && sectionTitles[activeSection]
      ? { label: sectionTitles[activeSection], path: activeSection, icon: "bell" as IconName }
      : navItems[0]);
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
        <div className="admin-nav-scope">{scopeLabel || current.title}</div>
        {navItems.map((item) => (
          <NavLink key={item.path} to={`/admin/${item.path}`} end className={({ isActive }) => `admin-nav-item ${isActive || item.path === active.path ? "admin-nav-active" : ""}`} onClick={() => setMobileOpen(false)}>
            <Icon name={item.icon} size={19} /><span>{item.label}</span>{item.badge && <i>{item.badge}</i>}
          </NavLink>
        ))}
      </nav>
      <div className="admin-account">
        <div className="admin-account-info">
          <span className="admin-avatar admin-avatar-sidebar">{initials}</span>
          <span className="admin-account-copy"><strong>{user.fullName}</strong><small>{current.title} · {role}</small></span>
        </div>
        <button className="admin-logout" onClick={async () => { await logout(); navigate("/"); }}>Đăng xuất <Icon name="arrow" size={14} /></button>
      </div>
      </aside>
      <main className="admin-main">
        <header className="admin-header">
          <div className="admin-heading">
            <button className="admin-icon-button admin-mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Mở menu"><Icon name="menu" /></button>
            <div><div className="admin-date">{new Date().toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", weekday: "long", day: "numeric", month: "long" })}</div><div className="admin-page-title">{active.label}</div></div>
          </div>
          <div className="admin-header-actions">
            <div className="admin-search" style={{ position: "relative" }}>
              <Icon name="search" size={18} />
              <input
                className="min-w-0 flex-1 border-0 bg-transparent text-xs outline-none"
                placeholder="Tìm mục quản trị…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && searchResults[0]) {
                    navigate(`/admin/${searchResults[0].path}`);
                    setQuery("");
                  }
                  if (e.key === "Escape") setQuery("");
                }}
                onBlur={() => window.setTimeout(() => setQuery(""), 150)}
                aria-label="Tìm mục quản trị"
              />
              {needle && (
                <div className="absolute left-0 right-0 top-[44px] z-50 overflow-hidden rounded-xl border border-line bg-white shadow-lg">
                  {searchResults.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-muted">Không có mục phù hợp.</div>
                  ) : (
                    searchResults.map((item) => (
                      <button
                        key={item.path}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-surface/60"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { navigate(`/admin/${item.path}`); setQuery(""); }}
                      >
                        <Icon name={item.icon} size={15} /> {item.label}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <div className="admin-notifications">
              <button
                className="admin-icon-button admin-bell"
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                aria-label="Thông báo"
                aria-expanded={notificationsOpen}
              >
                <Icon name="bell" size={19} />
                {unread > 0 && <i />}
              </button>
              {notificationsOpen && (
                <div className="admin-notification-panel">
                  <div className="flex items-center justify-between border-b pb-2 mb-2">
                    <strong>Thông báo</strong>
                    <span className="text-xs text-muted">{unread} chưa đọc</span>
                  </div>
                  {notis.length === 0 ? (
                    <div className="py-4 text-center text-xs text-muted">Không có thông báo mới.</div>
                  ) : (
                    notis.map((n) => (
                      <div
                        key={n.id}
                        className={`cursor-pointer border-b border-line px-1 py-2.5 transition-colors hover:bg-slate-50 last:border-b-0 ${n.isRead ? "opacity-60" : "font-semibold"}`}
                        onClick={() => void handleNotificationClick(n)}
                      >
                        <div className="text-[13px] leading-5">{n.title}</div>
                        <div className="mt-0.5 text-xs leading-5 text-muted line-clamp-2">{n.content}</div>
                        <small className="mt-1 block text-[11px] text-muted">{toVNTime(n.createdAt, true)}</small>
                      </div>
                    ))
                  )}
                  <button
                    className="mt-2 w-full border-t border-line pt-2 text-center text-xs font-semibold text-teal"
                    onClick={() => { setNotificationsOpen(false); navigate("/admin/notifications"); }}
                  >
                    Xem tất cả thông báo
                  </button>
                </div>
              )}
            </div>
            <span className="admin-avatar admin-avatar-header" aria-label={user.fullName}>{initials}</span>
          </div>
        </header>
        <div className="admin-content"><Outlet /></div>
      </main>
      <ChatDock />
    </div>
  );
}
