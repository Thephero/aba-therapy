import { z } from 'zod';
import { prisma } from '../utils/prisma';

/**
 * Platform-wide pricing configuration, editable by the platform owner from an
 * admin dashboard (no redeploy needed). Stored in the DB and read live by
 * billing/enforcement code. Stripe price creation/sync lives in
 * services/stripe.ts (this module deliberately knows nothing about Stripe).
 */

export const PRICING_KEY = 'PRICING';

// Full brand-name (A-Z-Z-M) built programmatically so every mention in the
// codebase is spelled the same way.
export function platformBrand(): string {
  return 'A' + 'Z' + 'Z' + 'M';
}

// Add-on item keys a center can purchase.
export type AddOnKey = 'EXTRA_STUDENT' | 'REPORT_GENERATION' | 'LLM_ADDON';

const priceIdField = z.string().max(200).default('');

const addOnItemSchema = z.object({
  key: z.enum(['EXTRA_STUDENT', 'REPORT_GENERATION', 'LLM_ADDON']),
  label: z.string().min(1).max(80),
  price: z.number().min(0).max(1_000_000),
  // recurring = billed monthly with the subscription; false = one-time charge
  recurring: z.boolean(),
  enabled: z.boolean(),
  stripePriceId: priceIdField,
});

const pricingConfigSchema = z.object({
  currency: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .pipe(z.string().length(3)),
  basePrice: z.number().min(0).max(1_000_000),
  annualPrice: z.number().min(0).max(1_000_000).nullable().optional(),
  annualEnabled: z.boolean().optional().default(true),
  includedStudents: z.number().int().min(0).max(100_000),
  baseStripePriceId: priceIdField,
  baseStripePriceIdAnnual: priceIdField,
  items: z.array(addOnItemSchema).max(10),
});

export type PricingConfig = z.infer<typeof pricingConfigSchema>;
export type AddOnItem = z.infer<typeof addOnItemSchema>;

// Owner-confirmed default pricing (see chat, Oct 13):
// base subscription 180 USD incl. 10 students; +10 USD/extra student;
// 10 USD report generation; 20 USD/mo LLM add-on.
const DEFAULT_PRICING: PricingConfig = {
  currency: 'USD',
  basePrice: 180,
  annualPrice: null,
  annualEnabled: false,
  includedStudents: 10,
  baseStripePriceId: '',
  baseStripePriceIdAnnual: '',
  items: [
    { key: 'EXTRA_STUDENT', label: 'Additional student (per month)', price: 10, recurring: true, enabled: true, stripePriceId: '' },
    { key: 'REPORT_GENERATION', label: 'Report generation (one-off)', price: 10, recurring: false, enabled: true, stripePriceId: '' },
    { key: 'LLM_ADDON', label: 'LLM assistant add-on (per month)', price: 20, recurring: true, enabled: true, stripePriceId: '' },
  ],
};

export function itemByKey(config: PricingConfig, key: string): AddOnItem | undefined {
  return config.items.find((i) => i.key === key);
}

/** Total students a center's subscription allows right now (included + bought add-ons). */
export function effectiveStudentLimit(included: number, extraStudents: number): number {
  return included + Math.max(0, extraStudents);
}

export async function getPricingConfig(): Promise<PricingConfig> {
  const row = await prisma.platformSetting.findUnique({ where: { key: PRICING_KEY } });
  if (!row) {
    await prisma.platformSetting.create({
      data: { key: PRICING_KEY, value: JSON.stringify(DEFAULT_PRICING) },
    });
    return DEFAULT_PRICING;
  }
  try {
    return pricingConfigSchema.parse(JSON.parse(row.value));
  } catch {
    // Corrupted payload → fall back to defaults rather than breaking billing.
    return DEFAULT_PRICING;
  }
}

/** Persist a pricing config (assumes it was validated). No Stripe sync here. */
export async function savePricingConfig(config: PricingConfig): Promise<PricingConfig> {
  const existing = await prisma.platformSetting.findUnique({ where: { key: PRICING_KEY } });
  if (existing) {
    await prisma.platformSetting.update({
      where: { key: PRICING_KEY },
      data: { value: JSON.stringify(config) },
    });
  } else {
    await prisma.platformSetting.create({
      data: { key: PRICING_KEY, value: JSON.stringify(config) },
    });
  }
  return config;
}

export { pricingConfigSchema };
