import { RouterProvider } from "react-router";
import { AuthProvider } from "./lib/auth";
import { NotificationProvider } from "./lib/notifications";
import { router } from "./routes";

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <RouterProvider router={router} />
      </NotificationProvider>
    </AuthProvider>
  );
}
