const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin, optionalAuth } = require('../middleware/auth');
const CustomizationPricing = require('../models/CustomizationPricing');

// GET /api/customization-pricing - Récupérer la grille tarifaire
router.get('/', optionalAuth, async (req, res) => {
  try {
    const items = await CustomizationPricing.find({}).sort({ type: 1, placement: 1 });
    res.json({ success: true, data: items });
  } catch (err) {
    console.error('[GET customization-pricing] error', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/customization-pricing - Créer/mettre à jour un prix (admin)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { type, placement, price, isActive = true } = req.body || {};
    const allowedTypes = ['text', 'image', 'combo'];
    const allowedPlacements = ['front', 'back', 'both', 'any'];
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({ success: false, message: 'Type invalide' });
    }
    if (!allowedPlacements.includes(placement)) {
      return res.status(400).json({ success: false, message: 'Emplacement invalide' });
    }
    const numericPrice = Number(price);
    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      return res.status(400).json({ success: false, message: 'Prix invalide' });
    }

    const doc = await CustomizationPricing.findOneAndUpdate(
      { type, placement },
      { $set: { price: numericPrice, isActive } },
      { new: true, upsert: true }
    );

    res.json({ success: true, data: doc });
  } catch (err) {
    console.error('[POST customization-pricing] error', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

module.exports = router;