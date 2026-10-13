import Stripe from 'stripe';
import { prisma } from '../utils/prisma';
import { config } from '../config';
import { getPricingConfig, savePricingConfig, itemByKey, PricingConfig, platformBrand, effectiveStudentLimit, AddOnItem } from './platformSettings';

export const PLANS = ['BASIC', 'PRO', 'ENTERPRISE'] as const;
export type PlanId = (typeof PLANS)[number];
export type BillingCycle = 'MONTHLY' | 'ANNUAL';

// Student caps per tier (owner-confirmed defaults).
export const PLAN_LIMITS: Record<PlanId, number> = {
  BASIC: 10,
  PRO: 30,
  ENTERPRISE: 1000,
};

export const TRIAL_DAYS = 14;

// Local display prices in AED (Stripe Price IDs must be created in the
// Dashboard with these amounts — see BILLING_PLAN.md).
export const PLAN_PRICES_AED: Record<PlanId, { MONTHLY: number; ANNUAL: number }> = {
  BASIC: { MONTHLY: 199, ANNUAL: 1990 },
  PRO: { MONTHLY: 449, ANNUAL: 4490 },
  ENTERPRISE: { MONTHLY: 899, ANNUAL: 8990 },
};

export const stripe = config.stripe.secretKey
  ? new Stripe(config.stripe.secretKey, { apiVersion: '2025-08-27.basil' })
  : null;

