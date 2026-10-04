# Kế hoạch nhiệm vụ: discovery + gateway + auth-service + màn hình Đăng ký/Đăng nhập

Chủ nhiệm: auth-team (nền móng team, quyền sinh sát tài khoản).
Căn cứ: đặc tả mục 1 (role), 4.2 (gateway), 6 (xác thực/phân quyền), 7 (auth-service),
`AIRule.md` (plan-first, minimal-diff, secrets-qua-env, hỏi-trước-khi-thêm-dep).

Trạng thái: Task 1–5 ĐÃ XONG (có bằng chứng file). Task 6–10 là việc còn lại (toàn FE).

## Task 1 — discovery-server (Eureka) ✅ XONG

- `discovery-server/.../DiscoveryServerApplication.java:7` (`@EnableEurekaServer`);
  gateway + auth đăng ký Eureka, gọi nhau bằng tên logic `lb://...`.
- Không còn việc. Tiêu chí: `docker exec rental-discovery wget .../eureka/apps` thấy
  `AUTH-SERVICE`, `API-GATEWAY`.

## Task 2 — api-gateway: chặn token + truyền header ✅ XONG

- `api-gateway/.../filter/JwtAuthenticationFilter.java:66-101`: chặn `/internal/**` → 404,
  xóa `X-User-*` giả mạo, verify HS256 + `iss` + `exp` (401 `TOKEN_EXPIRED`/`UNAUTHENTICATED`),
  gắn `X-User-Id/Type/Roles` forward. `GatewayWhitelist.java:15-19`,
  `CorrelationIdFilter.java:29-39`, 7 route `lb://` (`application.yml:16-43`), CORS qua env.
- Test: `JwtAuthenticationFilterTest`, `GatewayErrorHandlerTest`. Không còn việc.

## Task 3 — auth-service: đăng ký/đăng nhập + cấp JWT ✅ XONG

- `AuthController.java:38-70` → `AccountService.java:61-71` (register 201, BCrypt cost 10,
  validate email/SĐT VN, outbox cùng giao dịch) → `AuthSessionService.java:55-100`
  (khóa 5 lần/15 phút, refresh rotation + chống replay, `/me` đọc header Gateway).
- `JwtProvider.java:47-53` (HS256, `iss=rental-auth`, exp 900s, secret ≥ 32 fail-fast).
- Test: 10 file unit + `AuthFlowIT` (Testcontainers). Không còn việc.

## Task 4 — `infra/docker-compose.yml` tổng ✅ XONG

- Đủ `postgres`, `kafka` + `kafka-init` (`auth.events`), `minio` + `minio-init`,
  `discovery-server`, `auth-service`, `api-gateway` + tool dev; chỉ publish `:8080`;
  chạy bằng `docker compose --env-file .\.env` từ `infra/`. Không còn việc.

## Task 5 — clean cấu trúc FE ✅ XONG (session này)

- Gom 10 screen admin phẳng → `src/screens/admin/`; `CustomerApp.tsx` → `src/layouts/CustomerLayout.tsx`
  (cạnh `AdminLayout.tsx`); tách `src/ui.tsx` → `src/components/ui/` (`Icon.tsx`, `primitives.tsx`,
  barrel `index.ts`) + `src/lib/format.ts` (`vnd`, `toVNTime`); gom mock
  (`data.ts`, `bookings.ts`, `notifications.tsx`, `demoAccounts.ts`) → `src/mocks/`.
- Chỉ đổi vị trí + đường import, giữ nguyên logic. Verify: `tsc --noEmit` exit 0,
  `npm run build` PASS. Không còn việc.

## Task 6 — Dựng lớp `src/api/` ⬜ CHƯA LÀM

- Tạo mới: `src/api/client.ts` (fetch base theo `VITE_API_URL`, gắn `Authorization: Bearer`,
  sinh/forward `X-Correlation-Id`, parse `ErrorResponse` chuẩn), `src/api/auth.ts`
  (`register/login/refresh/me/logout` khớp contract Table 7), `src/api/types.ts`,
  `src/api/token.ts` (lưu access trong memory, refresh trong `localStorage` + hàm `clear`).
- Thêm `.env.example` (`VITE_API_URL=http://localhost:8080`); secrets/token thật không hardcode.
- Tiêu chí xong: `tsc` xanh, chưa cần gọi được (gọi được ở Task 10).

## Task 7 — Đấu `AuthProvider` vào API thật, xóa mock ⬜ CHƯA LÀM

- Sửa: `src/lib/auth.tsx` (`login/register/logout` gọi `src/api/auth.ts`; `refresh` rotation khi
  access hết hạn; `logout` gọi API + `clear`), xóa `src/mocks/demoAccounts.ts` và khối demo
  trong `src/screens/auth/AuthPages.tsx:82-89`.
- Cần team quyết trước khi làm: có giữ `?demo=` để xem giao diện từng role không, hay xóa hẳn.
- Tiêu chí xong: không còn import nào tới `src/mocks/demoAccounts`; grep `DEMO_PASSWORD` rỗng.

## Task 8 — Guards + routes theo role ⬜ CHƯA LÀM

- Sửa: `src/routes.tsx`, `src/layouts/CustomerLayout.tsx` (`RequireCustomer`), bổ sung
  `RequireStaff` (chặn CUSTOMER vào `/quan-tri`, staff lạ tòa nhà → 403 theo đặc tả mục 1),
  giữ tham số `next` sau login, 401 → về `/dang-nhap`.
- Tiêu chí xong: thủ công — chưa login vào trang guard bị đá về login kèm `next`; login
  CUSTOMER vào `/quan-tri` bị đá ra.

## Task 9 — AuthPages theo contract backend ⬜ CHƯA LÀM

- Sửa: `src/screens/auth/AuthPages.tsx` — map `ErrorCode` backend
  (`USERNAME_EXISTS`, `INVALID_CREDENTIALS`, `ACCOUNT_LOCKED`, `VALIDATION_ERROR`...)
  thành message tiếng Việt, giữ validate client hiện tại (email/SĐT VN, pass ≥ 8, meter).
- Tiêu chí xong: mỗi mã lỗi thử được bằng tay đều hiện đúng message, không hiện `Error` thô.

## Task 10 — Verification E2E qua gateway + báo cáo ⬜ CHƯA LÀM

- Chạy: compose lên (`infra/docker-compose.yml`), smoke `register → 201`, `login → 200 + token`,
  `GET /me → 200`, không token → 401 (mẫu lệnh trong `backend/docs/huong-dan-chay-du-an-tu-dau.md` §5),
  rồi login thật trên FE (`VITE_API_URL` trỏ gateway), `tsc` + `build` xanh.
- Ghi kết quả vào `docs/bao-cao-fe.md` (nối tiếp mục 4). Tiêu chí xong: 4 lệnh smoke đều đúng
  mã trạng thái + FE login ra đúng trang theo role (`homeFor`).
