# Task 8 implementer report

## Status

Implemented from `ae065d8` on `codex/property-admin`.

## Delivered

- Added a typed, credentialed admin API client with generic `ApiError` messages,
  CSRF header support and a centralized unauthorized-session notification.
- Added session bootstrap, retry, login, forced password change, logout and
  session-expiry state in `AuthProvider`.
- Added a branded Clementino login and first-access password-change experience.
  All controls have visible labels, the password reveal control has changing
  accessible text/state, failures do not expose backend details, and pending,
  expired-session and bootstrap-error states are explicit.
- Added the responsive administration shell with semantic header/navigation/main
  landmarks, skip link, visible keyboard focus, mobile menu, Lucide icons and a
  single emphasized creation action.
- Added isolated admin-only semantic CSS tokens. The layout is mobile-first,
  prevents horizontal overflow, keeps interactive targets at least 44 px and
  honors `prefers-reduced-motion`.
- Wired the shell into the isolated admin Vite entry without changing the public
  application bundle.

## TDD evidence

1. RED: `rtk npx tsx --test admin/src/pages/Login.test.tsx
   admin/src/layout/AdminLayout.test.tsx` failed 2/2 because the Task 8 modules
   did not exist.
2. GREEN: the focused admin suite passed 6/6, including the existing location
   editor regression.

## Fresh verification

- `rtk npx tsx --test admin/src/pages/Login.test.tsx
  admin/src/layout/AdminLayout.test.tsx
  admin/src/components/location/LocationEditor.test.tsx` — 6 passed, 0 failed.
- Explicit admin TypeScript check over all production admin modules — no errors.
- `rtk npm run lint` — passed.
- `rtk npm run admin:build` — passed (1,689 modules transformed).
- `rtk npm test` — 141 passed, 0 failed.
- `rtk git diff --check` — passed.

## Dependency noted for integration

The client implements the Task 4 double-submit contract by reading
`clementino_admin_csrf` and sending `x-csrf-token`. Task 4 currently scopes that
readable cookie to `/api/admin`; therefore Task 16/17 integration must either
serve the SPA under a compatible path or, preferably, make the readable CSRF
cookie available to the admin origin root while keeping the session cookie
restricted and `HttpOnly`. This Task intentionally did not alter the reviewed
Tasks 1–7 server contract.
