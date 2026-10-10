import dotenv from 'dotenv';
import path from 'path';

// Load .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: (process.env.NODE_ENV || 'development') === 'development',

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  cors: {
    // Accept a comma-separated list and normalize trailing slashes so browser
    // origins match reliably (e.g. Vercel URL copied with a trailing slash).
    origins: (process.env.CORS_ORIGIN || 'http://localhost:3000')
      .split(',')
      .map((origin) => origin.trim().replace(/\/$/, ''))
      .filter(Boolean),
  },

  encryption: {
    key: process.env.ENCRYPTION_KEY || 'dev-encryption-key-32chars!!',
  },

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    // Price IDs for each tier/cycle (from Stripe Dashboard). Optional — if a
    // price is missing the checkout route returns a clear error instead.
    prices: {
      BASIC: {
        MONTHLY: process.env.STRIPE_PRICE_BASIC_MONTHLY || '',
        ANNUAL: process.env.STRIPE_PRICE_BASIC_ANNUAL || '',
      },
      PRO: {
        MONTHLY: process.env.STRIPE_PRICE_PRO_MONTHLY || '',
        ANNUAL: process.env.STRIPE_PRICE_PRO_ANNUAL || '',
      },
      ENTERPRISE: {
        MONTHLY: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY || '',
        ANNUAL: process.env.STRIPE_PRICE_ENTERPRISE_ANNUAL || '',
      },
    },
  },
} as const;
