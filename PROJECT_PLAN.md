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
│       │   └── dashboard/           layout + pages:
│       │       ├── page.tsx         activity overview
│       │       ├── students/        student CRUD + assign supervisors/therapists + programs
│       │       ├── users/           staff management + assignment modals
│       │       ├── sessions/        sessions + trial/behavior/SOAP recording
│       │       ├── programs/        program & targets
│       │       ├── reports/         reports & analytics
│       │       └── calendar/        session calendar/scheduling view
│       ├── components/              Sidebar (with Quick Stats), MiniDashboard, ui/*
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

> ⚠️ Note: repo is **public** — anyone can see code + demo creds. Can be made private in GitHub settings anytime (no re-push needed).

### Env vars already set
- **Render (backend):** `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY`, `CORS_ORIGIN` (→ Vercel URL). Build: `npm ci --include=dev && npm run db:generate:prod && npm run build`. Start: `node dist/index.js`. Health: `/api/v1/health`. (Set manually on the Web Service — NOT via blueprint; that's why the first deploy failed.)
- **Vercel (frontend):** `NEXT_PUBLIC_API_URL` → Render URL.

### ⚠️ KNOWN ISSUE — last session's fix is UNCONFIRMED
- The deployed frontend was calling `https://aba-therapy-backend-7147.onrender.com` (**typo**: `7147` should be `7l47` — letter `l`, not digit `1`) → logins failed with "Invalid email or password" (misleading fallback message).
- **Fix applied by user (verify!):** corrected `NEXT_PUBLIC_API_URL` on Vercel to `https://aba-therapy-backend-7l47.onrender.com` and redeployed. **NEXT SESSION: confirm login works at the Vercel URL before doing anything else.**
- **Guarded since Aug 2:** `aba-web/scripts/check-env.js` now blocks production builds with a bad `NEXT_PUBLIC_API_URL`, so this class of typo can't silently ship again (see §4).
- **Known quirk:** the login page's "Invalid email or password" is a fallback that also shows on network/CORS failures — consider improving it to surface real errors.

---

## 6. Feature Status

| Feature | Status |
|---------|--------|
| JWT login (admin/supervisor/therapist) | ✅ Live (backend verified; frontend pending typo-fix verification) |
| Student CRUD | ✅ Built |
| Assign supervisor & therapist to student | ✅ Built (student card shows assignees) |
| Staff management + assign therapists→supervisor, staff→students | ✅ Built (with search in modals, assigned counts) |
| Programs & targets (per student) | ✅ Built |
| Sessions: trial data, behaviors, preference/reinforcer | ✅ Built (save errors fixed earlier) |
| Auto-Generate SOAP note | ✅ Built |
| Session calendar/scheduling view | ✅ Built (`/dashboard/calendar`) |
| Reports & analytics (completed vs in-progress sessions) | ⚠️ Built but user reported counts not reflecting status — **verify** |
| Mini dashboard (attendance/today + weekly/monthly toggle) | ✅ Built |
| Sidebar Quick Stats → navigates to pages | ✅ Fixed (was role-case bug: backend returns `CENTER_ADMIN` uppercase vs frontend compared lowercase) |
| Role-based sidebar visibility | ✅ Fixed via `.toLowerCase()` normalization |
| Toasts/notifications & co-sign | ✅ Built |
| Mobile app (real functionality) | ❌ Stub only |
| Billing/Stripe, compliance, encryption, audit-log UI, telehealth | ❌ Not implemented (post-MVP per plan.txt) |

---

## 7. Known Issues / Next Steps (priority order)

1. **Verify live login end-to-end** after the Vercel env-var typo fix (see §5). If still broken, check the built bundle for the baked-in API URL.
2. **Reports & Analytics**: user said completed vs in-progress session counts aren't reflected correctly — investigate `reports` page + session stats endpoint.
3. Improve login page error messaging (surface "cannot reach server" vs "invalid credentials").
4. Consider making repo private (it's currently public).
5. Optional: real mobile app (currently stub), billing, compliance features.

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

---

*Update this file at the end of every session. Keep the Session Log accurate — it's how the next session picks up where you left off.*
