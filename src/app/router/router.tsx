import { lazy } from "react";
import { createBrowserRouter, Link, Navigate, useNavigate } from "react-router";
import { RequireAdminSection, RequireRole } from "@/app/guards/RequireRole";
import AdminLayout from "@/app/layouts/AdminLayout";
import CustomerLayout from "@/app/layouts/CustomerLayout";
import { useAuth } from "@/features/auth";

const Explore = lazy(() => import("@/features/listings/ui/Explore"));
const MyHome = lazy(() => import("@/features/tenant-home/ui/MyHome"));
const Repairs = lazy(() => import("@/features/maintenance/ui/Repairs"));
const Roommates = lazy(() => import("@/features/roommates/ui/Roommates"));
const Profile = lazy(() => import("@/features/tenant-home/ui/Profile"));
const Requests = lazy(() => import("@/features/bookings/ui/Requests"));
const Buildings = lazy(() => import("@/features/properties/ui/BuildingManagement"));
const BuildingRoomsPage = lazy(() => import("@/features/properties/ui/BuildingRoomsPage"));
const RoomDetailPage = lazy(() => import("@/features/properties/ui/RoomDetailPage"));
const Rooms = lazy(() => import("@/features/properties/ui/Rooms"));
const Contracts = lazy(() => import("@/features/contracts/ui/Contracts"));
const Finance = lazy(() => import("@/features/finance/ui/Finance"));
const Maintenance = lazy(() => import("@/features/maintenance/ui/Maintenance"));
const Tenants = lazy(() => import("@/features/people/ui/Tenants"));
const Staff = lazy(() => import("@/features/people/ui/Staff"));
const Reports = lazy(() => import("@/features/reporting/ui/Reports"));
const Assets = lazy(() => import("@/features/properties/ui/Assets"));
const MeterReading = lazy(() => import("@/features/finance/ui/MeterReading"));
const TechTasks = lazy(() => import("@/features/maintenance/ui/TechTasks"));
const SalePipeline = lazy(() => import("@/features/sales/ui/SalePipeline"));
const Dashboard = lazy(() => import("@/features/dashboard/ui/Dashboard"));
const ManagerHome = lazy(() => import("@/features/dashboard/ui/ManagerHome"));
const Login = lazy(() => import("@/features/auth/ui/AuthPages").then((module) => ({ default: module.Login })));
const Register = lazy(() => import("@/features/auth/ui/AuthPages").then((module) => ({ default: module.Register })));

const allStaff = ["ADMIN", "QUAN_LY", "KY_THUAT", "SALE"] as const;
function NotFound() {
  return <div className="grid min-h-[70vh] place-items-center text-center"><div><div className="cx-serif text-[96px] leading-none">404</div><p className="text-[#6b777d]">Trang bạn tìm không tồn tại.</p><Link to="/" className="cx-btn mt-4">Về trang chủ</Link></div></div>;
}

function AdminIndex() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const onNavigate = (label: string) => navigate(`/admin/${destinations[label] ?? "overview"}`);
  if (!user || user.role === "UNKNOWN" || user.role === "CUSTOMER") return <Navigate to="/" replace />;
  if (user.role === "QUAN_LY") return <ManagerHome onNavigate={onNavigate} />;
  if (user.role === "KY_THUAT") return <TechTasks />;
  if (user.role === "SALE") return <SalePipeline />;
  return <Dashboard onNavigate={onNavigate} />;
}

const destinations: Record<string, string> = {
  "Tổng quan": "overview", "Tòa nhà": "buildings", "Phòng & Tin đăng": "rooms", "Hợp đồng": "contracts",
  "Tài chính": "finance", "Bảo trì": "maintenance", "Tài sản": "assets", "Khách thuê & Ở ghép": "tenants",
  "Nhân sự": "staff", "Báo cáo": "reports", "Chốt chỉ số": "meter-readings", "Hóa đơn": "invoices",
  "Việc của tôi": "my-tasks", "Bảng bảo trì": "maintenance-board", "Khách tiềm năng": "leads",
};

