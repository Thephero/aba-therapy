import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import {
  getPricingConfig,
  savePricingConfig,
  pricingConfigSchema,
  platformBrand,
} from '../services/platformSettings';
import { syncStripePrices, isStripeConfigured } from '../services/stripe';

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
