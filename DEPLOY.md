# ☁️ Cloud Deployment Guide

This guide deploys the ABA Therapy app so anyone with the link can test it.

**Architecture:**
- **Database** → Neon (free serverless Postgres)
- **Backend API** → Render (free Node service) — `aba-backend`
- **Frontend** → Vercel (free Next.js hosting) — `aba-web`

---

## Step 1 — Push the code to GitHub

1. Create a free account at https://github.com (if you don't have one)
2. Create a **new repository** (name it e.g. `aba-therapy`). Keep it **Private** if you don't want your code public.
3. Don't tick "add a README" — we already have code.
4. In your terminal, run (replace `YOUR_USERNAME`):

```bash
git remote add origin https://github.com/YOUR_USERNAME/aba-therapy.git
git branch -M main
git push -u origin main
```

> The `.gitignore` files already exclude secrets, node_modules, and database files — nothing sensitive is pushed.

---

## Step 2 — Create the database (Neon)

1. Create a free account at https://neon.tech
2. **Create a project** (region: any, e.g. US East). A database is created automatically.
3. Copy the **connection string** — it looks like:
   `postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`
4. Keep it handy — you'll paste it into Render in Step 3.

---

## Step 3 — Deploy the backend (Render)

1. Create a free account at https://render.com
2. Click **New → Blueprint**
3. Select your GitHub repo → Render reads `aba-backend/render.yaml` automatically
4. Before deploying, click into the `aba-backend` service and set these **Environment Variables** (from `aba-backend/.env.production.example`):
   - `DATABASE_URL` → the Neon connection string from Step 2
   - `JWT_SECRET` → any long random string (32+ chars). Tip: `openssl rand -base64 48`
   - `JWT_REFRESH_SECRET` → another long random string
   - `CORS_ORIGIN` → your Vercel URL, e.g. `https://aba-web.vercel.app` (set after Step 4, then redeploy)
   - `ENCRYPTION_KEY` → exactly 32 characters
5. Optional but recommended — **Stripe (subscriptions)** env vars (see `BILLING_PLAN.md`):
   - `STRIPE_SECRET_KEY` → from https://dashboard.stripe.com/apikeys (start with `sk_test_...`)
   - `STRIPE_WEBHOOK_SECRET` → from your Stripe webhook endpoint (step 5 below)
   - `STRIPE_PRICE_BASIC_MONTHLY`, `STRIPE_PRICE_BASIC_ANNUAL`, `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_ANNUAL`, `STRIPE_PRICE_ENTERPRISE_MONTHLY`, `STRIPE_PRICE_ENTERPRISE_ANNUAL` → Price IDs created in the Stripe Dashboard
   > Without these, everything else works; the Billing page simply shows "payments not configured".
6. Click **Apply / Deploy**. Render will:
   - install dependencies
   - generate the Prisma client (Postgres)
   - create the database schema (`prisma db push`)
   - seed demo accounts
   - start the API
6. When done, your API URL looks like: `https://aba-backend.onrender.com`
   - Test it: open `https://aba-backend.onrender.com/api/v1/health` → should show `{"status":"ok",...}`

---

## Step 4 — Deploy the frontend (Vercel)

1. Create a free account at https://vercel.com
2. Click **Add New → Project** → import your GitHub repo
3. **Root Directory** → select `aba-web`
4. In **Environment Variables**, add:
   - `NEXT_PUBLIC_API_URL` → `https://aba-backend.onrender.com` (your Render URL, no trailing slash)
5. Click **Deploy**. In ~1 minute you get a URL like: `https://aba-web.vercel.app`

> ⚠️ This env var is the #1 thing people forget — without it the site calls `localhost:3001` and breaks. Since Aug 2, `npm run build` runs `aba-web/scripts/check-env.js` first and **refuses to build** in production (Vercel/CI) if the var is missing, malformed, `localhost`, or plain `http://` — so a misconfigured build can no longer ship silently.

---

## Step 5 — Wire CORS & verify

1. After Vercel gives you a URL, update Render's `CORS_ORIGIN` to that URL and redeploy (or hit **Manual Deploy**).
2. Open your Vercel URL and log in with a demo account:

| Role      | Email                      | Password        |
|-----------|----------------------------|-----------------|
| Admin     | `admin@aba-demo.com`       | `admin123`      |
| Supervisor| `supervisor@aba-demo.com`  | `supervisor123` |
| Therapist | `therapist@aba-demo.com`   | `therapist123`  |

3. Try adding a student, a session, and a trial to confirm the backend link works end-to-end.

---

## Step 6 — Stripe webhook (if subscriptions are enabled)

1. In the Stripe Dashboard → **Developers → Webhooks** → **Add endpoint**
2. URL: `https://<your-render-backend>/api/v1/webhooks/stripe`
3. Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
4. Copy the **Signing secret** (`whsec_...`) into Render's `STRIPE_WEBHOOK_SECRET` and redeploy.

---

## Notes

- **Data resets**: The Neon free tier has a monthly storage limit. Resetting the database = delete the project and re-deploy.
- **Sleeping services**: Render free services spin down after ~15 min of inactivity. The first request after idle takes ~30–60s to wake up.
- **Mobile app** (`aba-mobile`): not included in this guide — it's a React Native/Expo app that would be published separately via Expo/EAS.
- **Sharing**: Send testers your Vercel URL. They log in with the demo accounts above.

## Re-deploying after code changes

Push to GitHub → Render and Vercel auto-deploy. The seed script is idempotent, so demo data is never duplicated.

Pushing commits only ships **code** — it never updates the **database schema**. After changing `schema.postgres.prisma` you must push the schema to Neon before/with the deploy, otherwise the running backend queries columns that don't exist and every affected endpoint returns 500 (this happened Oct 10–13: `Student.code` / `PasswordResetToken` / Subscription billing columns were missing → student endpoints 500 on live). Two ways:

- **From Render dashboard (recommended):** Backend service → Settings → Build Command →
  `npm ci --include=dev && npm run db:generate:prod && npm run db:push:prod && npm run build` → save → **Manual Deploy**. Future deploys then always keep the schema in sync.
- **From a local machine:** paste the Neon `postgresql://` URL into a git-ignored file, then
  `cd aba-backend && DATABASE_URL=<url> npm run db:push:prod`. Only do this on a machine whose local dev DB you can restore (`npm run db:restore:local` regenerates the SQLite client, then restart the local backend).

After a schema change, **redeploy the backend** even if the push already happened: a long-running Render process can cache prepared query plans that go stale after the `ALTER TABLE`.

> ⚠️ **Guard notes:**
> - **Backend:** prod DB scripts (`db:push:prod`, `db:generate:prod`, `db:seed:prod`) run `node scripts/check-prod-db.js` first — they **refuse to run** unless `DATABASE_URL` starts with `postgresql://`. On Render the Neon URL is injected automatically, so deploys are unaffected. If you ever run a prod script locally and it's blocked, restore the local SQLite client with `npm run db:restore:local`.
> - **Frontend:** `npm run build` runs `aba-web/scripts/check-env.js` first — on Vercel (VERCEL=1/CI) it **blocks the build** unless `NEXT_PUBLIC_API_URL` is a valid non-localhost `https://` URL. Your Vercel env var already points at the correct Render URL, so deploys pass. To check locally: `cd aba-web && npm run env:check`. Regression tests: `npm run test:env-guard`.
