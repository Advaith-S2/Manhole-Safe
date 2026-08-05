# ManholeSafe — Frontend

React + Vite implementation of the three ManholeSafe surfaces (Admin control room,
Supervisor field app, Worker confirmation page) per `ManholeSafe_Frontend_Design_Spec.md`,
wired to the existing Express/Prisma backend.

## Run it

```bash
cp .env.example .env      # points to your backend, default http://localhost:5000/api
npm install
npm run dev                # http://localhost:3000
```

Make sure the backend is running first (see backend README) and `FRONTEND_URL` in the
backend's `.env` is set to `http://localhost:3000` so worker SMS confirmation links point
back here.

## Routes

| Path | Surface |
|---|---|
| `/login` | Admin / Supervisor login (toggle) |
| `/admin` | Live permit ledger |
| `/admin/work-orders/new` | Create work order |
| `/supervisor` | Today's assigned work orders |
| `/supervisor/open/:id` | Open-permit flow (scan → GPS → photo → phone → submit) |
| `/supervisor/exit/:id` | Exit flow (scan → GPS → photo → submit) |
| `/confirm/:token` | Public worker confirmation link (no login) |

## Backend additions made to support this UI

Two read-only endpoints were added (see `backend/src/services/permitService.js` and
`publicService.js` for the implementation, both marked with comments explaining why):

- **`GET /api/supervisor/permit/by-work-order/:workOrderId`** (auth: admin or
  supervisor) — returns the `PermitEntry` for a work order: status, entry/exit
  timestamps and photo paths, GPS distance from the manhole on both entry and exit
  (`location_mismatch` boolean, using the same `LOCATION_THRESHOLD_METERS` as the
  open/exit endpoints), and the full SMS log. This is what feeds the Admin ledger's
  live status badges, GPS-mismatch warnings, the escalation timer ring, and the permit
  detail slide-over — including the "Resolve stuck permit" form, which now looks up the
  permit ID automatically instead of asking the admin to type it in.
- **`GET /api/public/permit/confirm/:token`** (no auth, same rate limiter as the POST) —
  decodes the confirmation token and returns the manhole ID, ward, contractor name, and
  entry time, without mutating anything. Returns 409 if already confirmed, matching the
  POST endpoint's semantics. This lets the Worker confirmation page show the fact block
  before the worker taps confirm, exactly as specified in the design doc.

Both are additive — nothing existing was changed or removed, so this is safe to merge
without affecting the supervisor's open/exit flow or any other route.

## Structure

```
src/
  api.js              fetch wrapper + auth storage
  App.jsx             routes
  styles/tokens.css    design tokens from the spec
  components/          StatusBadge, LedgerCard (signature element), TimerRing, QrScanStep
  pages/                Login, Admin*, Supervisor*, WorkerConfirm
```
