# 📋 ABA Therapy Platform — Project Plan & Status

> **READ ME FIRST (for any new session):** This is the living document of record for this project.
> It tells you where the project stands, what's live, what's broken, and what to do next.
> If you make any change to the codebase, **append a row to the Session Log at the bottom of this file** before finishing.

**Companion docs:**
- `plan.txt` — original full product vision (roles, session elements, rule engine, sprints). Many parts are aspirational; check this file for what's *actually* built.
- `DEPLOY.md` — step-by-step cloud deployment guide (Neon + Render + Vercel).
- `user and pass.txt` — demo login credentials.

---

## 1. Project Overview

SaaS platform for ABA (Applied Behavior Analysis) therapy centers.
- **Admins (Center Admin)** manage staff, students, and center-wide analytics.
- **Supervisors** assign therapists, create programs, review/co-sign session notes.
- **Therapists** run sessions, record trials/behaviors, generate SOAP notes.

**Original vision** (plan.txt) targeted FastAPI + Flutter + full compliance (UAE/DHA). **Actual implementation** is Node/Express + Prisma + Next.js + React Native (Expo) — a pragmatic MVP. Compliance/encryption/telehealth features from plan.txt are **not yet implemented**.

---

## 2. Tech Stack (ACTUAL)

| Layer       | Technology                            | Port  | Notes |
|-------------|---------------------------------------|-------|-------|
| Backend API | Node.js + Express + Prisma + SQLite (local) / Postgres (prod) | 3001 | JWT auth, zod validation, rule engine for session rules |
| Web app     | Next.js (App Router) + React Query + Tailwind + shadcn-style ui | 3000 | Client-side auth context |
| Mobile      | React Native (Expo)                   | —     | **Stub only** (Login + Home screens, no real API integration) |

---

## 3. Repo Structure

```
ABA app - Copy/
├── aba-backend/          Express + Prisma API
│   ├── prisma/
│   │   ├── schema.prisma            (SQLite — local dev)
│   │   └── schema.postgres.prisma   (Postgres — cloud prod)
│   ├── src/
│   │   ├── index.ts                 app entry (Express, cors, helmet)
│   │   ├── config/index.ts          env config (JWT, CORS, encryption)
│   │   ├── controllers/             auth, center, program, session, student, user
│   │   ├── routes/                  index.ts + sessionRules.ts
│   │   ├── services/                ruleEngine.ts, soapNotes.ts
│   │   ├── middleware/              auth.ts, auditLog.ts, errorHandler.ts
│   │   ├── seed.ts                  idempotent demo-data seeder
│   │   └── utils/                   jwt.ts, password.ts, prisma.ts
│   └── render.yaml                  Render blueprint (see DEPLOY.md)
├── aba-web/              Next.js frontend
│   └── src/
│       ├── app/
│       │   ├── login/               login page
│       │   ├── manual/              user manual (public, no auth)
│       │   └── dashboard/           layout + pages:
│       │       ├── page.tsx         activity overview (staff)
│       │       ├── parent/          PARENT PORTAL (read-only):
│       │       │   ├── page.tsx         parent dashboard (child profile, stats, chart)
│       │       │   ├── student/page.tsx detailed child profile (programs, care team, history)
│       │       │   └── calendar/page.tsx parent-friendly session calendar
│       │       ├── students/        student CRUD + assign supervisors/therapists + programs
│       │       ├── users/           staff management + assignment modals
│       │       ├── sessions/        sessions + trial/behavior/SOAP recording
│       │       ├── programs/        program & targets
│       │       ├── reports/         reports & analytics
│       │       └── calendar/        session calendar/scheduling view (staff)
│       ├── components/              Sidebar, MiniDashboard, PerformanceChart, ui/*
│       ├── contexts/AuthContext.tsx
│       └── lib/api.ts               axios instance (reads NEXT_PUBLIC_API_URL)
├── aba-mobile/           React Native stub (Expo)
├── DEPLOY.md, PROJECT_PLAN.md, plan.txt, start-app.bat
└── user and pass.txt     demo credentials
```

---

## 4. Quick Start (Local Development)

