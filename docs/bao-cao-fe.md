# Báo cáo rà soát file dư thừa Frontend + kết quả test

Ngày: 2026-10-04. Phạm vi: `rental-system-frontend/src` (41 file) + file gốc repo.
Căn cứ: đặc tả `rental-system-backend/docs/Đặc tả Hệ thống Microservices – Quản lý Cho thuê Phòng.docx`
(mục 1 vai trò CUSTOMER/QUAN_LY/KY_THUAT/SALE/ADMIN, mục 4.2 gateway/auth), `AIRule.md`
(search-trước-tạo-mới, plan-first, minimal-diff, secrets-qua-env, hỏi-trước-khi-thêm-dependency),
`AGENTS.md` (gốc + frontend). Lưu ý: không tìm thấy file `plan-infra-auth-team` trong repo
(chỉ có 1 comment nhắc tên trong `backend/pom.xml:14`) nên đối chiếu dựa trên đặc tả + AIRule + code hiện tại.

## 1. Phương pháp

- Quét import toàn `src` (grep `from` + lazy import) đối chiếu từng file với `routes.tsx`, `layouts/AdminLayout.tsx`.
- Chạy verification: `npm run build` (vite build) và `npx tsc --noEmit`.
- Kiểm tra trạng thái git (`git status --short`) để phát hiện file untracked/dư.

## 2. Kết quả audit từng nhóm file

| Nhóm | File | Kết luận |
|---|---|---|
| Entrypoint | `main.tsx`, `App.tsx`, `routes.tsx`, `index.css`, `vite-env.d.ts`, `ui.tsx` | GIỮ — entry + shared UI primitives (`Icon`, `PageHead`, `Drawer`...) được import ở mọi screen |
| Customer (route `/`, `/dang-nhap`, `/dang-ky`, `/phong-cua-toi`, `/sua-chua`, `/o-ghep`, `/ho-so`, `/lich-hen`) | `CustomerApp.tsx`, `Explore.tsx`, `MyHome.tsx`, `Repairs.tsx`, `Roommates.tsx`, `Profile.tsx`, `Requests.tsx`, `auth/AuthPages.tsx` | GIỮ — tất cả có trong `routes.tsx` |
| Customer support | `data.ts` (dùng bởi `Explore`), `bookings.ts` (dùng bởi `Explore`, `Requests`), `notifications.tsx` (dùng bởi `Roommates`, `Requests`, `Profile`, `CustomerApp`), `Room3D.tsx` (lazy trong `Explore`), `MyHomeExtras.tsx` (dùng bởi `MyHome`), `customer.css` (import trong `CustomerApp`), `auth.css` (import trong `AuthPages`) | GIỮ — còn được tham chiếu trực tiếp |
| Admin (`/quan-tri`, `/quan-tri/:section`) | `Dashboard`, `Buildings`, `Rooms`, `Contracts`, `Finance`, `Maintenance`, `Tenants`, `Staff`, `Reports`, `Assets`, `staff/ManagerHome`, `staff/MeterReading`, `staff/TechTasks`, `staff/SalePipeline` | GIỮ — tất cả có trong map `screens` của `AdminLayout.tsx` |
| Lib | `lib/auth.tsx` (dùng bởi `App`, `AdminLayout`, `AuthPages`, `CustomerApp`, `Explore`, `Profile`), `lib/split.ts` (dùng bởi `Contracts`, `Finance`, `MyHome`), `lib/geo.ts` (dùng bởi `Explore`) | GIỮ |
| Config gốc | `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.mise.toml`, `.gitignore`, `AGENTS.md`, `CLAUDE.md`, `.figma/make/site.json` (import trong `vite.config.ts`) | GIỮ |
| Lockfile dư | `package-lock.json` | XÓA — file untracked (`git status` hiện `??`), sinh ra do chạy `npm` trong khi toolchain chuẩn theo `.mise.toml` là pnpm + `pnpm-lock.yaml`. Hai lockfile song song gây lệch dependency |
| Artifact | `dist/` | Không đụng — đã nằm trong `.gitignore`, build tái tạo được |

Không xóa bất kỳ file nào trong `src`: mọi file đều còn được tham chiếu, xóa sẽ gây lỗi build
(trái AIRule "tôn trọng mã nguồn hiện tại" + "không đoán mò").

## 3. Đã làm

1. Xóa `rental-system-frontend/package-lock.json` (theo xác nhận của user). `git status` sau xóa: sạch.
2. Không sửa code nguồn (`src/`) — zero-diff ngoài file xóa + báo cáo này.
3. Chạy lại verification sau xóa (mục 4), viết báo cáo này tại `docs/bao-cao-fe.md` (file mới).

## 4. Kết quả test

Không có test script trong `package.json` (chỉ `dev`/`build`/`preview`/`format`) nên verification =
build + typecheck, chạy sau khi xóa (Node v24.21.0):

- `npm run build` → PASS in ~3.5s. Output: `dist/index.html` 0.95 kB,
  `dist/assets/index-DYmBsZz2.js` 644.15 kB (gzip 192.14 kB),
  `dist/assets/Room3D-D4i58ur9.js` 907.90 kB (gzip 243.34 kB, đã lazy-split),
  `dist/assets/index-D4TNf3DC.css` 71.18 kB. Warning duy nhất: chunk > 500 kB
  (khuyến nghị code-split, không chặn build). Vite cảnh báo `__dirname` + JSON import
  trong `vite.config.ts` (scaffold của Figma Make) — không chặn build, không sửa theo
  minimal-diff.
- `npx tsc --noEmit` → PASS, exit 0, không lỗi type.

## 5. Ghi nhận tuân thủ đặc tả (không đổi code, để team quyết)

- Role FE (`ADMIN`/`QUAN_LY`/`KY_THUAT`/`SALE`/`CUSTOMER` trong `lib/auth.tsx`, route
  `/quan-tri/:section` theo slug) khớp mục 1 đặc tả; phân công theo tòa nhà (`buildings`)
  đã có trong mock user.
- `lib/auth.tsx` vẫn là mock in-memory (`DEMO_PASSWORD`), chưa gọi gateway
  `POST /api/v1/auth/*` (mục 4.2/7.2). Không đấu nối trong đợt này vì vượt phạm vi "xóa file dư"
  và cần backend `auth-service` chạy thật — đề xuất làm task riêng.
- Đề xuất tiếp theo (ngoài phạm vi): tách `Room3D` vendor (three.js ~908 kB) nếu cần giảm
  bundle; thêm `lint`/`typecheck` script vào `package.json` để CI FE có verification chuẩn.
