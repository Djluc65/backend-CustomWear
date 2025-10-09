const express = require('express');
const https = require('https');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_ENV = (process.env.PAYPAL_ENV || 'sandbox').toLowerCase();
const PAYPAL_BASE = PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

// URLs de redirection (fallbacks en développement)
const DEFAULT_SUCCESS_URL = 'http://localhost:3000/checkout/success';
const DEFAULT_CANCEL_URL = 'http://localhost:3000/checkout/cancel';

// Helper HTTP via https natif
const httpRequest = (url, method, headers = {}, body = null) => {
  return new Promise((resolve, reject) => {
    try {
      const parsed = new URL(url);
      const options = {
        hostname: parsed.hostname,
        path: parsed.pathname + (parsed.search || ''),
        method,
        headers
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const contentType = res.headers['content-type'] || '';
            const isJSON = contentType.includes('application/json');
            const parsedData = isJSON ? JSON.parse(data || '{}') : data;
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsedData);
            } else {
              reject({ status: res.statusCode, data: parsedData });
            }
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', (err) => reject(err));
      if (body) req.write(body);
      req.end();
    } catch (err) {
      reject(err);
    }
  });
};

// Obtenir un access token OAuth2 PayPal
const getPayPalAccessToken = async () => {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    throw new Error('Configuration PayPal manquante: PAYPAL_CLIENT_ID/PAYPAL_CLIENT_SECRET');
  }

  const tokenUrl = `${PAYPAL_BASE}/v1/oauth2/token`;
  const authHeader = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
  const body = 'grant_type=client_credentials';

  const response = await httpRequest(
    tokenUrl,
    'POST',
    {
      'Authorization': `Basic ${authHeader}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body
  );

  return response?.access_token;
};

// Créer un ordre PayPal (intent CAPTURE)
// @route   POST /api/paypal/create-order
// @access  Public (auth optionnelle pour lier l'email)
router.post('/create-order', optionalAuth, async (req, res) => {
  try {
    const {
      items = [], // [{ name, amount (en centimes), quantity, currency, sku }]
      metadata = {},
      customerEmail = null,
      applicationContext = {},
      shippingFeeCents = 0
    } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Aucun article fourni pour créer l\'ordre PayPal' });
    }

    const currency = (items[0]?.currency || 'EUR').toUpperCase();
    const totalCents = items.reduce((sum, it) => {
      const unit = Math.round(Number(it.amount) || 0);
      const qty = Number(it.quantity) || 1;
      return sum + unit * qty;
    }, 0);
    const shippingValue = ((Math.round(Number(shippingFeeCents) || 0) / 100).toFixed(2));
    const totalValue = ((totalCents + Math.round(Number(shippingFeeCents) || 0)) / 100).toFixed(2);

    const paypalItems = items.map((it) => ({
      name: it.name,
      unit_amount: {
        currency_code: (it.currency || currency).toUpperCase(),
        value: ((Math.round(Number(it.amount) || 0) / 100).toFixed(2))
      },
      quantity: String(Number(it.quantity) || 1),
      category: 'PHYSICAL_GOODS',
      sku: it.sku || undefined
    }));

    const returnUrl = applicationContext.return_url || process.env.PAYPAL_SUCCESS_URL || DEFAULT_SUCCESS_URL;
    const cancelUrl = applicationContext.cancel_url || process.env.PAYPAL_CANCEL_URL || DEFAULT_CANCEL_URL;

    const payload = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: currency,
            value: totalValue,
            breakdown: {
              item_total: { currency_code: currency, value: (totalCents / 100).toFixed(2) },
              shipping: Number(shippingFeeCents) > 0 ? { currency_code: currency, value: shippingValue } : undefined
            }
          },
          items: paypalItems,
          custom_id: metadata?.orderId || undefined,
          reference_id: metadata?.reference || undefined
        }
      ],
      application_context: {
        brand_name: 'CustomWear',
        user_action: 'PAY_NOW',
        shipping_preference: 'NO_SHIPPING',
        return_url: returnUrl,
        cancel_url: cancelUrl
      },
      payer: {
        email_address: customerEmail || req.user?.email || undefined
      }
    };

    const accessToken = await getPayPalAccessToken();

    const order = await httpRequest(
      `${PAYPAL_BASE}/v2/checkout/orders`,
      'POST',
      {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      JSON.stringify(payload)
    );

    const approvalLink = Array.isArray(order?.links)
      ? order.links.find((l) => l.rel === 'approve')?.href
      : null;

    return res.status(200).json({
      success: true,
      orderId: order?.id,
      status: order?.status,
      approveUrl: approvalLink
    });
  } catch (error) {
    console.error('[PayPal] Erreur create-order:', error);
    const message = (error?.data && error?.data?.message) || 'Erreur lors de la création de l\'ordre PayPal';
    return res.status(500).json({ success: false, message, details: error?.data || null });
  }
});

// Capturer un ordre PayPal
// @route   POST /api/paypal/capture-order/:orderId
// @access  Public
router.post('/capture-order/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!orderId) {
      return res.status(400).json({ success: false, message: 'orderId requis' });
    }

    const accessToken = await getPayPalAccessToken();
    const capture = await httpRequest(
      `${PAYPAL_BASE}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
      'POST',
      {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      ''
    );

    return res.status(200).json({
      success: true,
      data: capture
    });
  } catch (error) {
    console.error('[PayPal] Erreur capture-order:', error);
    const message = (error?.data && error?.data?.message) || 'Erreur lors de la capture de l\'ordre PayPal';
    return res.status(500).json({ success: false, message, details: error?.data || null });
  }
});

module.exports = router;