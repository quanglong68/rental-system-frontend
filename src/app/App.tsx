import { Suspense } from "react";
import { RouterProvider } from "react-router";
import { router } from "@/app/router/router";
import { AppProviders } from "@/app/providers/AppProviders";

export default function App() {
  return (
    <AppProviders>
      <Suspense fallback={<div className="grid min-h-[60vh] place-items-center text-sm text-slate-500">Đang tải trang…</div>}>
        <RouterProvider router={router} />
      </Suspense>
    </AppProviders>
  );
}
