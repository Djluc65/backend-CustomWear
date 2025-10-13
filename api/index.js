const express = require('express');
const serverless = require('serverless-http');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const Stripe = require('stripe');

// Charger l'ENV du serveur (server/.env)
require('dotenv').config({ path: './.env' });

// DB
const connectDB = require('../config/database');

// Routes
const authRoutes = require('../routes/auth');
const userRoutes = require('../routes/users');
const productRoutes = require('../routes/products');
const orderRoutes = require('../routes/orders');
const adminRoutes = require('../routes/admin');
const paymentRoutes = require('../routes/payments');

// Init app
const app = express();
// Activer trust proxy derrière Vercel/CDN
app.set('trust proxy', true);

// Connexion DB non bloquante (évite les blocages en préflight)
(async () => {
  try {
    await connectDB();
  } catch (err) {
    console.error('[DB] Échec de connexion MongoDB:', err?.message || err);
  }
})();

// Stripe
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Webhook Stripe sous /api/stripe/webhook (dans la fonction: /stripe/webhook)
app.post('/stripe/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, stripeWebhookSecret);
  } catch (err) {
    console.error('[Stripe Webhook] Signature invalide:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        break;
      case 'payment_intent.payment_failed':
        break;
      case 'charge.refunded':
        break;
      default:
        break;
    }
    res.json({ received: true });
  } catch (err) {
    console.error('[Stripe Webhook] Erreur de traitement:', err);
    res.status(500).json({ message: 'Erreur interne lors du traitement du webhook' });
  }
});

// Middlewares
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || '*', credentials: true }));
// Préflights CORS explicites
app.options('*', cors({ origin: process.env.CLIENT_URL || '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));

// Rate limiting (fiable derrière proxy)
const limiter = rateLimit({ 
  windowMs: 15 * 60 * 1000, 
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: true
});
// Désactiver en environnement Vercel pour éviter l’erreur X-Forwarded-For
if (!process.env.VERCEL) {
  app.use(limiter);
}

// Mount routes (préfixe implicite /api côté Vercel)
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/products', productRoutes);
app.use('/orders', orderRoutes);
app.use('/admin', adminRoutes);
app.use('/payments', paymentRoutes);

// Health
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

module.exports = serverless(app);