export function isStripeConfigured(): boolean {
  return !!stripe;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function priceIdFor(plan: PlanId, cycle: BillingCycle): string {
  const id = config.stripe.prices[plan]?.[cycle] || '';
  if (!id) {
    throw new Error(
      `Stripe price for ${plan}/${cycle} is not configured. Set STRIPE_PRICE_${plan}_${cycle} in the environment.`
    );
  }
  return id;
}

function resolvePlanFromPriceId(priceId: string): { plan: PlanId; cycle: BillingCycle } | null {
  for (const plan of PLANS) {
    for (const cycle of ['MONTHLY', 'ANNUAL'] as BillingCycle[]) {
      if (config.stripe.prices[plan]?.[cycle] === priceId) return { plan, cycle };
    }
  }
  return null;
}

async function getSubscriptionByCenterId(centerId: string) {
  return prisma.subscription.findUnique({ where: { centerId } });
}

// ─── Stripe price management (platform pricing dashboard) ──────────────────

/**
 * Returns the Stripe Price id for an item, creating the Price (and the backing
 * Product) on demand. Stripe prices are immutable — editing a price in the
 * platform dashboard creates a new Price and checkout switches over.
 */
export async function ensurePriceForItem(
  item: { key: string; label: string; price: number; recurring: boolean; stripePriceId: string },
  currency: string,
  cycle: BillingCycle = 'MONTHLY'
): Promise<string | null> {
  if (!stripe) return null;

  if (item.stripePriceId) {
    try {
      const existing = await stripe.prices.retrieve(item.stripePriceId);
      if (existing && existing.active) return existing.id;
    } catch {
      // stale id → recreate below
    }
  }

  // Find or create the backing Product (one per item, matched via metadata).
  let productId: string | undefined;
  const products = await stripe.products.list({ active: true, limit: 100 });
  const found = products.data.find((p) => p.metadata?.itemKey === item.key);
  if (found) {
    productId = found.id;
  } else {
    const product = await stripe.products.create({
      name: item.label,
      metadata: { itemKey: item.key },
    });
    productId = product.id;
  }

  const price = await stripe.prices.create({
    currency: currency.toLowerCase(),
    unit_amount: Math.round(item.price * 100),
    product: productId,
    recurring: item.recurring ? { interval: cycle === 'ANNUAL' ? 'year' : 'month' } : undefined,
    metadata: { itemKey: item.key },
  });
  return price.id;
}

/**
 * Base-subscription price: creates the recurring price on demand and persists
 * the price id in the platform pricing config. Returns the updated config too.
 */
export async function getOrCreateBasePrice(
  pricing: PricingConfig,
  cycle: BillingCycle
): Promise<{ priceId: string; config: PricingConfig }> {
  const field = cycle === 'ANNUAL' ? 'baseStripePriceIdAnnual' : 'baseStripePriceId';
  const existingId = pricing[field];
  if (existingId && stripe) {
    try {
      const existing = await stripe.prices.retrieve(existingId);
      if (existing && existing.active) return { priceId: existing.id, config: pricing };
    } catch {
      // stale id → recreate below
    }
  }
  const amount = cycle === 'ANNUAL' ? pricing.annualPrice : pricing.basePrice;
  if (amount == null) throw new Error('Base subscription price is not configured.');
  const priceId = await ensurePriceForItem(
    {
      key: 'BASE_SUBSCRIPTION',
      label: `${platformBrand()} subscription`,
      price: amount,
      recurring: true,
      stripePriceId: pricing[field],
    },
    pricing.currency,
    cycle
  );
  if (!priceId) throw new Error('Stripe price could not be created.');
  const updated = { ...pricing, [field]: priceId };
  await savePricingConfig(updated);
  return { priceId, config: updated };
}

/** Re-run Stripe price creation for every enabled item (after a dashboard save). */
export async function syncStripePrices(pricing: PricingConfig): Promise<PricingConfig> {
  if (!stripe) return pricing;
  const next = { ...pricing, items: pricing.items.map((i) => ({ ...i })) };
  for (const item of next.items) {
    if (!item.enabled) continue;
    const id = await ensurePriceForItem(item, next.currency);
    if (id) item.stripePriceId = id;
  }
  await getOrCreateBasePrice(next, 'MONTHLY');
  if (next.annualEnabled && next.annualPrice != null) {
    await getOrCreateBasePrice(next, 'ANNUAL');
  }
  await savePricingConfig(next);
  return next;
}

// ─── Public API ───────────────────────────────────────────────────────────

export async function getBillingStatus(centerId: string) {
  const sub = await getSubscriptionByCenterId(centerId);
  const pricing = await getPricingConfig();
  if (!sub) {
    return { configured: isStripeConfigured(), plan: null, subscription: null, pricing };
  }

  const activeStudents = await prisma.student.count({
    where: { centerId, isActive: true },
  });

  // Effective status: an expired trial counts as PAST_DUE even before a
  // webhook confirms it, so enforcement never depends on webhook delivery.
  let effectiveStatus = sub.status;
  if (
    sub.status === 'TRIALING' &&
    sub.trialEndsAt &&
    sub.trialEndsAt.getTime() < Date.now()
  ) {
    effectiveStatus = 'PAST_DUE';
  }

  const daysLeft = sub.trialEndsAt
    ? Math.max(0, Math.ceil((sub.trialEndsAt.getTime() - Date.now()) / 86_400_000))
    : null;

  return {
    configured: isStripeConfigured(),
    subscription: {
      plan: sub.plan,
      status: sub.status,
      effectiveStatus,
      billingCycle: sub.billingCycle,
      studentLimit: effectiveStudentLimit(pricing.includedStudents, sub.extraStudents),
      includedStudents: pricing.includedStudents,
      extraStudents: sub.extraStudents,
      activeStudents,
      currentPeriodEnd: sub.currentPeriodEnd,
      trialEndsAt: sub.trialEndsAt,
      daysLeft,
      amount: sub.currentAmount,
      currency: sub.currency,
    },
    pricing,
  };
}

export async function createCheckoutSession(params: {
  centerId: string;
  centerName?: string;
  adminEmail: string;
  // BASE_SUBSCRIPTION or one of the platform add-on item keys
  itemKey: string;
  quantity?: number; // EXTRA_STUDENT seats
  cycle?: BillingCycle; // BASE_SUBSCRIPTION only
}): Promise<string> {
  if (!stripe) {
    throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY.');
  }

  const sub = await getSubscriptionByCenterId(params.centerId);
  if (!sub) throw new Error('No subscription record for this center');

  // Find or create the Stripe customer for this center.
  let customerId = sub.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: params.centerName || 'Therapy Center',
      email: params.adminEmail,
      metadata: { centerId: params.centerId },
    });
    customerId = customer.id;
    await prisma.subscription.update({
      where: { centerId: params.centerId },
      data: { stripeCustomerId: customerId },
    });
  }

  const pricing = await getPricingConfig();
  const cycle: BillingCycle = params.cycle === 'ANNUAL' ? 'ANNUAL' : 'MONTHLY';
  let mode: 'subscription' | 'payment' = 'subscription';
  let price: string | null = null;
  let quantity = Math.max(1, Math.min(1000, Math.floor(params.quantity || 1)));
  const metadata: Record<string, string> = {
    centerId: params.centerId,
    itemKey: params.itemKey,
  };

  if (params.itemKey === 'BASE_SUBSCRIPTION') {
    if (cycle === 'ANNUAL' && (!pricing.annualEnabled || !pricing.annualPrice)) {
      throw new Error('Annual billing is not enabled. Enable it in the platform pricing dashboard.');
    }
    const basePriceResult = await getOrCreateBasePrice(pricing, cycle);
    price = basePriceResult.priceId;
    metadata.cycle = cycle;
  } else {
    // Add-on items — recurring checkouts are drawn into the sub as packs;
    // one-time items (e.g. a report) are single payments.
    const item = itemByKey(pricing, params.itemKey);
    if (!item) {
      throw new Error(`Unknown checkout item "${params.itemKey}".`); // eslint-disable-line
    }
    if (!item.enabled) {
      throw new Error('This add-on is currently disabled.');
    }
    mode = item.recurring ? 'subscription' : 'payment';
    if (!item.recurring) quantity = 1;
    const priceId = await ensurePriceForItem(item, pricing.currency, cycle);
    if (!priceId) throw new Error('Stripe price could not be created.');
    price = priceId;
  }
  if (!price) throw new Error('Checkout item could not be priced.');

  const session = await stripe.checkout.sessions.create({
    mode,
    customer: customerId,
    line_items: [{ price, quantity }],
    subscription_data:
      mode === 'subscription'
        ? {
            metadata: { ...metadata, cycle },
          }
        : undefined,
    metadata: { ...metadata, cycle },
    success_url: `${process.env.CORS_ORIGIN?.split(',')[0] || 'http://localhost:3000'}/dashboard/billing?checkout=success`,
    cancel_url: `${process.env.CORS_ORIGIN?.split(',')[0] || 'http://localhost:3000'}/dashboard/billing?checkout=cancelled`,
  });

  return session.url!;
}

