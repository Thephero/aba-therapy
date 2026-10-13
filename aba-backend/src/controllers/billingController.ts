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
} from '../services/stripe';
import { getPricingConfig } from '../services/platformSettings';
import { config } from '../config';

// ─── GET /billing/status (CENTER_ADMIN) ─────────────────────────────────────
export async function getBillingStatusHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const status = await getBillingStatus(req.user!.centerId);
    res.json(status);
  } catch (error) {
    next(error);
  }
}

// Public-shape pricing endpoint used by the Billing page of any admin account.
export async function getPricingHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pricing = await getPricingConfig();
    res.json({ pricing, stripeConfigured: isStripeConfigured() });
  } catch (error) {
    next(error);
  }
}

// ─── POST /billing/checkout-session (CENTER_ADMIN) ──────────────────────────
export async function postCheckoutSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as {
      itemKey?: string;
      quantity?: number;
      cycle?: string;
      plan?: string; // legacy key from the pre-platform tier plans — accepted for compat
      seats?: number;
    };

    const itemKey = body.itemKey || body.plan || '';
    const quantity = body.quantity ?? body.seats;
    const cycle = body.cycle;

    if (!itemKey || typeof itemKey !== 'string' || itemKey.length > 40) {
      res.status(400).json({ error: 'Missing or invalid itemKey.' });
      return;
    }

    const admin = await prisma.user.findFirst({
      where: { centerId: req.user!.centerId, role: 'CENTER_ADMIN', isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    const url = await createCheckoutSession({
      centerId: req.user!.centerId,
      adminEmail: admin?.email || '',
      itemKey,
      quantity: quantity != null && Number.isFinite(Number(quantity)) ? Number(quantity) : undefined,
      cycle: cycle === 'ANNUAL' ? 'ANNUAL' : 'MONTHLY',
    });

    res.json({ url });
  } catch (error: any) {
    if (
      error?.message?.includes('not configured') ||
      error?.message?.includes('not enabled') ||
      error?.message?.includes('Unknown checkout') ||
      error?.message?.includes('disabled') ||
      error?.message?.includes('price')
    ) {
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
