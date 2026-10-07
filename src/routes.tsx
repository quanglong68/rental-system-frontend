import { createBrowserRouter, Link, Navigate } from "react-router";
import CustomerLayout, { RequireCustomer } from "./layouts/CustomerLayout";
import Explore from "./screens/customer/Explore";
import MyHome from "./screens/customer/MyHome";
import Repairs from "./screens/customer/Repairs";
import Roommates from "./screens/customer/Roommates";
import Profile from "./screens/customer/Profile";
import Requests from "./screens/customer/Requests";
import { Login, Register } from "./screens/auth/AuthPages";
import AdminLayout, { RequireStaff } from "./layouts/AdminLayout";

function NotFound() {
  return (
    <div className="grid min-h-[70vh] place-items-center text-center">
      <div><div className="cx-serif text-[96px] leading-none">404</div><p className="text-[#6b777d]">Trang bạn tìm không tồn tại.</p><Link to="/" className="cx-btn mt-4">Về trang chủ</Link></div>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: CustomerLayout,
    children: [
      { index: true, Component: Explore },
      { path: "login", Component: Login },
      { path: "register", Component: Register },
      { path: "my-room", element: <RequireCustomer><MyHome /></RequireCustomer> },
      { path: "repairs", element: <RequireCustomer><Repairs /></RequireCustomer> },
      { path: "roommates", element: <RequireCustomer><Roommates /></RequireCustomer> },
      { path: "profile", element: <RequireCustomer><Profile /></RequireCustomer> },
      { path: "requests", element: <RequireCustomer><Requests /></RequireCustomer> },
      // Redirect URL tiếng Việt cũ → mới (giữ bookmark/deeplink không gãy).
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
  { path: "/admin", element: <RequireStaff><AdminLayout /></RequireStaff> },
  { path: "/admin/:section", element: <RequireStaff><AdminLayout /></RequireStaff> },
  { path: "/quan-tri", element: <Navigate to="/admin" replace /> },
  { path: "/quan-tri/:section", element: <Navigate to="/admin" replace /> },
]);
