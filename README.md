# ManholeSafe

A permit-to-work system for confined-space manhole entry. A supervisor opens a permit
in the field by scanning a manhole's QR code, capturing GPS, and taking a live photo of
the worker; the worker is texted a link and confirms their own safe exit by tapping it;
an admin watches every open permit, every escalation, and every risk signal from a
single live control room. Nothing about "is this permit safe" depends on someone
remembering to check a spreadsheet — it is enforced by the server, on a fixed timer,
whether anyone is watching or not.

---

## Contents

1. [Architecture at a glance](#1-architecture-at-a-glance)
2. [Tech stack](#2-tech-stack)
3. [Data model](#3-data-model)
4. [Core safety flow, step by step](#4-core-safety-flow-step-by-step)
5. [Escalation state machine](#5-escalation-state-machine)
6. [Security model](#6-security-model)
7. [PPE detection (local YOLO-World service)](#7-ppe-detection-local-yolo-world-service)
8. [SMS integration](#8-sms-integration)
9. [API reference](#9-api-reference)
10. [Frontend surfaces](#10-frontend-surfaces)
11. [Running the project](#11-running-the-project)
12. [Environment variables](#12-environment-variables)
13. [Seeded demo accounts](#13-seeded-demo-accounts)
14. [Known limitations / things left advisory on purpose](#14-known-limitations--things-left-advisory-on-purpose)

---

## 1. Architecture at a glance

Three independent processes run side by side. None of them are a single point of
failure for permit safety — the second and third are advisory inputs, not gates.

```
┌─────────────────────┐        ┌──────────────────────┐        ┌───────────────────────┐
│   Frontend (Vite)    │  REST  │   Backend (Express)   │  REST  │  PPE service (FastAPI) │
│   React + Router     │◄──────►│   Prisma + SQLite      │◄──────►│  YOLO-World, local-only │
│   :3000              │        │   :5000                │        │  :8000                  │
└─────────────────────┘        └───────────┬───────────┘        └───────────────────────┘
                                             │
                                             │ node-cron, every 10s
                                             ▼
                                  ┌────────────────────┐        ┌────────────────────┐
                                  │  Escalation timer   │  SMS   │  Fast2SMS (or Mock)  │
                                  │  job (timerJob.js)  │───────►│  provider             │
                                  └────────────────────┘        └────────────────────┘
```

- **Frontend** — three logged-in surfaces (Admin, Supervisor, Contractor) plus one
  public, unauthenticated surface (Worker confirmation page).
- **Backend** — the only thing that ever writes to the database. Every authorization
  decision (does this supervisor own this work order, does this QR match, has this
  confirmation link already been used) happens here, never trusted from the client.
- **PPE service** — a separate local Python process. The backend calls it over
  `localhost` only; if it's not running, permit-opening still works, it just records
  that the PPE check wasn't done.
- **Escalation timer job** — runs inside the backend process itself, polling the
  database on a fixed interval regardless of whether any browser tab is open.

---

## 2. Tech stack

### Backend — `backend/`

| Package | Role |
|---|---|
| `express` 5 | HTTP server / routing |
| `@prisma/client` + `prisma` | ORM and migration tooling, against SQLite |
| `jsonwebtoken` | Signs/verifies session tokens for admin, supervisor, contractor |
| `bcryptjs` | Password hashing |
| `multer` | Multipart file upload handling (entry/exit photos) |
| `qrcode` | Generates the actual QR images for manhole labels |
| `archiver` | Zips all manhole QR labels for bulk download |
| `node-cron` | Runs the escalation/timeout polling job every 10 seconds |
| `joi` | Request body/query validation |
| `express-rate-limit` | Rate limits login, public confirmation, and QR scan endpoints |
| `winston` | Structured logging |
| `cors`, `dotenv` | Cross-origin config, environment loading |
| `jest`, `supertest` (dev) | Test suite |

Node 24+, native `fetch`/`FormData`/`Blob` used directly (no polyfills) for the SMS and
PPE service HTTP calls.

### Frontend — `frontend/`

| Package | Role |
|---|---|
| `react` 18 + `react-dom` | UI |
| `react-router-dom` 6 | Client-side routing across all four surfaces |
| `html5-qrcode` | In-browser camera QR scanning |
| `vite` | Dev server + production bundler |

Deliberately minimal beyond this — no CSS framework, no chart library (all charts are
hand-rolled SVG/inline-style components under `components/charts/`), no state
management library (plain `useState`/`useEffect`, data fetched per-page).

### PPE service — `ppe-service/`

| Package | Role |
|---|---|
| `ultralytics` | Loads and runs the YOLO-World model |
| `fastapi` + `uvicorn` | Thin HTTP wrapper exposing `/health` and `/detect` |
| `python-multipart` | Parses the uploaded image file |

Python 3.13, isolated in its own `venv/`. Runs entirely on-machine — the only network
call it ever makes is the one-time model weight download on first start.

---

## 3. Data model

Six tables (SQLite via Prisma), defined in `backend/prisma/schema.prisma`:

- **Contractor** — a company doing the work. Has login credentials, a name, and an
  optional sub-contractor name. Owns many supervisors and work orders.
- **Manhole** — a physical entry point. Has a human-readable `qr_code_id` (e.g.
  `MH-1102`, printed under the QR as a fallback label) and a separate, unguessable
  `qr_token` (the value actually encoded inside the QR — see [Security model](#6-security-model)).
  Also carries `lat`/`lng`, editable from the admin QR page.
- **Supervisor** — field staff. Logs in by phone number (unique, doubles as the login
  identifier) and password. Belongs to one contractor. Can be soft-deactivated
  (`is_active`) without deleting history.
- **Admin** — back-office/control-room user. Username + password only.
- **WorkOrder** — a scheduled job: one manhole, one contractor, one supervisor, a
  scheduled time. Status moves `pending → in_progress → completed`. Payment status
  (`pending → paid`) flips automatically when the worker confirms their exit.
- **PermitEntry** — the actual safety record, one-to-one with a WorkOrder. This is the
  object everything else in the app is really about. Holds:
  - Entry evidence: photo path, timestamp, GPS lat/lng
  - Exit evidence: same, plus a worker safety-confirmation token
  - PPE check result (`ppe_verified` boolean + raw detection JSON)
  - GPS mismatch/missing flags, computed independently for entry and exit
  - Status lifecycle: `in_progress → pending_confirmation → unconfirmed | escalated → closed`
- **SmsLog** — one row per SMS actually attempted, with delivery status. Every
  escalation and confirmation SMS is logged here — this table is also how the
  escalation timer job knows what's already been sent, so it never double-sends.

---

## 4. Core safety flow, step by step

1. **Admin sets up the work.** Creates manholes (seeded, or added directly in the DB),
   generates and prints a QR label per manhole (`AdminQrCodes.jsx`), calibrates each
   manhole's real GPS coordinates once, and creates a work order assigning a
   contractor's supervisor to a manhole at a scheduled time.

2. **Supervisor opens the permit** (`SupervisorPermitFlow.jsx`, mode `open`), on their
   phone, standing at the manhole:
   - Scans the printed QR (camera) or pastes the scan link (manual fallback).
   - The scan is a **pure identity lookup** — it tells the supervisor which manhole
     this is, but authorizes nothing yet.
   - GPS is captured immediately. If the supervisor scanned with the camera, a denied
     or unavailable GPS reading is tolerated (flagged `location_missing`, permit still
     opens). If the supervisor typed the code manually, GPS becomes **mandatory** —
     manual entry has no camera-proximity signal at all, so GPS is the only remaining
     evidence of physical presence, and the flow hard-blocks until it succeeds.
   - A live photo is taken (camera stream + canvas snapshot, not a file picker — see
     [Security model](#6-security-model) for why).
   - Worker's phone number is entered.
   - On submit, the backend re-runs the real authorization check (see below), runs the
     PPE check against the photo, calculates GPS distance from the manhole's registered
     coordinates, creates the `PermitEntry`, and texts the worker an entry
     notification.

3. **Worker does the confined-space work.** The permit is `in_progress`. The escalation
   timer job is now watching this permit on every poll.

4. **Supervisor logs the exit** (same flow, mode `exit`): scans the manhole again,
   captures GPS, takes an exit photo. The backend generates a single-use,
   cryptographically random confirmation token, sets a confirmation deadline, and texts
   the worker a link: `<app>/confirm/<token>`. Permit status becomes
   `pending_confirmation`.

5. **Worker taps the link** on their own phone — no login required. They see a plain
   fact block (which manhole, when they entered) and one button: "I'm Safe." Tapping it
   closes the permit, timestamps the confirmation, and unlocks the work order's payment
   status. The token can only be used once; a second tap (or a stale/expired link)
   shows a clear "already confirmed" or "window closed" message instead of silently
   failing.

6. **If the worker doesn't tap in time**, the timer job flips the permit to
   `unconfirmed` — visible to admins, resolvable manually, but not further escalated
   (see [Escalation state machine](#5-escalation-state-machine) for why).

7. **Admin watches all of this live** from the ledger (`AdminLedger.jsx`): every open
   permit, live countdown timers, GPS/PPE risk badges, and four charts summarizing
   status breakdown, GPS risk, close-time trend, and per-contractor risk — all computed
   from data already in memory, no extra requests.

---

## 5. Escalation state machine

Implemented in `backend/src/jobs/timerJob.js`, running on a `node-cron` schedule every
**10 seconds** — deliberately smaller than the shortest configured timeout, so
escalation detection doesn't drift far behind real time.

Two timer profiles exist (`backend/src/config/timers.js`), switched by the `DEMO_MODE`
env var:

| | Demo mode | Production mode |
|---|---|---|
| L1 (supervisor alert) | 2 minutes | 45 minutes |
| L2 (nodal escalation) | 1 minute after L1 | 10 minutes after L1 |
| Worker confirmation window | 180 seconds | 1800 seconds (30 min) |

On every tick, for every permit that's `in_progress`, `pending_confirmation`, or
`unconfirmed`:

- **`pending_confirmation`** → if the confirmation deadline has passed, status becomes
  `unconfirmed`.
- **`unconfirmed`** → deliberately **not** escalated further. The supervisor already
  confirmed the worker was physically out (they scanned the exit themselves); what's
  missing is only the worker's own independent SMS confirmation, which is judged
  lower-severity than a permit with no supervisor sign-off at all. Stays visible to
  admins, resolvable manually — it does not silently disappear, it just doesn't page
  anyone further.
- **`in_progress`** → the real escalation ladder:
  - **Level 1** — if no supervisor-alert SMS has been sent yet, and the entry time is
    older than the L1 window, text the assigned supervisor. Status is unchanged at this
    point — it's a nudge, not yet a declared incident.
  - **Level 2** — if a Level 1 SMS was sent but no nodal SMS yet, and it's been longer
    than the L2 window since Level 1 fired, text the nodal officer (`NODAL_PHONE`, or
    the supervisor's own phone as a fallback) and set status to `escalated`.

The job is idempotent by checking `SmsLog` for what's already been sent, not by
tracking state anywhere else — so a server restart mid-cycle can't cause a duplicate or
missed escalation SMS.

> **A bug worth knowing about, since it shaped this design:** the Level 2 step used to
> send the SMS and update the permit status inside one `prisma.$transaction`. A live SMS
> provider call occasionally took longer than Prisma's 5-second interactive-transaction
> timeout, which silently rolled back the status update — while the SMS itself, and its
> `SmsLog` row (written on a separate connection), had already gone through. The permit
> looked stuck `in_progress` forever even though the nodal officer had actually been
> texted. Fixed by sending the SMS first and updating status after, outside any
> transaction — nothing here needed atomicity in the first place, since idempotency
> comes from `SmsLog`, not from the status field.

---

## 6. Security model

### Authentication

Three roles — `admin`, `supervisor`, `contractor` — each with their own login endpoint,
sharing one JWT shape (`{ id, role }`) and one `auth(['role', ...])` middleware. Missing
or invalid tokens return 401; a valid token for the wrong role returns 403. Login
endpoints and the public worker-confirmation endpoint are both rate-limited
(`express-rate-limit`) against brute-forcing.

### QR token vs. QR code — "identify, don't authorize"

Every manhole has **two** separate identifiers, and this split is the core of the
system's anti-tampering design:

- `qr_code_id` — a human-readable label (`MH-1102`), printed as text under the QR
  purely so a damaged sticker is still identifiable by eye.
- `qr_token` — a long, unguessable, server-generated value. **This is what's actually
  encoded inside the QR code**, as a full URL (`<app>/scan/<qr_token>`) — never the
  manhole's id or its human-readable label.

Scanning a QR (`GET /api/scan/:qr_token`) is a **pure identity lookup**: unauthenticated,
rate-limited, and tells you only "this token belongs to manhole X." It does not create a
permit and does not check whether the scanning supervisor is allowed to act on it. A
photographed or reused QR sticker is therefore harmless by itself — it identifies a
manhole, nothing more.

The real authorization only happens when a permit is actually opened or exited
(`permitService.authorizeManholeForWorkOrder`), and runs three checks in this exact
order:

1. Does the scanned token resolve to a known manhole?
2. Does the **logged-in** supervisor (from their JWT, never trusted from the request
   body) own the work order being acted on?
3. Does that manhole match the work order's actually-assigned manhole?

A QR photo alone satisfies check 1. It grants nothing without also matching a specific
supervisor's own active work order.

### Worker confirmation tokens

Generated at **exit** time (not entry), via `crypto.randomBytes(32).toString('hex')`,
stored directly on the `PermitEntry` row rather than signed as a JWT — a `used` boolean
column enforces genuine single-use, since a replayed or guessed token has nothing to
decode, only a database row that already says "used." Tokens also expire on a fixed
window (see the escalation table above).

### Photo capture

Entry and exit photos are taken via `getUserMedia()` + a canvas snapshot, not
`<input type="file" capture="environment">`. The file-input `capture` hint is not
reliably honored across mobile browsers — both iOS Safari and Android Chrome can still
surface a gallery picker next to the camera option — so it doesn't actually guarantee a
freshly taken photo. Opening the camera stream directly and rendering the frame
ourselves removes the gallery path entirely.

### Uploaded evidence

`/uploads/*` (entry/exit photos) is served statically but gated behind
`auth(['admin', 'supervisor'])` — it was previously reachable by anyone who guessed a
filename, exposing worker photos and GPS-linked evidence with no auth at all.

### Advisory-only checks, by design

GPS mismatch/missing and PPE-not-verified are both **recorded and surfaced, never
blocking**. A worker who is physically present and needs to start or end confined-space
work must be able to do so even if their phone's GPS is flaky or a local detection
service happens to be down — the alternative (blocking a real safety action on an
unreliable secondary signal) is worse than a false negative an admin can review later.

---

## 7. PPE detection (local YOLO-World service)

`ppe-service/` is a small FastAPI service that checks the entry photo for visible PPE,
running **entirely on the local machine** — not a hosted/cloud API.

**Why local instead of a hosted API:** a per-call-billed cloud model is a live-demo
failure mode twice over — API credits can run out mid-presentation, and it adds a hard
dependency on venue wifi for one specific feature. Running the model locally removes
both risks: once the model weights are cached (the only network call this service ever
makes), it works completely offline.

**Model:** `yolov8s-worldv2.pt` (YOLO-World small), loaded via the `ultralytics`
library. YOLO-World is zero-shot / open-vocabulary — rather than fixed pretrained
classes, it's given a list of text prompts at startup and detects anything matching
them:

```
hard hat, safety helmet, safety vest, high visibility vest, safety gloves, safety boots
```

That list is edited directly in `ppe-service/main.py` (`PPE_CLASSES`) — no retraining
needed to tune it.

**Endpoints:**
- `GET /health` — confirms the service is up and lists the active detection classes.
- `POST /detect` (multipart image upload) — runs inference, returns
  `{ ppe_verified: bool, predictions: [{class, confidence}], model: "<weights file>" }`.
  `ppe_verified` is true if any class was detected above the confidence threshold
  (default 0.25, overridable via `PPE_CONFIDENCE_THRESHOLD`).

**How the backend calls it:** `backend/src/services/ppeDetectionService.js` sends the
entry photo to `PPE_SERVICE_URL` (default `http://localhost:8000`) with a 10-second
timeout. On any failure — service not running, timeout, bad response — it logs a
warning and returns `ppe_verified: false`, exactly like a GPS mismatch: recorded, never
blocking. The result (verified flag + raw detection JSON, including per-class
confidence) is stored on the `PermitEntry` and shown as a badge plus a detail section on
the admin permit view.

**Running it:** see `ppe-service/README.md`. In short:
```bash
cd ppe-service
python -m venv venv
venv\Scripts\pip install -r requirements.txt
venv\Scripts\uvicorn main:app --port 8000
```
Run it once ahead of any live demo so the model weights are already cached locally —
`GET /health` should respond instantly with no download happening.

---

## 8. SMS integration

All outbound messages (entry notification, exit confirmation link, Level 1/Level 2
escalation alerts) go through `backend/src/services/smsService.js`, which builds the
message text and always logs the outcome to `SmsLog`, regardless of which provider
actually sends it. The provider itself is swappable via `SmsFactory`:

- **`mock`** — logs the message instead of sending, ~200ms simulated delay, always
  reports delivered. Used for local development without any SMS cost.
- **`fast2sms`** — real integration with [Fast2SMS](https://www.fast2sms.com)'s bulk
  REST API. Numbers are converted from the app's stored E.164 format (`+91XXXXXXXXXX`)
  to the bare 10-digit format Fast2SMS's "Quick" route expects.

Selected via `SMS_PROVIDER` (or the legacy `MOCK_SMS=true` flag) in `backend/.env`.

The exit-confirmation link points at `FRONTEND_URL/confirm/<token>` — for local testing
with a real phone, this needs to be a publicly reachable URL (e.g. an `ngrok` tunnel to
the frontend dev server), since a phone on the mobile network can't reach
`localhost:3000` directly.

---

## 9. API reference

All routes are mounted under `/api`. Role column shows which `auth([...])` roles are
required; "public" means no auth header needed (still rate-limited where noted).

### Auth — `/api/auth` (rate-limited, 10 req / 15 min)
| Method & path | Role | Purpose |
|---|---|---|
| `POST /admin/login` | public | Admin login → JWT |
| `POST /supervisor/login` | public | Supervisor login (by phone) → JWT |
| `POST /contractor/login` | public | Contractor login → JWT |

### Work orders — `/api/work-orders`
| Method & path | Role | Purpose |
|---|---|---|
| `POST /` | admin | Create a work order |
| `GET /` | admin, supervisor | List (filterable, paginated) |
| `GET /:id` | admin, supervisor | Get one, with relations |
| `PATCH /:id` | admin | Update |
| `DELETE /:id` | admin | Delete |

### Permits — `/api/supervisor/permit`
| Method & path | Role | Purpose |
|---|---|---|
| `POST /open` | supervisor | Open a permit — multipart: photo, qr_token, GPS, worker phone |
| `POST /exit` | supervisor | Log exit — multipart: photo, qr_token, GPS; generates the worker confirm token |
| `GET /by-work-order/:workOrderId` | admin, supervisor | Live permit status, timers, GPS, PPE, SMS history |
| `POST /:id/resolve` | admin | Manually close a stuck (`unconfirmed`/`escalated`) permit |

### Public worker confirmation — `/api/public` (rate-limited, 10 req / 15 min)
| Method & path | Role | Purpose |
|---|---|---|
| `GET /permit/confirm/:token` | public | Read-only preview before confirming |
| `POST /permit/confirm/:token` | public | "I'm Safe" — closes the permit, unlocks payment |

### QR scan — `/api/scan` (rate-limited, 60 req / 15 min)
| Method & path | Role | Purpose |
|---|---|---|
| `GET /:qr_token` | public | Pure identity lookup — resolves a scanned token to a manhole, authorizes nothing |

### QR label generation — `/api/admin/qr`
| Method & path | Role | Purpose |
|---|---|---|
| `GET /manhole/:manholeId` | admin | Download one printable SVG QR label |
| `GET /bulk` | admin | Download a ZIP of every manhole's QR label |

### Contractor self-service — `/api/contractor`
| Method & path | Role | Purpose |
|---|---|---|
| `GET /me` | contractor | Own profile |
| `GET /supervisors` | contractor | List own active supervisors |
| `GET /work-orders` | contractor | Read-only list of own work orders |
| `POST /supervisors` | contractor | Add a supervisor |
| `PATCH /supervisors/:id` | contractor | Update own supervisor |
| `PATCH /supervisors/:id/deactivate` | contractor | Soft-deactivate own supervisor |

### Reference / misc
| Method & path | Role | Purpose |
|---|---|---|
| `GET /api/reference/contractors` | admin, supervisor | Dropdown data |
| `GET /api/reference/manholes` | admin, supervisor | Dropdown data, filterable by `?ward=` |
| `PATCH /api/admin/manholes/:id/location` | admin | Set a manhole's real GPS coordinates |
| `GET /api/reference/supervisors` | admin, supervisor | Dropdown data, filterable by `?contractor_id=` |

### Static files
| Path | Role | Purpose |
|---|---|---|
| `/uploads/*` | admin, supervisor | Entry/exit evidence photos |

---

## 10. Frontend surfaces

- **Login** (`/login`) — one form, a role toggle (admin / supervisor / contractor).
- **Admin** (`/admin/*`, desktop) — live permit ledger with filters and pagination,
  4-chart analytics row (status breakdown, GPS risk meter with drill-down, close-time
  trend, per-contractor risk table), work order creation, QR label generation +
  per-manhole GPS calibration, and a permit detail slide-over (timeline, GPS readout,
  PPE detection result, photos, SMS history, manual-resolve form).
- **Supervisor** (`/supervisor/*`, **mobile-only** — desktop browsers are shown a
  redirect message, since the flow needs a real camera and GPS) — today's assigned work
  orders, and the step-by-step open/exit flow: scan → GPS → photo → (worker phone, open
  only) → submit.
- **Contractor** (`/contractor/*`, desktop) — own profile, supervisor roster management
  (add/edit/deactivate), read-only view of assigned work orders.
- **Worker confirmation** (`/confirm/:token`, public, no login) — opened from the exit
  SMS on any device. Shows a fact block, one button ("I'm Safe"), and distinct messages
  for already-confirmed / expired / invalid links.

---

## 11. Running the project

Three processes, each in its own terminal.

### Backend
```bash
cd backend
npm install
npx prisma migrate deploy
npx prisma db seed
npm run dev          # http://localhost:5000
```

### Frontend
```bash
cd frontend
npm install
npm run dev           # http://localhost:3000
```

### PPE service (optional — permit-opening works without it)
```bash
cd ppe-service
python -m venv venv
venv\Scripts\pip install -r requirements.txt
venv\Scripts\uvicorn main:app --port 8000
```

### For testing SMS links on a real phone
The confirmation link needs to be reachable from outside your machine:
```bash
ngrok http 3000
```
then set `FRONTEND_URL` and `CORS_ORIGIN` in `backend/.env` to the ngrok URL, and
restart the backend.

---

## 12. Environment variables

All in `backend/.env`:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | SQLite file path |
| `JWT_SECRET` | Signs all session tokens — change before any real deployment |
| `JWT_EXPIRES_IN` | Session lifetime |
| `PORT` | Backend port |
| `CORS_ORIGIN` | Comma-separated list of allowed frontend origins |
| `FRONTEND_URL` | Base URL used to build QR scan links and SMS confirmation links |
| `SMS_PROVIDER` / `MOCK_SMS` | `fast2sms` for real SMS, or mock mode for local dev |
| `FAST2SMS_API_KEY`, `FAST2SMS_ROUTE` | Fast2SMS credentials |
| `NODAL_PHONE` | Where Level 2 escalation SMS goes |
| `LOCATION_THRESHOLD_METERS` | Distance beyond which GPS is flagged as a mismatch |
| `DEMO_MODE` | Short timers for a live pitch vs. real operating durations |
| `CONFIRM_WINDOW_SECONDS` | Optional override of the worker confirmation window |
| `PPE_SERVICE_URL` | Where the local PPE detection service is running |

---

## 13. Seeded demo accounts

All passwords: `password123`.

| Role | Identifier |
|---|---|
| Admin | `admin` |
| Supervisor (John Doe — the SMS-verified test number) | `+919321814739` |
| Supervisor (others) | see `backend/prisma/seed.js` |
| Contractors | `contractor_alpha`, `contractor_omega`, `contractor_metro`, `contractor_nova` |

---

## 14. Known limitations / things left advisory on purpose

- **Manhole GPS coordinates are fictional by default** (seeded as approximate Mumbai
  coordinates). Any real-world scan will show a large distance until an admin
  calibrates each manhole's real coordinates from the QR Codes page.
- **GPS mismatch and PPE-not-verified never block a permit.** This is intentional (see
  [Security model](#6-security-model)) — both are recorded and surfaced to admins, not
  enforced.
- **The PPE service is optional at runtime.** If it isn't running, permits still open
  normally; `ppe_verified` is simply `false` with no detection data attached.
- **`PermitEntry.location_missing`** is a deprecated flag, superseded by the split
  `entry_location_missing`/`exit_location_missing`/`entry_location_mismatch`/
  `exit_location_mismatch` fields in the schema, but is still the field the service
  layer actively reads/writes — left as-is pending a follow-up pass to finish that
  migration.
- **Unconfirmed permits do not escalate further** than the supervisor's own exit scan —
  by design, not a bug (see [Escalation state machine](#5-escalation-state-machine)).