**One-click:** double-click `start-app.bat` (starts backend :3001, web :3000, opens browser).

**Manual:**
```bash
# Backend (terminal 1)
cd aba-backend
npm run dev            # http://localhost:3001

# Web (terminal 2)
cd aba-web
npm run dev            # http://localhost:3000
```

**Database:** local dev uses SQLite (`aba-backend/prisma/dev.db`). **First-time local setup** (inside `aba-backend`):
```bash
npx prisma db push && npm run db:seed   # creates schema + seeds demo users
```

**Typechecks:** `aba-backend` → `npx tsc --noEmit` · `aba-web` → `npx tsc --noEmit` (both currently pass with 0 errors).

> ⚠️ **KNOWN GOTCHA (local login 500) — now guarded:** Running `npm run db:generate:prod` locally overwrites the generated Prisma client with the **Postgres** schema — then local SQLite (`DATABASE_URL=file:./dev.db`) fails every DB call with 500 "Internal server error". **Guarded since Aug 2:** all prod DB scripts (`db:push:prod`, `db:generate:prod`, `db:seed:prod`) now run `node scripts/check-prod-db.js` first, which **refuses to run unless `DATABASE_URL` is a `postgresql://` URL**. If you ever do hit it anyway: `cd aba-backend && npm run db:restore:local` (regenerates SQLite client), then **restart the backend** (the running process caches the old client).

> ⚠️ **KNOWN GOTCHA (bad production API URL) — now guarded:** `aba-web/src/lib/api.ts` **silently falls back to `http://localhost:3001`** when `NEXT_PUBLIC_API_URL` is missing, and the Aug 1 deploy shipped a typo'd URL (`7147` vs `7l47`) that broke live login with no error. **Guarded since Aug 2:** `aba-web`'s `build` script runs `node scripts/check-env.js` first — in **strict mode** (Vercel/CI builds, or `npm run env:check`) it **blocks the build** if `NEXT_PUBLIC_API_URL` is missing, malformed, `localhost`, or plain `http://`; local builds only warn. Also warns on trailing slashes or URL paths (api.ts appends `/api/v1`). Regression tests: `cd aba-web && npm run test:env-guard` (8 scenarios).

---

## 5. Live Deployment (CURRENT STATE — July/Aug 2026)

| Service   | Where | URL |
|-----------|-------|-----|
| **Backend** | Render (Free, Node) | `https://aba-therapy-backend-7l47.onrender.com` |
| **Frontend** | Vercel (Free) | `https://aba-therapy-eight.vercel.app` |
| **Database** | Neon (serverless Postgres) | `postgresql://neondb_owner:...@ep-rough-salad-as8r19gy...neon.tech/neondb` |
| **Git repo** | GitHub (PUBLIC) | `https://github.com/Thephero/aba-therapy` (branch `main`) |

> ℹ️ The root folder also contains stray `nul` files (Windows artifacts) — harmless, can be deleted anytime.

**Demo accounts (seeded in cloud DB):**

| Role       | Email                       | Password        |
|------------|-----------------------------|-----------------|
| Admin      | `admin@aba-demo.com`        | `admin123`      |
| Supervisor | `supervisor@aba-demo.com`   | `supervisor123` |
| Therapist  | `therapist@aba-demo.com`    | `therapist123`  |
| Parent     | `parent@aba-demo.com`       | `parent123`     |

> ⚠️ Note: repo is **public** — anyone can see code + demo creds. Can be made private in GitHub settings anytime (no re-push needed).

