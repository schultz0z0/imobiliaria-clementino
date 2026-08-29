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

## Review fix round

Independent review findings were addressed with browser, UI and real-PostgreSQL
regressions:

- The session cookie remains `HttpOnly` and scoped to `/api/admin`; only the
  double-submit CSRF cookie is readable at the admin origin root. Login and
  password replacement also expire the legacy `/api/admin` CSRF cookie, and
  logout clears both current and legacy paths to avoid duplicate-name parsing.
- Password-change failures are now typed. A wrong current password uses
  `CURRENT_PASSWORD_INVALID` and a rejected password policy uses
  `VALIDATION_FAILED`, both with HTTP 400. Neither triggers session-expiration,
  and the form displays a useful non-sensitive message while preserving input.
- Logout transitions to anonymous only after success or a real session 401.
  Network and 403 failures keep the authenticated shell mounted, show a
  recoverable alert, and are consumed without an unhandled rejection.
- The header brand target is at least 44 px. Login and shell reuse the
  institutional Lucide `Building2` mark and an explicit high-contrast
  `--admin-accent`/`--admin-accent-contrast` pair instead of an invented
  monogram.

### Review TDD evidence

1. RED client/UI: 5/9 passed. Logout 401/403/network rejected through the event
   handler, the password form only showed its fallback message, and the cookie
   regression failed before the root-path contract existed.
2. RED server compatibility: the focused PostgreSQL test failed because no
   legacy-path CSRF clearing cookie was emitted.
3. GREEN client/UI: 10/10 passed, covering root cookie/header behavior without
   session-token exposure, current-password and policy failures, successful
   replacement, actual 401 expiration, and 204/401/403/network logout paths.
4. GREEN auth with isolated PostgreSQL: 21/21 passed, including cookie paths and
   cleanup, semantic password failures, preserved session and successful retry.

### Review verification

- Focused admin/client suite: 10 passed, 0 failed.
- `rtk npm run test:auth`: 21 passed, 0 failed against an isolated PostgreSQL 16
  cluster on `127.0.0.1:55439`; the cluster was stopped and removed afterward.
- `rtk npm test`: 141 passed, 0 failed.
- Explicit admin TypeScript check: no errors.
- `rtk npm run lint`, `rtk npm run admin:build`, and
  `rtk npm run server:build`: passed.
- The repository-wide server TypeScript project still reports pre-existing
  errors in property-route integration fixtures and location-schema narrowing;
  none are in the Task 8 files. The production server bundle succeeds.
- `rtk git diff --check`: passed.
