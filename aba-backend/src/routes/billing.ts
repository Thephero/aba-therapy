import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import * as billingController from '../controllers/billingController';

const router = Router();

// Webhook must be registered BEFORE any JSON-parsed routes that would consume
// the raw body — see index.ts which keeps express.json away from this path.
router.post('/webhooks/stripe', billingController.postStripeWebhook);

router.get('/billing/status', authenticate, authorize('CENTER_ADMIN'), billingController.getBillingStatusHandler);
router.post('/billing/checkout-session', authenticate, authorize('CENTER_ADMIN'), billingController.postCheckoutSession);
router.post('/billing/portal-session', authenticate, authorize('CENTER_ADMIN'), billingController.postPortalSession);

export default router;
