# MANHOLESAFE — FRONTEND DESIGN SPECIFICATION
*A visual and interaction system for three distinct surfaces: Admin Control Room, Supervisor Field App, Worker Confirmation Page.*

---

## 0. Design Thesis

ManholeSafe's entire value proposition is **evidence** — a record that didn't used to exist. The UI should feel less like a generic SaaS dashboard and more like the physical artifacts this system is *replacing*: the paper Permit-to-Work slip, the site signage, the stamped ledger. Every screen should feel like it's producing something with evidentiary weight, not just "an app."

The three surfaces have genuinely different jobs and should not share one visual voice mechanically:
- **Admin (desktop)** — a control room. Calm, data-dense, built for someone monitoring many permits at once under legal responsibility.
- **Supervisor (mobile, field)** — a work ticket. Fast, thumb-first, high-contrast for outdoor sunlight, minimal typing.
- **Worker (public link, one-time)** — a single honest sentence and one button. No branding performance, no navigation, no distractions — this is the most vulnerable user in the system and deserves the most respect, not the most decoration.

---

## 1. Design Token System

### Color
| Token | Hex | Use |
|---|---|---|
| `--asphalt-900` | `#12181C` | Admin app background (control-room dark) |
| `--asphalt-700` | `#1E262B` | Admin surface/card background |
| `--kraft-100` | `#EFE8DA` | Worker + Supervisor light background — evokes the manila/kraft paper of a physical permit slip |
| `--ink-900` | `#20221D` | Primary text on light surfaces |
| `--signal-amber` | `#E8A33D` | Primary action, "in progress," hazard-tape accent — desaturated from a pure warning-yellow so it reads as brand, not just alert |
| `--signal-red` | `#C43B3B` | Escalated / overdue — used sparingly, only for genuine escalation states |
| `--signal-green` | `#4C7A5A` | Closed / confirmed safe — muted forest, not a cheerful SaaS-green, to keep tone serious |
| `--stamp-blue` | `#2F4858` | Ledger/audit accents, timestamps, GPS/data readouts |
| `--line-40` | `#20221D` @ 40% | Hairline dividers, perforation lines |

This is not the generic three-look palette (cream+terracotta, near-black+neon, broadsheet-hairline) — it's pulled from the subject itself: asphalt, manila permit paper, hazard tape, ledger ink.

