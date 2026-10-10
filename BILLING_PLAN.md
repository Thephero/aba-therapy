# 💳 Subscription Billing Plan — Stripe (UAE)

> **Status:** ✅ IMPLEMENTED (Oct 3) — code is built and typechecks clean; awaiting Stripe Dashboard setup (6 price IDs + webhook secret) to go live. See §3 for the go-live checklist.
> **Decision record:** Square was considered first but is **not available in the UAE**. Stripe was chosen instead (full UAE support since 2021, AED support, payouts to UAE banks; account requires a valid UAE trade license).
> **Billing model (user decision):** per-student tier **+** monthly/annual option (annual = 2 months free). **Trial: 14 days (user-confirmed).**

---

## 1. Pricing Model

Each **Center** (the paying customer = Center Admin) subscribes to a tier. Price scales with the number of **active students** in the center.

### Tiers (final — owner approved starter pricing)

| Tier | Included students | Monthly | Annual (=2 months free) |
|------|-------------------|---------|--------------------------|
| **Basic** | up to 10 | AED 199 | AED 1,990 |
| **Pro** | up to 30 | AED 449 | AED 4,490 |
| **Enterprise** | up to 1,000 | AED 899 | AED 8,990 |

> Starter pricing chosen to launch with; change anytime by updating the Prices in the Stripe Dashboard and swapping the env vars — no code change needed.

### Billing cycles (user decision: both)

- **Monthly** — standard price.
- **Annual** — price of 10 months (2 months free), charged once upfront.

### How Stripe models this

- One **Stripe Product** per tier (Starter / Pro / Enterprise).
- Per tier, **two Prices**:
  - `recurring: interval=month`
  - `recurring: interval=year` (unit_amount = 10× monthly)
- **Per-seat overage**: model as a *metered* price, or simpler MVP = admin picks the tier matching their student count; tier limits enforced in-app (block adding students beyond tier cap). Recommended MVP: **tier cap enforcement, no metered billing** — simpler, predictable invoices.
- Currency: **AED** (`aed`), Stripe minimum charge for AED ≈ AED 2.

---

## 2. What Changes in the Product

### 2.1 Database (Prisma — both `schema.prisma` and `schema.postgres.prisma`)

New fields on `Center`:

```
plan              String?   // STARTER | PRO | ENTERPRISE | null (trial/free)
planStatus        String?   // TRIALING | ACTIVE | PAST_DUE | CANCELED | null
billingCycle      String?   // MONTHLY | ANNUAL
stripeCustomerId  String?
stripeSubscriptionId String?
studentLimit      Int?      // derived from tier; null = unlimited
currentPeriodEnd  DateTime?
```

Optional `BillingEvent` table for an in-app billing history list (id, centerId, type, amount, currency, stripeInvoiceId, createdAt).

> ⚠️ Schema change → requires `npx prisma db push` locally and `npm run db:push:prod` on Render at deploy.

### 2.2 Backend (`aba-backend`)

New `src/services/stripe.ts` + `src/controllers/billing.ts` + `src/routes/billing.ts` mounted in `routes/index.ts`:

| Route | Auth | Purpose |
|-------|------|---------|
| `POST /billing/checkout-session` | CENTER_ADMIN | Creates a Stripe Checkout Session (subscription mode) for chosen tier+cycle; returns URL to redirect to |
| `GET /billing/status` | CENTER_ADMIN | Plan, status, student count vs limit, current period end, invoices |
| `POST /billing/portal-session` | CENTER_ADMIN | Stripe Customer Portal session (manage card, cancel, invoices) |
| `POST /webhooks/stripe` | **Public, signature-verified** | Lifecycle sync (see below) |

**Webhook events to handle** (set endpoint in Stripe Dashboard → Render URL):

- `checkout.session.completed` → activate plan, store subscription + customer IDs
- `customer.subscription.updated` → sync status (ACTIVE / PAST_DUE / CANCELED), period end, tier changes
- `customer.subscription.deleted` → downgrade to free/canceled state
- `invoice.payment_failed` → flag PAST_DUE (grace window logic)
- `invoice.paid` → log BillingEvent

**Enforcement hook:** in `studentController.createStudent` — if center's `studentLimit` reached and status ≠ ACTIVE, return 402-style error ("tier limit reached — upgrade"). Admin-only routes for billing; staff/parents unaffected.

**Env vars (Render):** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER_MONTHLY`, `STRIPE_PRICE_STARTER_ANNUAL`, `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_ANNUAL` (+ Enterprise when defined).

### 2.3 Frontend (`aba-web`)

1. **Billing page** `/dashboard/billing` (Admin-only; hidden in sidebar for other roles):
   - Current plan card (tier, status badge, renews on X, students used vs limit)
   - Tier comparison table + Monthly/Annual toggle (annual shows "2 months free")
   - **Upgrade / Change plan** → calls checkout-session → redirects to Stripe-hosted Checkout
   - **Manage billing** → Stripe Customer Portal (card update, invoices, cancel)
2. **Trial experience:** new centers start with planStatus=TRIALING, full features, N-day trial (e.g., 14 days) — banner showing days left.
3. **Limit UX:** when at tier cap, "Add Student" button shows upgrade prompt linking to Billing page.
4. Existing `check-env.js` build guard: add Stripe vars to strict-mode checks (fail build on Vercel if missing in prod).

> Note: Stripe Checkout + Customer Portal are **hosted by Stripe** — no card fields in our app, minimal PCI surface, fastest to ship.

### 2.4 Mobile (`aba-mobile`)

Stub — no billing work needed now.

---

## 3. Implementation Steps (when coding starts)

1. **Stripe account setup** (user, needs UAE trade license): create account → get `sk_test` keys → create Products/Prices in Dashboard (test mode) → set webhook endpoint later after deploy.
2. **Backend:** Prisma schema fields → `stripe.ts` service → billing routes → webhook route (raw-body signature verification) → student-limit enforcement → `.env.production.example` update.
3. **Frontend:** Billing page + tier table + checkout redirect + portal redirect + trial banner + limit UX.
4. **Local test:** Stripe CLI `stripe listen --forward-to localhost:3001/api/v1/webhooks/stripe`; test cards `4242 4242 4242 4242` (success), `4000 0000 0000 0341` (declined).
5. **Deploy:** add env vars to Render + Vercel → push → `db:push:prod` on Render → switch Stripe to live keys + live webhook endpoint.
6. **Update docs:** PROJECT_PLAN.md feature table + Session Log row; USER_MANUAL billing section for admins.

**Order of work:** backend first (schema + routes), then frontend page, then enforcement, then deploy config. Typecheck both apps after each stage (`npx tsc --noEmit`).

---

## 4. Decisions (confirmed)

- [x] Final tier names, student caps, and AED prices — Basic 199 / Pro 449 / Enterprise 899 AED monthly; annual ×10
- [x] Trial length — **14 days**, no card required during trial
- [x] Enterprise tier — self-serve (same checkout flow; adjust later if you want "contact us")
- [x] Grace period on failed payment — plan marked PAST_DUE via webhook; adding students blocked immediately, existing data untouched; customer portal lets admin fix the card
- [x] Existing demo center — grandfathered: seed still creates ACTIVE/PRO with 50-student limit

---

## 5. Cost / Fees Note

Stripe UAE pricing ≈ 2.9% + AED 1 per domestic card transaction (verify current rates in Dashboard). No monthly platform fee. Webhooks and Checkout are included at no extra cost.

---

*When implementation starts, follow PROJECT_PLAN.md's convention: append a Session Log row at the end of the session.*
