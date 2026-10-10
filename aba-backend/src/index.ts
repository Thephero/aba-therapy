import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config';
import routes from './routes';
import billingRoutes from './routes/billing';
import { errorHandler, notFound } from './middleware/errorHandler';

const app = express();

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    // Non-browser requests (health checks, server-to-server calls) have no
    // Origin header and should remain allowed.
    if (!origin || config.cors.origins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  },
  credentials: true,
}));
app.use(morgan(config.isDev ? 'dev' : 'combined'));

// Stripe webhook MUST receive the raw request body for signature
// verification — register it before express.json parses everything else.
app.use('/api/v1/webhooks/stripe', express.raw({ type: 'application/json' }), billingRoutes);

app.use(express.json({ limit: '10mb' }));

// ─── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/v1', routes);

// ─── Error Handling ─────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── Start Server ───────────────────────────────────────────────────────────
app.listen(config.port, () => {
  console.log(`🚀 ABA Backend API running on port ${config.port}`);
  console.log(`📝 Environment: ${config.nodeEnv}`);
});

export default app;
