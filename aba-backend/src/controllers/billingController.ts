import { Request, Response, NextFunction } from 'express';
import type { Stripe } from 'stripe';
import { prisma } from '../utils/prisma';
import {
  stripe,
  isStripeConfigured,
  getBillingStatus,
  createCheckoutSession,
  createPortalSession,
  handleStripeEvent,
  PLANS,
  BillingCycle,
  PlanId,
  PLAN_LIMITS,
} from '../services/stripe';
import { config } from '../config';

// ─── GET /billing/status (CENTER_ADMIN) ─────────────────────────────────────
export async function getBillingStatusHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const status = await getBillingStatus(req.user!.centerId);
    res.json({
      ...status,
      plans: PLANS.map((plan) => ({
        id: plan,
        studentLimit: PLAN_LIMITS[plan],
      })),
    });
  } catch (error) {
    next(error);
  }
}

// ─── POST /billing/checkout-session (CENTER_ADMIN) ──────────────────────────
export async function postCheckoutSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { plan, cycle } = req.body as { plan?: string; cycle?: string };

    if (!PLANS.includes(plan as PlanId)) {
      res.status(400).json({ error: 'Invalid plan. Choose BASIC, PRO, or ENTERPRISE.' });
      return;
    }
    if (cycle !== 'MONTHLY' && cycle !== 'ANNUAL') {
      res.status(400).json({ error: 'Invalid cycle. Choose MONTHLY or ANNUAL.' });
      return;
    }

    const admin = await prisma.user.findFirst({
      where: { centerId: req.user!.centerId, role: 'CENTER_ADMIN', isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    const url = await createCheckoutSession({
      centerId: req.user!.centerId,
      adminEmail: admin?.email || '',
      plan: plan as PlanId,
      cycle: cycle as BillingCycle,
    });

    res.json({ url });
  } catch (error: any) {
    if (error?.message?.includes('not configured') || error?.message?.includes('STRIPE_PRICE')) {
      res.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
}

// ─── POST /billing/portal-session (CENTER_ADMIN) ────────────────────────────
export async function postPortalSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const sub = await prisma.subscription.findUnique({ where: { centerId: req.user!.centerId } });
    const url = await createPortalSession({
      centerId: req.user!.centerId,
      customerId: sub?.stripeCustomerId || null,
    });
    res.json({ url });
  } catch (error: any) {
    if (error?.message?.includes('No Stripe customer')) {
      res.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
}

// ─── POST /webhooks/stripe (public, signature-verified) ─────────────────────
export async function postStripeWebhook(req: Request, res: Response): Promise<void> {
  const signature = req.headers['stripe-signature'] as string;
  if (!isStripeConfigured()) {
    res.status(503).json({ error: 'Stripe not configured' });
    return;
  }
  if (!signature) {
    res.status(400).json({ error: 'Missing stripe-signature header' });
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe!.webhooks.constructEvent(req.body as Buffer, signature, config.stripe.webhookSecret);
  } catch (err: any) {
    res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
    return;
  }

  try {
    await handleStripeEvent(event);
    res.json({ received: true });
  } catch (error) {
    // Non-2xx makes Stripe retry with backoff.
    res.status(500).json({ error: 'Webhook handler failed' });
  }
}