function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const onNavigate = (label: string) => navigate(`/admin/${destinations[label] ?? "overview"}`);
  return user?.role === "QUAN_LY" ? <ManagerHome onNavigate={onNavigate} /> : <Dashboard onNavigate={onNavigate} />;
}

export const router = createBrowserRouter([
  {
    path: "/", Component: CustomerLayout,
    children: [
      { index: true, element: <Explore /> },
      { path: "login", element: <Login /> },
      { path: "register", element: <Register /> },
      { path: "my-room", element: <RequireRole roles={["CUSTOMER"]}><MyHome /></RequireRole> },
      { path: "repairs", element: <RequireRole roles={["CUSTOMER"]}><Repairs /></RequireRole> },
      { path: "roommates", element: <RequireRole roles={["CUSTOMER"]}><Roommates /></RequireRole> },
      { path: "profile", element: <RequireRole roles={["CUSTOMER"]}><Profile /></RequireRole> },
      { path: "requests", element: <RequireRole roles={["CUSTOMER"]}><Requests /></RequireRole> },
      { path: "dang-nhap", element: <Navigate to="/login" replace /> },
      { path: "dang-ky", element: <Navigate to="/register" replace /> },
      { path: "phong-cua-toi", element: <Navigate to="/my-room" replace /> },
      { path: "sua-chua", element: <Navigate to="/repairs" replace /> },
      { path: "o-ghep", element: <Navigate to="/roommates" replace /> },
      { path: "ho-so", element: <Navigate to="/profile" replace /> },
      { path: "lich-hen", element: <Navigate to="/requests" replace /> },
      { path: "*", Component: NotFound },
    ],
  },
  {
    path: "/admin", element: <RequireRole roles={allStaff}><AdminLayout /></RequireRole>,
    children: [
      { index: true, element: <AdminIndex /> },
      { path: "overview", element: <RequireAdminSection section="overview"><DashboardPage /></RequireAdminSection> },
      { path: "buildings", element: <RequireAdminSection section="buildings"><Buildings /></RequireAdminSection> },
      { path: "buildings/:buildingId", element: <RequireAdminSection section="buildings"><BuildingRoomsPage /></RequireAdminSection> },
      { path: "buildings/:buildingId/rooms", element: <RequireAdminSection section="buildings"><BuildingRoomsPage /></RequireAdminSection> },
      { path: "buildings/:buildingId/rooms/:roomId", element: <RequireAdminSection section="buildings"><RoomDetailPage /></RequireAdminSection> },
      { path: "rooms", element: <RequireAdminSection section="rooms"><Rooms /></RequireAdminSection> },
      { path: "contracts", element: <RequireAdminSection section="contracts"><Contracts /></RequireAdminSection> },
      { path: "finance", element: <RequireAdminSection section="finance"><Finance /></RequireAdminSection> },
      { path: "maintenance", element: <RequireAdminSection section="maintenance"><Maintenance /></RequireAdminSection> },
      { path: "assets", element: <RequireAdminSection section="assets"><Assets /></RequireAdminSection> },
      { path: "tenants", element: <RequireAdminSection section="tenants"><Tenants /></RequireAdminSection> },
      { path: "staff", element: <RequireAdminSection section="staff"><Staff /></RequireAdminSection> },
      { path: "reports", element: <RequireAdminSection section="reports"><Reports /></RequireAdminSection> },
      { path: "meter-readings", element: <RequireAdminSection section="meter-readings"><MeterReading /></RequireAdminSection> },
      { path: "invoices", element: <RequireAdminSection section="invoices"><Finance /></RequireAdminSection> },
      { path: "my-tasks", element: <RequireAdminSection section="my-tasks"><TechTasks /></RequireAdminSection> },
      { path: "maintenance-board", element: <RequireAdminSection section="maintenance-board"><Maintenance /></RequireAdminSection> },
      { path: "leads", element: <RequireAdminSection section="leads"><SalePipeline /></RequireAdminSection> },
      { path: "*", element: <Navigate to="/admin" replace /> },
    ],
  },
  { path: "/quan-tri", element: <Navigate to="/admin" replace /> },
  { path: "/quan-tri/:section", element: <Navigate to="/admin" replace /> },
]);
