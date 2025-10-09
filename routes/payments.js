const express = require('express');
const Stripe = require('stripe');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// @route   POST /api/payments/create-checkout-session
// @desc    Créer une session Stripe Checkout et renvoyer l'URL
// @access  Public (auth optionnelle pour lier l'email client)
router.post('/create-checkout-session', optionalAuth, async (req, res) => {
  try {
    const {
      items = [], // [{ name, amount, quantity, currency, image }]
      customerEmail = null,
      metadata = {}
    } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucun article fourni pour créer la session Checkout'
      });
    }

    const successUrl = process.env.STRIPE_SUCCESS_URL || 'http://localhost:3000/checkout/success';
    const cancelUrl = process.env.STRIPE_CANCEL_URL || 'http://localhost:3000/checkout/cancel';

    const lineItems = items.map((item) => ({
      price_data: {
        currency: item.currency || 'EUR',
        product_data: {
          name: item.name,
          images: item.image ? [item.image] : []
        },
        // Stripe attend un montant en centimes
        unit_amount: Math.round(Number(item.amount))
      },
      quantity: Number(item.quantity) || 1
    }));

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: lineItems,
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      customer_email: customerEmail || req.user?.email || undefined,
      allow_promotion_codes: true,
      metadata
    });

    return res.status(200).json({
      success: true,
      sessionId: session.id,
      url: session.url
    });
  } catch (error) {
    console.error('Erreur Stripe Checkout:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la session Checkout'
    });
  }
});

module.exports = router;