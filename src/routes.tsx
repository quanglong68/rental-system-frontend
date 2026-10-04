import { createBrowserRouter, Link } from "react-router";
import CustomerLayout, { RequireCustomer } from "./layouts/CustomerLayout";
import Explore from "./screens/customer/Explore";
import MyHome from "./screens/customer/MyHome";
import Repairs from "./screens/customer/Repairs";
import Roommates from "./screens/customer/Roommates";
import Profile from "./screens/customer/Profile";
import Requests from "./screens/customer/Requests";
import { Login, Register } from "./screens/auth/AuthPages";
import AdminLayout from "./layouts/AdminLayout";

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
      { path: "dang-nhap", Component: Login },
      { path: "dang-ky", Component: Register },
      { path: "phong-cua-toi", element: <RequireCustomer><MyHome /></RequireCustomer> },
      { path: "sua-chua", element: <RequireCustomer><Repairs /></RequireCustomer> },
      { path: "o-ghep", element: <RequireCustomer><Roommates /></RequireCustomer> },
      { path: "ho-so", element: <RequireCustomer><Profile /></RequireCustomer> },
      { path: "lich-hen", element: <RequireCustomer><Requests /></RequireCustomer> },
      { path: "*", Component: NotFound },
    ],
  },
  { path: "/quan-tri", Component: AdminLayout },
  { path: "/quan-tri/:section", Component: AdminLayout },
]);
