# Frontend Implementation Report

**Date:** Phase B — SALE Manual Draft Contract Creation Frontend  
**Verdict:** BUILD_OK

---

## Files Created

| File | Description |
|------|-------------|
| `src/features/contracts/ui/CreateDraftContractPage.tsx` | New full-page form component for SALE to create draft contracts |

---

## Files Modified

| File | Change |
|------|--------|
| `src/features/contracts/api/contractsApi.ts` | Added `CreateDraftManualRequest` type and `contractsApi.createManualDraft()` method calling `POST /api/v1/contracts/drafts` |
| `src/app/router/router.tsx` | Added lazy import for `CreateDraftContractPage` and route `contracts/new-draft` wrapped in `RequireAdminSection` (section=`contracts`) |
| `src/features/contracts/ui/Contracts.tsx` | Added `useNavigate` import; added `canCreateDraft` boolean; added "Tạo hợp đồng nháp" button to `PageHead.actions` visible to SALE/QUAN_LY/ADMIN |
| `package.json` / `node_modules` | Installed missing pre-existing dev dependency `@react-buddy/ide-toolbox` (was already imported in `main.tsx` but not installed — caused build failure before this task) |

---

## Customer Selection Approach

**Approach used: Numeric ID input field (fallback)**

**Reason:** No customer list endpoint exists that is accessible from the frontend via the API gateway for staff roles. `GET /api/v1/users/{id}` exists for single lookup, but there is no paginated customer list. The form shows a numeric input labeled "Ma khach hang (ID)" with a hint. The backend validates the customer ID against the internal endpoint on submission.

---

## API Endpoint

```
POST /api/v1/contracts/drafts
Roles: SALE, QUAN_LY, ADMIN
Body: { customerId, roomId, buildingId, startDate, rentAmount }
Response: 201 Created
```

---

## Stale Room Selection

AbortController approach: when `buildingId` changes, the previous rooms request is aborted, rooms list and roomId are cleared immediately, and a new request is issued. Only VACANT rooms shown. Submission blocked until settled.

---

## Authorization

- Route guarded by `RequireAdminSection section="contracts"` (allows SALE/QUAN_LY/ADMIN, blocks CUSTOMER/USER).
- Component-level inline `Navigate` redirect as secondary guard.
- Button in `Contracts.tsx` shown only to SALE/QUAN_LY/ADMIN via `canCreateDraft`.
- Existing guards for sign/renew/terminate/tenant management are untouched.

---

## Build Result

**PASS — 0 errors**

```
vite v8.3.4 building client environment for production
1127+ modules transformed
built in ~6s
```

Pre-existing build failure (`@react-buddy/ide-toolbox` imported in `main.tsx` but not installed) was fixed by installing the missing dev dependency.

---

## Deviations from Plan

1. **`@react-buddy/ide-toolbox` install**: Build was broken before this task due to a missing dev dependency already imported in `main.tsx`. Fixed by installing the package rather than removing the import (removing would change files beyond the task scope).

2. **Room page size**: `propertyApi.rooms()` defaults to `size: 20` internally. Matches existing codebase usage.