export async function createPortalSession(params: {
  centerId: string;
  customerId: string | null;
}): Promise<string> {
  if (!stripe) throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY.');
  if (!params.customerId) {
    throw new Error('No Stripe customer for this center yet — subscribe to a plan first.');
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: params.customerId,
    return_url: `${process.env.CORS_ORIGIN?.split(',')[0] || 'http://localhost:3000'}/dashboard/billing`,
  });
  return session.url;
}

// ─── Webhook handling ───────────────────────────────────────────────────────

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const centerId = session.metadata?.centerId;
      const itemKey = session.metadata?.itemKey || null;
      const cycle = (session.metadata?.cycle as BillingCycle) || null;
      if (!centerId) return;

      const pricing = await getPricingConfig();

      // Extra-student packs add seats on top of the plan's included count.
      if (itemKey === 'EXTRA_STUDENT') {
        const full = await stripe!.checkout.sessions.retrieve(session.id, {
          expand: ['line_items'],
        });
        const seats = full.line_items?.data?.[0]?.quantity || 1;
        const sub = await prisma.subscription.findFirst({ where: { centerId } });
        if (sub) {
          await prisma.subscription.update({
            where: { id: sub.id },
            data: {
              extraStudents: sub.extraStudents + seats,
              plan: sub.plan === 'TRIAL' ? 'BASE' : sub.plan,
              status: session.subscription ? 'ACTIVE' : sub.status,
            },
          });
        }
        break;
      }

      // One-off purchases (e.g. a report) don't change subscription state yet.
      if (itemKey && itemKey !== 'BASE_SUBSCRIPTION') break;

      // Base subscription checkout (mode: subscription).
      await prisma.subscription.updateMany({
        where: { centerId },
        data: {
          plan: 'BASE',
          status: 'ACTIVE',
          billingCycle: cycle,
          stripeCustomerId: (session.customer as string) || undefined,
          stripeSubscriptionId: (session.subscription as string) || undefined,
          currentAmount: cycle === 'ANNUAL' ? pricing.annualPrice ?? pricing.basePrice : pricing.basePrice,
          currency: pricing.currency,
          activeStudentLimit: pricing.includedStudents,
          endDate: null,
        },
      });
      break;
    }

    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      const sub = await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: subscription.id },
      });
      if (!sub) return;

      // Deleted (canceled at period end) → entitlements stop accruing.
      if (event.type === 'customer.subscription.deleted' || subscription.status === 'canceled') {
        const pricingOnCancel = await getPricingConfig();
        await prisma.subscription.update({
          where: { id: sub.id },
          data: {
            status: 'CANCELED',
            plan: 'BASE',
            activeStudentLimit: pricingOnCancel.includedStudents,
            extraStudents: 0,
            endDate: new Date(),
          },
        });
        break;
      }

      // Sync status + period end. Tier changes come from Checkout metadata or
      // portal upgrades; try to resolve the plan from the configured price IDs.
      const priceId = subscription.items.data[0]?.price?.id || '';
      const resolved = resolvePlanFromPriceId(priceId);
      const map: Record<string, string> = {
        trialing: 'TRIALING',
        active: 'ACTIVE',
        past_due: 'PAST_DUE',
        canceled: 'CANCELED',
        unpaid: 'PAST_DUE',
        paused: 'PAST_DUE',
      };

      await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          status: map[subscription.status] || sub.status,
          plan: resolved?.plan || sub.plan,
          billingCycle: resolved?.cycle || sub.billingCycle,
          activeStudentLimit: resolved ? PLAN_LIMITS[resolved.plan] : sub.activeStudentLimit,
          currentPeriodEnd: (subscription as any).current_period_end
            ? new Date((subscription as any).current_period_end * 1000)
            : undefined,
        },
      });
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      const customerId = invoice.customer as string;
      const sub = await prisma.subscription.findFirst({ where: { stripeCustomerId: customerId } });
      if (sub && sub.status === 'ACTIVE') {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { status: 'PAST_DUE' },
        });
      }
      break;
    }

    case 'invoice.paid': {
      // Optional: log BillingEvent here later for in-app billing history.
      break;
    }

    default:
      // Unhandled event types are acknowledged silently.
      break;
  }
}
