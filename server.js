const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const connectDB = require('./config/database');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const Stripe = require('stripe');

// Import des routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const adminRoutes = require('./routes/admin');
const paymentRoutes = require('./routes/payments');
const paypalRoutes = require('./routes/paypalRoutes');
const customizationRoutes = require('./routes/customizations');
const modelRoutes = require('./routes/models');
const customizationPricingRoutes = require('./routes/customizationPricing');
const calculatePriceRoutes = require('./routes/calculatePrice');

const app = express();
// Derrière proxy/CDN (Vercel), faire confiance au premier proxy uniquement
app.set('trust proxy', 1);

// Connexion à la base de données (appel initial non bloquant, avec capture d'erreur)
connectDB().catch(err => {
  console.error('Échec initial de connexion à MongoDB:', err?.message || err);
});

// Middleware pour garantir la connexion DB avant de traiter les requêtes
app.use(async (req, res, next) => {
  try {
    // Ne pas forcer la connexion DB pour les préflights CORS ou routes non-API
    if (req.method === 'OPTIONS' || !req.originalUrl.startsWith('/api')) {
      return next();
    }
    if (mongoose.connection.readyState < 1) {
      await connectDB();
    }
  } catch (err) {
    console.error('Erreur de connexion DB avant requête:', err?.message || err);
    return res.status(500).json({ message: 'Erreur de connexion à la base de données' });
  }
  next();
});

// Configuration Stripe
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// IMPORTANT: Déclarer le webhook Stripe AVANT express.json pour conserver le body brut
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), (req, res) => {
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
        // TODO: marquer la commande comme payée en utilisant payment_intent.id
        break;
      case 'payment_intent.payment_failed':
        // TODO: marquer la commande comme échouée
        break;
      case 'charge.refunded':
        // TODO: enregistrer le remboursement sur la commande
        break;
      default:
        // Autres événements non gérés explicitement
        break;
    }
    res.json({ received: true });
  } catch (err) {
    console.error('[Stripe Webhook] Erreur de traitement:', err);
    res.status(500).json({ message: 'Erreur interne lors du traitement du webhook' });
  }
});

// Middleware de base
app.use(compression());
app.use(helmet());
// CORS dynamique: autoriser plusieurs origines via ALLOWED_ORIGINS ou CLIENT_URL
// Ajout d’un support wildcard (ex: https://*.vercel.app) et VERCEL_URL
const buildAllowedOrigins = () => {
  const envOrigins = (process.env.ALLOWED_ORIGINS || process.env.CLIENT_URL || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);
  const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;
  const defaults = [];
  // En développement, autoriser local par défaut si rien n’est configuré
  if (!envOrigins.length && (process.env.NODE_ENV || 'development') === 'development') {
    defaults.push('http://localhost:3000', 'http://localhost:3001', 'http://localhost:5000');
  }
  const list = [...envOrigins, ...(vercelUrl ? [vercelUrl] : []), ...defaults];
  // En production, tolérer les sous-domaines vercel si non configuré explicitement
  if ((process.env.NODE_ENV || 'production') === 'production') {
    list.push('https://*.vercel.app');
  }
  // Si toujours vide, autoriser tout (évite les 500 sur OPTIONS)
  if (list.length === 0) list.push('*');
  return Array.from(new Set(list));
};

const allowedOrigins = buildAllowedOrigins();

const matchesPattern = (origin, pattern) => {
  if (pattern === '*') return true;
  try {
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    const re = new RegExp(`^${escaped}$`);
    return re.test(origin);
  } catch {
    return false;
  }
};

const isOriginAllowed = (origin) => {
  return allowedOrigins.some((p) => matchesPattern(origin, p));
};

const corsOptions = {
  origin: function(origin, callback) {
    // Autoriser requêtes sans origin (mobile app, curl, etc.)
    if (!origin) return callback(null, true);
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }
    console.warn('[CORS] Origin bloquée:', origin, 'Autorisé:', allowedOrigins);
    // Ne pas lever une erreur pour éviter un 500; laisser le navigateur bloquer sans header CORS
    return callback(null, false);
  },
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
// Préflights CORS
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));

// Journalisation simple des requêtes pour diagnostics
app.use((req, res, next) => {
  try {
    const start = Date.now();
    console.log(`[REQ] ${req.method} ${req.originalUrl}`, {
      query: req.query,
      ip: req.ip
    });
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`[RES] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
    });
  } catch (_) {}
  next();
});

// Rate limiting (cohérent derrière proxy)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limite chaque IP à 100 requêtes par windowMs
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: true
});
app.use(limiter);

// Routes API
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/paypal', paypalRoutes);
app.use('/api/customizations', customizationRoutes);
app.use('/api/models', modelRoutes);
app.use('/api/customization-pricing', customizationPricingRoutes);
app.use('/api', calculatePriceRoutes);

// Routes de base
app.get('/', (req, res) => {
  res.json({ 
    message: 'API CustomWear - Serveur en fonctionnement',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

// Éviter les 404 pour les favicons en environnement backend-only
app.get('/favicon.ico', (req, res) => res.status(204).end());
app.get('/favicon.png', (req, res) => res.status(204).end());

// Route de test API
app.get('/api/health', (req, res) => {
  res.json({ 
    message: 'CustomWear API fonctionne correctement!', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Fallback SPA pour les routes non-API (utile en production quand le client est servi par le serveur)
// Sert les fichiers statiques du dossier client/build et renvoie index.html pour les chemins non-API
const clientBuildPath = path.join(__dirname, '../client/build');
if (fs.existsSync(clientBuildPath)) {
  app.use(express.static(clientBuildPath));
  app.get('*', (req, res, next) => {
    if (req.originalUrl.startsWith('/api')) return next();
    return res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}

// Middleware de gestion d'erreurs
app.use((err, req, res, next) => {
  console.error('[ERROR] Middleware global:', {
    method: req.method,
    url: req.originalUrl,
    userId: req.user?._id,
    message: err?.message
  });
  if (err?.stack) console.error(err.stack);
  res.status(500).json({ 
    message: 'Erreur interne du serveur',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// Gestion des routes non trouvées
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route non trouvée' });
});

const PORT = process.env.PORT || 5000;

// En environnements serverless (Vercel), on exporte l'app sans démarrer un serveur
if (process.env.VERCEL) {
  module.exports = app;
} else {
  app.listen(PORT, () => {
    console.log(`🚀 Serveur CustomWear démarré sur le port ${PORT}`);
    console.log(`🌍 Environnement: ${process.env.NODE_ENV || 'development'}`);
  });
}