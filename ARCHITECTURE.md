# Frontend architecture

The app is organized around user-facing capabilities. A feature may use more than one backend domain through the API Gateway; frontend folders do not mirror backend microservices.

## Dependency rules

- `app/` composes providers, layouts, guards, routes, and feature pages.
- `features/` may depend on `shared/` and on another feature's documented public `index.ts` exports.
- Feature internals such as `model/` and `api/` are private to that feature unless deliberately exported.
- `shared/` must not import `app/` or `features/`.
- Every backend request goes through `shared/api/httpClient.ts`; features provide endpoint-specific adapters and must not construct service URLs.
- Layouts render shared navigation and an `Outlet`; route-to-screen ownership lives in `app/router/router.tsx`.
- `app/router/adminRouteAccess.ts` is the source of truth for staff section visibility and route guards. These frontend checks only guide navigation; the backend must authorize every protected resource and action.
- Mock stores stay with their owning feature and remain explicitly named as mocks. They are not fallbacks for API failures.

## Feature ownership

- `auth`: session context, role mapping, auth API, login and registration.
- `listings`: room discovery and listing mock data.
- `bookings`: requests, appointments, and booking mock store.
- `tenant-home`: tenant home and profile screens.
- `maintenance`: repair reports, maintenance screens, and technician tasks.
- `properties`: buildings, rooms, and assets.
- `contracts`, `finance`, `people`, `sales`, and `reporting`: their corresponding business screens.
- `dashboard`: admin and manager landing screens.
- `roommates` and `notifications`: their respective customer-facing experiences and notification mock store.

## Future API work

Keep API adapters inside the owning feature and use only `env.apiUrl` through the shared HTTP client. Add runtime response validation or server-state caching when backend contracts and real use cases justify it. Do not replace mock stores with guessed endpoints.
