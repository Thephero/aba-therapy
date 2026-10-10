import Stripe from 'stripe';
import { prisma } from '../utils/prisma';
import { config } from '../config';

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

// ─── Public API ─────────────────────────────────────────────────────────────

export async function getBillingStatus(centerId: string) {
  const sub = await getSubscriptionByCenterId(centerId);
  if (!sub) {
    return { configured: isStripeConfigured(), plan: null, subscription: null };
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
      studentLimit: sub.activeStudentLimit,
      activeStudents,
      currentPeriodEnd: sub.currentPeriodEnd,
      trialEndsAt: sub.trialEndsAt,
      daysLeft,
      amount: sub.currentAmount,
      currency: sub.currency,
    },
  };
}

export async function createCheckoutSession(params: {
  centerId: string;
  centerName?: string;
  adminEmail: string;
  plan: PlanId;
  cycle: BillingCycle;
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

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceIdFor(params.plan, params.cycle), quantity: 1 }],
    subscription_data: {
      metadata: { centerId: params.centerId, plan: params.plan, cycle: params.cycle },
    },
    metadata: { centerId: params.centerId, plan: params.plan, cycle: params.cycle },
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
      const plan = (session.metadata?.plan as PlanId) || null;
      const cycle = (session.metadata?.cycle as BillingCycle) || null;
      if (!centerId) return;

      await prisma.subscription.updateMany({
        where: { centerId },
        data: {
          plan: plan || 'BASIC',
          status: 'ACTIVE',
          billingCycle: cycle,
          stripeCustomerId: (session.customer as string) || undefined,
          stripeSubscriptionId: (session.subscription as string) || undefined,
          currentAmount: plan ? PLAN_PRICES_AED[plan][cycle || 'MONTHLY'] : 0,
          activeStudentLimit: plan ? PLAN_LIMITS[plan] : 10,
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

      // Deleted (canceled at period end) → downgrade.
      if (event.type === 'customer.subscription.deleted' || subscription.status === 'canceled') {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { status: 'CANCELED', plan: 'BASIC', activeStudentLimit: PLAN_LIMITS.BASIC, endDate: new Date() },
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
