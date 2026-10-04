# Báo cáo restructure Frontend (phần A)

Ngày: 2026-10-04. Nguyên tắc: chỉ di chuyển + đổi đường import, giữ nguyên logic
(AIRule minimal-diff). Verify: `npx tsc --noEmit` exit 0, `npm run build` PASS.

## 1. Gom screen admin phẳng → `src/screens/admin/`

| Trước | Sau |
|---|---|
| `src/screens/Assets.tsx` | `src/screens/admin/Assets.tsx` |
| `src/screens/Buildings.tsx` | `src/screens/admin/Buildings.tsx` |
| `src/screens/Contracts.tsx` | `src/screens/admin/Contracts.tsx` |
| `src/screens/Dashboard.tsx` | `src/screens/admin/Dashboard.tsx` |
| `src/screens/Finance.tsx` | `src/screens/admin/Finance.tsx` |
| `src/screens/Maintenance.tsx` | `src/screens/admin/Maintenance.tsx` |
| `src/screens/Reports.tsx` | `src/screens/admin/Reports.tsx` |
| `src/screens/Rooms.tsx` | `src/screens/admin/Rooms.tsx` |
| `src/screens/Staff.tsx` | `src/screens/admin/Staff.tsx` |
| `src/screens/Tenants.tsx` | `src/screens/admin/Tenants.tsx` |

Import trong 10 file này: `from "../ui"` → `from "../../components/ui"`,
`from "../lib/*"` → `from "../../lib/*"`.
`src/layouts/AdminLayout.tsx`: 10 import screen → `../screens/admin/*`,
`from "../ui"` → `from "../components/ui"`.

## 2. Layouts về chung một chỗ

- `src/screens/customer/CustomerApp.tsx` → `src/layouts/CustomerLayout.tsx`
  (cạnh `AdminLayout.tsx`; `RequireCustomer` giữ nguyên export).
- Import trong file: `../../ui` → `../components/ui`, `./notifications` → `../mocks/notifications`,
  `../../lib/auth` → `../lib/auth`, `./customer.css` → `../screens/customer/customer.css`.
- `src/routes.tsx`: `./screens/customer/CustomerApp` → `./layouts/CustomerLayout`.

## 3. Tách `src/ui.tsx` (xóa file gốc) → `src/components/ui/` + `src/lib/format.ts`

- `src/components/ui/Icon.tsx` — `IconName` + `Icon` (nguyên văn).
- `src/components/ui/primitives.tsx` — `Tone`, `Pill`, `PageHead`, `Tabs`, `MiniStat`,
  `Toolbar`, `Drawer`, `Field`, `useToast`, `Switch` (nguyên văn).
- `src/components/ui/index.ts` — barrel re-export cả hai + `vnd`, `toVNTime` từ lib,
  nên mọi chỗ dùng chỉ đổi đường dẫn, không đổi tên import.
- `src/lib/format.ts` (mới) — `vnd`, `toVNTime` (nguyên văn).
- ~25 file đổi `from "../ui"` / `from "../../ui"` → đường dẫn `components/ui` tương ứng
  (`screens/admin/*`, `screens/customer/*`, `screens/staff/*`, `screens/auth/*`,
  `layouts/*`, `mocks/notifications.tsx`).

## 4. Gom mock → `src/mocks/`

| Trước | Sau | Ai dùng |
|---|---|---|
| `src/screens/customer/data.ts` | `src/mocks/data.ts` | `Explore.tsx` |
| `src/screens/customer/bookings.ts` | `src/mocks/bookings.ts` | `Explore.tsx`, `Requests.tsx` |
| `src/screens/customer/notifications.tsx` | `src/mocks/notifications.tsx` | `CustomerLayout`, `Roommates`, `Requests`, `Profile` |
| (mới tách từ `lib/auth.tsx`) | `src/mocks/demoAccounts.ts` | `lib/auth.tsx`, `AuthPages.tsx` |

`src/lib/auth.tsx`: `demoAccounts`/`DEMO_PASSWORD` chuyển sang import từ
`../mocks/demoAccounts` (logic login/register mock giữ nguyên, chờ Task 7 thay API thật).
`src/screens/auth/AuthPages.tsx`: tách import demo sang `../../mocks/demoAccounts`.

## 5. Cấu trúc sau cùng

```
src/
  main.tsx  App.tsx  routes.tsx  index.css  vite-env.d.ts
  components/ui/  (Icon.tsx, primitives.tsx, index.ts)
  layouts/        (AdminLayout.tsx, CustomerLayout.tsx)
  screens/
    admin/        (10 màn hình quản trị)
    staff/        (ManagerHome, MeterReading, SalePipeline, TechTasks)
    customer/     (Explore, MyHome, MyHomeExtras, Repairs, Requests, Roommates, Profile + customer.css)
    auth/         (AuthPages.tsx + auth.css)
  lib/            (auth.tsx, format.ts, geo.ts, split.ts)
  mocks/          (data.ts, bookings.ts, notifications.tsx, demoAccounts.ts)
```

## 6. Sự cố trong lúc làm

- Lệnh `mkdir` nhầm tạo `screens/`, `components/`, `mocks/` ở root repo thay vì trong
  `src/` → đã xóa, tạo lại đúng chỗ rồi mới `git mv`.
- `CLAUDE.md` bị xóa khỏi disk (không phải do thao tác của session) → đã
  `git restore --staged --worktree CLAUDE.md`, kiểm tra tồn tại lại.
- `git mv` giữ rename (`R`/`RM` trong `git status`), history không mất.