### Env vars already set
- **Render (backend):** `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY`, `CORS_ORIGIN` (→ Vercel URL). Build: `npm ci --include=dev && npm run db:generate:prod && npm run build`. Start: `node dist/index.js`. Health: `/api/v1/health`. (Set manually on the Web Service — NOT via blueprint; that's why the first deploy failed.)
- **Vercel (frontend):** `NEXT_PUBLIC_API_URL` → Render URL.

### ✅ Resolved: Vercel env-var typo (Aug 14 confirmed)
- The deployed frontend was calling `https://aba-therapy-backend-7147.onrender.com` (**typo**: `7147` should be `7l47` — letter `l`, not digit `1`) → logins failed with "Invalid email or password" (misleading fallback message).
- **Fix applied and verified:** corrected `NEXT_PUBLIC_API_URL` on Vercel to `https://aba-therapy-backend-7l47.onrender.com` and redeployed. Login works end-to-end (admin, supervisor, therapist, parent all verified).
- **Guarded since Aug 2:** `aba-web/scripts/check-env.js` now blocks production builds with a bad `NEXT_PUBLIC_API_URL`, so this class of typo can't silently ship again (see §4).

---

## 6. Feature Status

| Feature | Status |
|---------|--------|
| JWT login (admin/supervisor/therapist) | ✅ Live |
| JWT login (parent) | ✅ Live (seeded account: `parent@aba-demo.com` / `parent123`) |
| Student CRUD | ✅ Built |
| Assign supervisor & therapist to student | ✅ Built (student card shows assignees) |
| Staff management + assign therapists→supervisor, staff→students | ✅ Built (with search in modals, assigned counts) |
| Programs & targets (per student) | ✅ Built |
| Sessions: trial data, behaviors, preference/reinforcer | ✅ Built |
| Auto-Generate SOAP note | ✅ Built |
| Session calendar/scheduling view | ✅ Built (`/dashboard/calendar`) |
| Reports & analytics | ✅ Built with trend indicators + sparklines |
| Mini dashboard (attendance/today + weekly/monthly toggle) | ✅ Built |
| Sidebar Quick Stats → navigates to pages | ✅ Built (collapsible, with D/W/M trend toggle) |
| Role-based sidebar visibility | ✅ Fixed via `.toLowerCase()` normalization |
| Toasts/notifications & co-sign | ✅ Built |
| **PARENT PORTAL (read-only)** | ✅ Built |
| └ Parent Dashboard (`/dashboard/parent`) | ✅ Child profile, stats, performance chart, upcoming/recent sessions, programs |
| └ Parent Student View (`/dashboard/parent/student`) | ✅ Detailed child profile, care team, programs & skills, session history |
| └ Parent Calendar (`/dashboard/parent/calendar`) | ✅ Month grid, day detail panel, upcoming/past sessions sidebar, color legend |
| └ Performance Chart (`PerformanceChart.tsx`) | ✅ 30-day area chart, session count, trial count, weekly trend indicator |
| └ Role-based UI restrictions | ✅ Parents cannot start/edit sessions, record trials, or modify data |
| Parent accounts (Student.linkedParentId) | ✅ Link/unlink parent on student detail page |
| Behavior plans + ABC data | ✅ Built (supervisor sets data type; duration timer + ABC dropdowns) |
| Mand recording | ✅ Built (Record Mand modal + card in session flow) |
| Multi-modality sessions (DTT/NET/Group) | ✅ Built (checkboxes replacing single select) |
| User manual (`/manual`) | ✅ Built (public page + printed doc) |
| **Subscriptions (Stripe)** | ✅ Built (awaiting Stripe price IDs + webhook secret to go live) |
| └ 14-day trial on registration | ✅ Built |
| └ Tier plans Basic/Pro/Enterprise (monthly/annual, AED) | ✅ Built (prices TBD in Stripe Dashboard) |
| └ Checkout + Customer Portal (Stripe-hosted) | ✅ Built |
| └ Student-limit enforcement + expired-trial lock | ✅ Built |
| └ Billing page (admin-only) | ✅ Built |
| **Backend: Messages/Attendance/Documents** | ✅ Schema added (Message, AttendanceRecord, DocumentUpload models — **no UI yet**) |
| Mobile app (real functionality) | ❌ Stub only |
| Billing/Stripe, compliance, encryption, audit-log UI, telehealth | ❌ Not implemented (post-MVP per plan.txt) |

---

## 7. Known Issues / Next Steps (priority order)

1. **Build UI for Messages/Attendance/Documents** — backend schema is added (Message, AttendanceRecord, DocumentUpload models) but no frontend pages or API routes exist yet.
2. **Verify parent portal end-to-end on live** — login as `parent@aba-demo.com`, confirm child data loads, calendar shows sessions, performance chart renders.
3. **Improve login error messaging** — surface "cannot reach server" vs "invalid credentials" instead of generic fallback.
4. **Reports & Analytics** — user previously reported counts not reflecting status — verify with current sparkline/trend implementation.
5. **Consider making repo private** (it's currently public — anyone can see code + demo creds).
6. Optional: real mobile app (currently stub), billing, compliance features.

---

## 8. Session Log (append-only)

| Date | What changed / milestone |
|------|--------------------------|
| Jul 19 | Project scaffolded: `aba-backend` (Express+Prisma), `aba-web` (Next.js), `aba-mobile` (RN stub), `start-app.bat`, `plan.txt` |
| Jul 27–29 | Core features built: auth (JWT), users/staff mgmt, student CRUD + assignments, programs/targets, sessions with trials/behaviors, SOAP auto-generation, reports, calendar, MiniDashboard, toasts, co-sign |
| Aug 1 (bugfixes) | Fixed: trial/behavior "Internal server error" on save; student assignment endpoints (`POST /users/:id/students` route added); sidebar Quick Stats not clickable (uppercase-vs-lowercase role bug); assigned counts not updating |
| Aug 1 (deploy prep) | Added `prisma/schema.postgres.prisma`, prod npm scripts, idempotent seed, `render.yaml`, root `.gitignore`, `.env.production.example` files, `DEPLOY.md`. Typechecks clean. Fixed render.yaml PORT override per review |
| Aug 1 | GitHub repo `Thephero/aba-therapy` created (public); fixed nested `aba-web/.git` gitlink issue; secrets-scanned; pushed `main` |
| Aug 1 | Neon DB created, Postgres schema pushed, demo data seeded. Render service deployed — first attempt failed (default `yarn`/`node index.js`), fixed by setting Build/Start/Health-check commands + 5 env vars manually → **backend LIVE** (health 200 + demo login 200 verified via curl) |
| Aug 1 | Vercel project deployed (`aba-therapy-eight.vercel.app`). Login failed → root-caused to `NEXT_PUBLIC_API_URL` typo (`7147` vs `7l47`) baked into bundle. Fix handed to user; **verification pending** |
| Aug 2 | Created this `PROJECT_PLAN.md` living document |
| Aug 2 | Made the Sidebar's Quick Stats section **collapsible** (toggle button + chevron + animated collapse) in `aba-web/src/components/Sidebar.tsx`. Fixed a TS2305 error by adding `ChevronDown` to the `lucide-react` type stub (`src/types/lucide-react.d.ts`) — note: project shadows real lucide types with 2 stub files (`src/@types/` + `src/types/`), so **every new icon must be added to a stub** or tsc fails |
| Aug 2 | Added **trend indicators** (▲/▼/flat % chips vs previous period) to Quick Stats + MiniDashboard. Backend `/dashboard/summary` now computes a bounded previous period `[prevStart, start)` via `computePeriod(start, end?)` and returns `trends` (sessionsToday, periodCompleted, periodInProgress, periodTotal, periodTrials, periodBehaviors, newStudents, newStaff). New `aba-web/src/components/ui/trend-indicator.tsx` (supports `invert` for behaviors where fewer=better, `compact` size). Fixed critical review bug: previous window was unbounded (inflated baseline) — added `lt: start` bound. Added `TrendingDown` + `Minus` to lucide type stub |
| Aug 2 | **Trend periods + sparklines**: (1) Sidebar Quick Stats got a **Today/Week/Month (D/W/M) segmented toggle** that changes the trend comparison period (queryKey + URL depend on it). (2) **Reports & Analytics** page got the same Today/Week/Month toggle + TrendIndicator chips + sparklines on its 3 stat cards. (3) New **`aba-web/src/components/ui/sparkline.tsx`** — dependency-free SVG sparkline (gradient fill, flat-data centering). (4) Backend `/dashboard/summary` now also returns a **`series`** array: last-7-days daily buckets (sessions, completed, inProgress, trials, behaviors, newStudents, newStaff), local-date day keys, future-scheduled sessions excluded. Sparklines shown in Sidebar, Reports, and all 6 MiniDashboard cards. Removed unused `months` array in reports page. Typechecks clean (0 errors) |
| Aug 2 | **Fixed local login 500 error**: root-caused to the Prisma client being regenerated from the **Postgres** schema by `db:generate:prod` during deploy prep, while local `.env` uses SQLite (`file:./dev.db`). Fixed by `npx prisma generate` (client back to sqlite) — requires **backend restart** to take effect. Documented as a known gotcha (see §4) |
| Aug 2 | **Guarded against the Prisma client mixup recurring**: new `aba-backend/scripts/check-prod-db.js` blocks `db:push:prod` / `db:generate:prod` / `db:seed:prod` unless `DATABASE_URL` starts with `postgresql://` (exit 1 + clear message otherwise). Added `npm run db:restore:local` (regenerates SQLite client). Verified: blocks SQLite/missing URL (exit 1), allows postgresql:// (exit 0) |
| Aug 2 | **Guarded the frontend env too**: new `aba-web/scripts/check-env.js` runs before `next build` — in **strict mode** (VERCEL=1, CI=true/1, or `npm run env:check`) it **blocks the build** (exit 1) when `NEXT_PUBLIC_API_URL` is missing (api.ts silently falls back to localhost), malformed, points at localhost, or uses plain `http://` (mixed content on Vercel's https); local builds only warn. Also warns on trailing slashes and URL paths (api.ts appends `/api/v1`). Added `npm run test:env-guard` — **8 regression scenarios, all passing**; eslint-clean (added file-level `@typescript-eslint/no-require-imports` disable for these plain Node scripts); tsc clean. Prevents a repeat of the `7147` vs `7l47` typo shipping silently |
| Aug 14 | **Product feedback pass (reviewer: supervisor/therapist/admin)**: (1) **Access control** — new `aba-backend/src/utils/access.ts` (`getVisibleStudentIds`/`getStudentScope`/`getSessionScope`/`canAccessStudent`/`canAccessSession`): therapists see only assigned students, supervisors their caseload, admins the center; wired into students/programs/sessions/calendar/summary controllers. This closes the biggest privacy gap (was: any staff saw all center students & all sessions). (2) **Bug fix** — `/dashboard/summary` `sessionsToday` now counts only actually-run sessions (COMPLETED/IN_PROGRESS with `startedAt`); new `scheduledToday` field; MiniDashboard shows "X run · Y scheduled". (3) **Bug fix** — SOAP notes now editable after the session ends until finalized/co-signed (`canEditSOAP` in session detail; co-sign also allowed post-end). (4) **Targets UI** — programs page gained a Manage modal: add/edit targets (domain, skill, prompt hierarchy, mastery %/consecutive, status); target routes opened to CENTER_ADMIN+SUPERVISOR. (5) **Session modalities** — single forced DTT/NET/INC/GROUP select replaced with multi-select checkboxes (DTT/NET/Group); stored as JSON string via `normalizeSessionType`; session detail renders modality badges. (6) **Data collection** — new `BehaviorPlan` model (per-student; supervisor sets FREQUENCY vs DURATION + custom ABC options) with CRUD on student detail page; behavior logging modal uses plans (therapist can't override data type), built-in **duration timer** (start/stop/reset), **ABC dropdowns** with defaults + Other free-text; new `MandRecord` model + "Record Mand" modal and card; reinforcer checks de-emphasized (button + card removed from session flow; model kept). (7) **Therapist dashboard** — summary returns `pendingNotes` (completed sessions w/o finalized notes); MiniDashboard shows Pending Notes card for non-admins, hides Staff for therapists/parents; "Run a Session" CTA button for therapist/supervisor in dashboard header. (8) **Parent accounts** — `Student.parentId` + User `parentOf` relation added to both schemas; parent users creatable in Users (new PARENT role option); link/unlink parent on student detail page; parents scoped to their child only (sidebar, students, sessions, summary) and get read-only student view. (9) **AI SOAP** — `generateSOAPNote` now groups the objective breakdown **per program** (targets→program) and includes mand counts. Rebrand deferred by user decision. Typechecks clean (both apps). ⚠️ **Schema changes** (both `schema.prisma` + `schema.postgres.prisma`): `BehaviorPlan`, `MandRecord` tables + `Student.parentId` + `Session.mandRecords` + `BehaviorRecord.behaviorPlanId` — run `npx prisma db push` locally / `npm run db:push:prod` before testing |
| Aug 14 (verify) | **Ran the app locally + verified end-to-end** (backend :3001, web :3000). Verified: admin/therapist/supervisor/parent logins; summary returns `scheduledToday` + `pendingNotes`; therapist scoped to assigned students only; **fixed a real bug found during verification** — `canAccessStudent` used `{ id: studentId, ...scope }` so the scope's `id: {in}` **overwrote** the target id (object spread) → any staff/parent could GET any student's full profile by id. Fixed with `AND: [{ id }, scope]`. Re-verified: parent gets 403 on a non-child student + 403 on a non-child session, 200 on own child. Verified: behavior plan creation + logging forces supervisor-set DURATION (ignores client FREQUENCY attempt); mand recording; multi-modality session `["DTT","NET","GROUP"]`; per-program SOAP breakdown (`Color Identification: 1/2 correct (50%) — targets: Identify Red`); target add via API (admin 201, supervisor 201); all 11 web routes return 200 after compile. Local DB pushed with new schema + seeded. Demo parent created: `parent@aba-demo.com` / `parent123` (linked to "Mohamed elkhouly" student). |
| Aug 14 | **User manual added (no internal secrets)**: new `USER_MANUAL.md` (repo root, shareable/printable) + public web page at `/manual` (`aba-web/src/app/manual/page.tsx`, server component — no auth required) covering login, roles, dashboard, students, programs & targets, behavior plans, sessions (modalities, trials, behaviors, mands, timer), SOAP notes, reports, calendar, parent view, privacy. Login page now links to it ("Read the User Guide"). **No secrets included** (no credentials, API URLs, env vars, or infra details). Verified: typecheck clean, `/manual` + `/login` return 200 locally. **To go live on Vercel:** commit + push to GitHub `main` — Vercel auto-deploys; the manual will be at `https://aba-therapy-eight.vercel.app/manual`. |
| Aug 14 | **PARENT PORTAL — full read-only experience built.** New pages: (1) `/dashboard/parent` — parent dashboard with child profile card, 4 quick-stat cards (sessions completed, upcoming, active programs, recent activity), PerformanceChart, upcoming sessions list, recent sessions list, programs overview with skill status badges. (2) `/dashboard/parent/student` — detailed child profile: avatar header, stats, PerformanceChart, guardian info, care team (supervisors + therapists), programs & skills with domain/status, full session history with trial + behavior counts. (3) `/dashboard/parent/calendar` — dedicated parent calendar: month grid with color-coded session dots (blue=upcoming, green=completed, amber=in-progress, red=cancelled), clickable day detail panel, upcoming/past sessions sidebar, legend card, today highlight with indigo ring, month navigation + "Today" quick-jump. (4) `PerformanceChart` component — 30-day recharts AreaChart showing sessions completed over time, with summary stats (total sessions, total trials, avg/week, trend % vs previous 7 days). Sidebar updated: parents see "My Dashboard", "My Child", "Session History", "Calendar" (pointing to parent-specific pages). Layout updated: parents auto-redirect to `/dashboard/parent`; MiniDashboard hidden for parents; no "Run a Session" button. Sessions list + detail: all mutation buttons (Begin, Record Trial/Behavior/Mand, SOAP note, End Session) hidden for parents. Seed updated: parent account created (`parent@aba-demo.com` / `parent123`) linked to demo student. All commits pushed to GitHub `main` → Vercel + Render auto-deploy. Typechecks clean. |
| Aug 14 | **Prisma schema additions (not yet wired to UI)**: Added `Message`, `AttendanceRecord`, `DocumentUpload` models to both `schema.prisma` (SQLite) and `schema.postgres.prisma` (Postgres). `Message` — student-scoped sender→receiver messaging with read status. `AttendanceRecord` — date + status (ATTENDING/SICK/ABSENT/LATE/OTHER) + markedBy. `DocumentUpload` — file metadata (name, URL, type, mime, size) for medical reports, images, etc. Committed + pushed. ⚠️ No backend routes or frontend UI exist yet for these models — they are schema-only placeholders for a future communication/attendance/documents feature. |
| Aug 28 | **Parent portal child selector + student images**: Added shared `ParentStudentProvider` and selector across parent pages, persisted via `studentId` query parameter for multi-child accounts. Parent dashboard/profile/calendar queries now use the selected child; corrected parent sidebar links away from staff-only routes. Added `Student.profileImageUrl` to SQLite/Postgres schemas, authorized admin/supervisor image updates with type/size checks, and image display on staff and parent profiles. Applied local schema with `npx prisma db push`; backend/frontend typechecks pass. Production schema still needs `db:push:prod` during deployment. |
| Aug 28 | **Authorization hardening**: Parent session list and calendar requests now validate the requested child server-side; session creation, scheduling, begin/end, trial/behavior/mand/preference/reinforcer/SOAP mutations now verify session or student access. Student archive and assignment mutations now verify student access. Added profile-image removal UI. Backend typecheck, frontend typecheck, and existing environment guard tests pass. No test runner exists in the repository yet, so automated API isolation tests remain a follow-up. |
| Aug 28 | **Parent data/selection fix**: Parent child selection now waits for the `/students` database query to finish before deciding that no child is linked, automatically selects and persists a valid linked child ID, and shows a loading state in the selector. Parent navigation links preserve `studentId`; parent session/calendar requests remain explicitly child-filtered. Sidebar active matching was tightened so only the exact parent page is highlighted. Backend and frontend typechecks plus environment guard tests pass. |
| Aug 28 | **Parent selection race-condition fix**: Prevented a stale or empty URL query parameter from replacing a valid in-memory child selection during navigation. Verified backend typecheck, frontend typecheck, and environment guard tests. |
| Aug 28 | **Parent selector placement fix**: Moved the shared parent selector into the authenticated dashboard layout so it renders reliably on `/dashboard/parent/*` routes, removed the duplicate nested layout wrapper, and corrected parent dashboard navigation highlighting. Backend/frontend checks pass. |
| Oct 13 (brand+pricing) | **REBRAND AZM → brand-letter-run A-Z-Z-M + owner-editable pricing dashboard built.** (1) Brand: `aba-web/src/lib/brand.ts` (BRAND/BRAND_FULL built programmatically) feeds layout metadata, login heading, sidebar logo; backend `platformSettings.platformBrand()` drives new student codes → verified locally `AZZM-0003` auto-generated. ⚠️ **Existing Student codes migrated** (`AZM-000X` → same number with the new 5-char brand prefix) — done locally (0 legacy left); **live Neon migration still pending** (run the same one-off UPDATE after the next schema push). (2) Pricing: new `PlatformSetting` model (both schemas, key/value JSON) + `Subscription.extraStudents` (both schemas, default 0, pushed to local SQLite); `services/platformSettings.ts` (zod-validated config, defaults: USD 180/mo incl 10 students, +10/extra student, 10 report, 20/mo LLM add-on); `stripe.ts` reworked — `ensurePriceForItem`/`getOrCreateBasePrice`/`syncStripePrices` create Stripe Price+Product objects on demand (prices immutable → edits create new Price; checkout uses the latest), checkout now `itemKey`-based (`BASE_SUBSCRIPTION` | `EXTRA_STUDENT` seats | one-offs), webhook handles seat-packs (+N extraStudents) and base checkout with `plan:'BASE'`; `studentController` limit enforcement reads live config (402 `STUDENT_LIMIT_REACHED` returns `includedStudents`/`extraStudents`/`seatsNeeded`/`upgradeItemKey`) — verified live locally. (3) Routes: `GET /platform/pricing` (any staff), `PUT /platform/pricing` (`PLATFORM_ADMIN` only). (4) Seed: platform owner `owner@aba-demo.com` / `owner123` (fresh + idempotent path), demo sub updated to plan BASE/USD 180/10 students. (5) Web: Billing page renders from `pricing` config (base card + add-on cards incl. seat-count picker); new `/dashboard/platform` owner pricing dashboard (base price, included students, currency, annual toggle, add-on items with label/price/recurring/enabled + Stripe-sync badges); Sidebar entry `Platform Pricing` (platform_admin only, Settings icon). BOTH typechecks 0 errors; local end-to-end verified (owner login, GET/PUT pricing persists, enforcement 402 with seatsNeeded, code gen prefix, seat path). ⚠️ **Remaining to go live:** push schema to Neon (`PlatformSetting`, `Subscription.extraStudents`) + re-seed owner (`npm run db:seed:prod`) + migrate live student codes; then commit 3eaf render.yaml already pushes schema on deploy. Stripe is still in TEST/paused state — pricing dashboard saves work without Stripe keys (sync is a no-op). |
| Oct 13 (deploy fix) | **LIVE DB FIXED** — Neon Postgres schema was behind the pushed code (missing `Student.code`, `PasswordResetToken` table, new `Subscription` billing columns) causing 500s on `GET/POST /students` and password reset on production (app looked "DB not connected"); login + summary worked, so DB was connected. Fix: ran `npm run db:push:prod` locally against Neon with `--accept-data-loss` (only the new `(centerId, code)` unique index was flagged — safe: `code` is a new nullable column, existing rows get NULL, Postgres allows multiple NULLs in unique indexes). Verified after push: `GET /students` 200 (existing rows show `code: null`), live `POST /students` → **201 with `AZM-0001`**, delete → 200 — first code generated correctly. Diagnostic note: the intermediate 500s during verification were a bad test payload (API takes `name`, not `firstName`/`lastName`) — confirmed by running the backend locally against Neon and reading the Prisma stack; the schema push itself fully fixed production. Local hygiene after prod-generate: `npm run db:restore:local` restored SQLite client (documented gotcha). Secret handling: Neon URL pasted into `aba-backend/.env.production-secret.txt` (git-ignored in the docs commit; never committed; deleted after verification). Also: `render.yaml` buildCommand now includes `db:push:prod` so future deploys keep the schema in sync (commit 3eaf4ac). DEPLOY.md gained a "schema changes need a Neon push, code push ships code only" section (commit 022e92d). |
| Oct 3 | **Subscription billing (Stripe) built**: New `Subscription` fields (`billingCycle`, `trialEndsAt`, `currentPeriodEnd`) in both schemas (SQLite + Postgres, pushed locally); new `src/services/stripe.ts` (plans Basic 199 / Pro 449 / Enterprise 899 AED monthly, annual = ×10, 14-day trial, limits 10/30/1000 students), `billingController` + `routes/billing.ts` (GET /billing/status, POST /billing/checkout-session, POST /billing/portal-session, public POST /webhooks/stripe with raw-body signature verification registered before express.json in index.ts). New centers via register start a TRIALING subscription (trialEndsAt = +14d, limit = Pro cap). `createStudent` now enforces tier cap (402 PLAN_LIMIT_REACHED) and blocks PAST_DUE/CANCELED/expired-trial centers (402 SUBSCRIPTION_INACTIVE). Webhook handles checkout.session.completed / subscription.updated / deleted / invoice.payment_failed. Frontend: new admin-only `/dashboard/billing` page (current plan card, trial banner with days left, monthly/annual toggle, plan cards → Stripe Checkout redirect, Manage billing → Customer Portal), sidebar entry with new CreditCard/ExternalLink icons added to BOTH lucide stubs. `.env.example` + `.env.production.example` document all 8 Stripe vars. **To go live:** create 6 recurring AED prices in Stripe Dashboard (matching amounts in BILLING_PLAN.md), set env vars on Render, add webhook endpoint → `STRIPE_WEBHOOK_SECRET`. Demo center stays ACTIVE/PRO (seed unchanged, grandfathered). Both typechecks pass. |

---

*Update this file at the end of every session. Keep the Session Log accurate — it's how the next session picks up where you left off.*
