# API

All non-public routes require an active Auth.js session and enforce RBAC plus record scope. JSON errors use `{ code, message, details? }`.

## Public and account routes

- `GET /api/health` process liveness
- `GET /api/ready` SQLite readiness
- `/api/auth/*` Auth.js credentials/session endpoints
- `POST /api/signup` Employee-only signup; role fields are rejected
- `POST /api/password/forgot` rate-limited reset creation
- `POST /api/password/reset` single-use password reset and session revocation

## Master data and assets

- `POST|PATCH /api/admin/departments`
- `POST|PATCH /api/admin/categories`
- `POST /api/admin/assets`
- `POST /api/admin/audits`
- `PATCH /api/assets/:id`
- `POST /api/assets/:id/attachments`
- `PATCH /api/employees/:id`
- `POST /api/employees/:id/roles`
- `PATCH /api/settings`

## Workflow commands

`POST /api/workflows/:action`, where action is one of:

- `allocate`
- `request-transfer`, `decide-transfer`, `complete-transfer`
- `request-return`, `accept-return`
- `book`, `cancel-booking`, `reschedule-booking`
- `raise-maintenance`, `transition-maintenance`
- `start-audit`, `verify-audit-line`, `close-audit`

Stable domain codes include `ASSET_ALREADY_ALLOCATED`, `BOOKING_CONFLICT`, `INVALID_ASSET_TRANSITION`, `SELF_APPROVAL_FORBIDDEN`, `AUDIT_LOCKED`, and `FORBIDDEN_SCOPE`.

## Notifications and reports

- `PATCH /api/notifications` mark one or all recipient notifications read
- `GET /api/reports/assets.csv` authorized, scoped CSV export with activity logging