### Typography
| Role | Face | Why |
|---|---|---|
| **Display** | *Fraunces* (or *Barlow Condensed* for a stencil-adjacent alt) at heavy weight, used sparingly for section titles/status | Fraunces' slight ink-trap has a stamped, printed-form quality — not a startup-pitch sans |
| **Body** | *IBM Plex Sans* | Humanist, legible at small sizes, designed for data-heavy interfaces (IBM's own use case is close to ours) |
| **Utility / data** | *IBM Plex Mono* | For every timestamp, GPS coordinate, PTW ID, QR payload, phone number — monospacing signals "this is a recorded fact," reinforcing the evidence thesis |

Never mix in a fourth face. The mono face doing double duty as "this is verifiable data" is a deliberate structural device, not decoration — it should appear *only* on system-generated facts (timestamps, IDs, coordinates), never on human-authored copy, so its presence itself becomes meaningful.

### Layout Concept (ASCII wireframes)

**Admin — Control Room (desktop, wide)**
```
┌─────────────────────────────────────────────────────────┐
│ MANHOLESAFE          Ward: All ▾        [Admin: R. Iyer] │
├───────────┬─────────────────────────────────────────────┤
│           │  ● 3 Open   ▲ 1 Overdue   ✓ 12 Closed today  │
│  Sidebar  ├─────────────────────────────────────────────┤
│  Work     │  PERMIT LEDGER                                │
│  Orders   │  ┌───────────────────────────────────────┐  │
│  Live     │  │ MH-7782  in_progress   00:32:11  ⚠     │  │
│  Escalate │  │ MH-6620  pending_conf. 00:04:02        │  │
│  Reports  │  │ MH-1190  closed        —               │  │
│           │  └───────────────────────────────────────┘  │
└───────────┴─────────────────────────────────────────────┘
```
Left rail is fixed navigation (matches the four Admin API groups: work orders, live permits, escalations, reference data/reports). Main pane is always the ledger table — this is a monitoring tool, so the table *is* the home screen, not a dashboard-of-cards pretending to be one.

**Supervisor — Field Ticket (mobile, single column, thumb-zone first)**
```
┌───────────────────┐
│ ← Today            │
│                     │
│  MH-7782            │
│  Ward 4 · 2:15 PM   │
│                     │
│  [ Scan QR ]        │  ← full-width, top of thumb reach
│                     │
│  ⏱ Timer: —         │
│  📍 GPS: —          │
│                     │
│  [ Open Permit ]    │
└───────────────────┘
```
One primary action per screen, always the bottom-anchored full-width button — this is used one-handed, often gloved, in the field.

**Worker — Confirmation (public link, no chrome)**
```
┌───────────────────┐
│                     │
│   MH-7782           │
│   Entered 2:15 PM   │
│   Contractor: Ramesh│
│   Const. Co.        │
│                     │
│   Are you safe      │
│   and out of the    │
│   manhole?          │
│                     │
│   [ Yes, confirm ]  │
│                     │
└───────────────────┘
```
No logo, no nav, no marketing. One fact block (rendered in mono, reinforcing "this is a record"), one question in the display face, one button.

### Signature Element
**The Permit Ledger Card** — every PermitEntry, wherever it appears (admin table row, expanded detail, supervisor ticket, PDF export) shares one recurring component: a card with a **perforated left edge** (a dashed/die-cut visual, like tearing a stub off a paper permit) and a **stamped status badge** rotated slightly off-axis (2–3°), like a rubber date-stamp. This is the one place the design takes a visual risk — everywhere else stays disciplined and quiet so this motif reads as intentional, not decorative clutter.

---

## 2. Screen-by-Screen Specification

### 2.1 Admin — Login
- Kraft-100 card centered on asphalt-900 background — the one place light and dark meet, symbolizing "the office admin logging into the field system"
- Fields: phone/username, password. Inline error in signal-red, plain language ("That password doesn't match this account"), never a raw API error
- No "remember me" clutter — MVP scope, single admin role

### 2.2 Admin — Dashboard / Live Ledger (`GET /api/admin/work-orders`)
- Top stat strip: Open / Overdue / Closed today — plain numerals in Plex Mono, small caption in Plex Sans below each (per architecture's escalation states, "Overdue" maps to `escalated` + timed-out `in_progress`)
- Main ledger table columns: Manhole ID (mono), Status (stamped badge), Elapsed timer (mono, live-updating), GPS mismatch flag (small warning icon only if `location_mismatch = true`), Contractor
- Row click → slide-over detail panel (not full navigation — keeps context of the ledger visible, matches "control room" thesis)
- Filters: Ward, Status — dropdown, top-right, not a heavy filter sidebar (small dataset, hackathon scale)
- Empty state (no permits yet): "No permits open. When a supervisor scans a manhole, it appears here." — plain, instructional, not cutesy

### 2.3 Admin — Work Order Creation
- Form: Manhole (searchable select from reference data), Contractor, Supervisor, Scheduled time
- Duplicate-prevention rule surfaces as an inline warning *before* submit if the selected manhole already has an active WO — don't let them submit into a 409, tell them first
- Submit button label: "Create work order" (matches architecture verb exactly, not generic "Submit")

### 2.4 Admin — Permit Detail (slide-over)
- Uses the Permit Ledger Card motif, expanded
- Sections in order: Status + stamped timestamp ledger (entry → exit → confirm/escalate, each event a mono-timestamped line, literally the audit trail from ARCHITECTURE §18-19) → Entry photo + Exit photo side by side → GPS map-pin readout (lat/lng in mono; visual map is stretch-goal per §26) → SMS history (from `SmsLog`, each line: type, status, timestamp) → Resolve action if `unconfirmed` or `escalated` (mandatory reason textarea per §1, button disabled until reason is non-empty)

### 2.5 Supervisor — Today's Work Orders
- List of cards, one per assigned pending work order, sorted by scheduled time
- Card shows: Manhole ID (large, mono), ward, scheduled time, single button "Open Permit"
- No stat strip, no filters — a supervisor in the field needs their list, not analytics

### 2.6 Supervisor — Open Permit Flow (multi-step, one action per screen)
1. **Scan QR** — full-screen camera view via `html5-qrcode`, large targeting frame, cancel link top-left
2. **GPS Capture** — auto-triggered per architecture §15, shown as a brief inline confirmation ("Location captured") not a separate blocking screen unless permission is denied, in which case a plain-language explainer replaces it: "We need your location to confirm you're at the manhole. Allow location access to continue."
3. **Live Photo** — `capture="environment"` camera input per §13, big preview thumbnail with "Retake" / "Use photo"
4. **Worker Phone** — single large numeric input, formatted as typed
5. **Submit** — full-width button "Open permit", loading state replaces button label with a small spinner + "Opening…", success screen confirms "Permit opened. Worker has been notified by SMS." with the elapsed timer starting visibly

### 2.7 Supervisor — Exit Flow
- Mirrors Open flow: Scan QR → GPS → Live exit photo → Submit
- Success screen explicitly sets expectation correctly per the two-part exit design: "Exit logged. Worker will receive a confirmation link by SMS — the permit closes once they confirm." (Prevents supervisors from assuming the job is instantly done, which matches the actual state machine: `in_progress → pending_confirmation`, not `closed`.)

### 2.8 Worker — Confirmation Page (`/confirm/:token`)
- Single centered card on kraft-100, no navigation chrome at all
- Fact block in mono: Manhole ID, entry time, contractor name (masked worker phone is never shown to the worker themselves — no reason to; masking per §24 is an admin-view rule)
- One question, one button: "Yes, I'm safe and out"
- Success state: full-screen confirmation, signal-green accent, "Confirmed. Thank you — stay safe." Token becomes single-use per §14/24; a second visit to the same link shows a plain state: "This confirmation was already recorded at [timestamp]." — never a raw 410/expired error
- Rate-limiting failures (someone hammering the endpoint) should never surface a technical message to the worker — generic "Something went wrong. Please try the link again in a moment."

---

## 3. Interaction & Motion

- **One orchestrated moment, not scattered effects**: the escalation timer ring on the Admin detail panel and Supervisor ticket is the single animated element worth building well — a thin circular progress ring (styled like a pressure gauge, tying back to the industrial-safety world) that visibly ticks down, shifting from amber to red as it crosses the escalation threshold. Everything else is static or a simple fade.
- Respect `prefers-reduced-motion` — the gauge ring becomes a static numeric countdown instead of an animated stroke.
- No skeleton-loader shimmer everywhere by default — use a plain, honest "Loading permits…" text state for the ledger table; reserve shimmer (if any) for the one component where content shape is predictable (the ledger rows).

---

## 4. Accessibility & Quality Floor

- All status information (amber/red/green) is paired with a text label and/or icon — never color alone, since this is safety-critical
- Supervisor flow tested for outdoor/high-glare contrast — text and buttons meet at least 4.5:1 against kraft-100
- Visible keyboard focus states on all interactive elements (admin app will sometimes be used with keyboard on desktop)
- Worker confirmation page must render correctly on a 3-year-old low-end Android browser opened from an SMS link — no heavy JS framework overhead on that one page if avoidable (candidate for a lightweight static page rather than full React route, worth flagging to backend/frontend split later)

---

## 5. What This Doc Deliberately Leaves Open

Per your note that you'll bring references later — this spec defines the *system* (tokens, motifs, per-screen structure) but intentionally doesn't lock exact spacing scales, icon set, or final copy for every microstate. Once you share references, the fastest path is: keep the token system and the Permit Ledger Card motif (that's the identity), and let references inform layout density and any illustration/icon style on top of it.
