import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { prisma } from '../utils/prisma';
import {
  getPricingConfig,
  savePricingConfig,
  pricingConfigSchema,
  platformBrand,
} from '../services/platformSettings';
import { syncStripePrices, isStripeConfigured } from '../services/stripe';

/**
 * GET /platform/stats — platform owner only.
 * High-level counts across the whole platform: centers, students, staff per
 * role, subscription statuses and paid add-ons (extra student seats).
 * NOTE: one-off purchases (e.g. single reports) are not recorded locally by the
 * Stripe webhook yet — they only live in Stripe. Add a local ledger if you need
 * an exact count of one-off tools sold.
 */
export async function getStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const [centersTotal, centersActive, studentsTotal, usersTotal, subs] = await Promise.all([
      prisma.center.count(),
      prisma.center.count({ where: { isActive: true } }),
      prisma.student.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.subscription.findMany({
        select: { status: true, billingCycle: true, currentAmount: true, currency: true, extraStudents: true },
      }),
    ]);

    const usersByRole = await prisma.user.groupBy({
      by: ['role'],
      _count: { _all: true },
      where: { isActive: true },
    });
    const roleCount = (role: string) =>
      usersByRole.find((r) => r.role === role)?._count._all ?? 0;

    const statusCount = (status: string) =>
      subs.filter((s) => s.status === status).length;

    const activeSubs = subs.filter((s) => s.status === 'ACTIVE');
    const mrr = activeSubs
      .filter((s) => s.billingCycle === 'MONTHLY')
      .reduce((sum, s) => sum + s.currentAmount, 0);

    res.json({
      stats: {
        centersTotal,
        centersActive,
        studentsTotal,
        usersTotal,
        usersByRole: {
          centerAdmins: roleCount('CENTER_ADMIN'),
          supervisors: roleCount('SUPERVISOR'),
          therapists: roleCount('THERAPIST'),
          parents: roleCount('PARENT'),
        },
        subscriptions: {
          active: statusCount('ACTIVE'),
          trialing: statusCount('TRIALING'),
          pastDue: statusCount('PAST_DUE'),
          canceled: statusCount('CANCELED'),
        },
        // Paid tools tracked locally: active-paying centers + purchased seats.
        paidCenters: activeSubs.length,
        extraStudentSeats: subs.reduce((sum, s) => sum + s.extraStudents, 0),
        estimatedMrr: Math.round(mrr),
        currency: activeSubs[0]?.currency ?? 'AED',
      },
    });
  } catch (error) {
    next(error);
  }
}

/** GET /platform/pricing — authenticated staff (shows on the Billing page). */
export async function getPricing(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pricing = await getPricingConfig();
    res.json({ pricing, brand: platformBrand() });
  } catch (error) {
    next(error);
  }
}

/** PUT /platform/pricing — platform owner only (WordPress-style dashboard). */
export async function updatePricing(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = pricingConfigSchema.parse(req.body);
    // Persist owner's edits first (so they survive even if Stripe is down),
    // then sync Stripe prices on top of the saved config.
    const saved = await savePricingConfig(parsed);
    const synced = isStripeConfigured() ? await syncStripePrices(saved) : saved;
    res.json({ pricing: synced, brand: platformBrand(), stripeSynced: isStripeConfigured() });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        error: 'Invalid pricing configuration.',
        details: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
      return;
    }
    next(error);
  }
}
