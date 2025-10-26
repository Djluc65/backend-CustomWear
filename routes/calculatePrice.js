const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/auth');
const CustomizationPricing = require('../models/CustomizationPricing');

// Defaults if DB empty
const DEFAULTS = {
  text: { front: 5, back: 5, both: 8 },
  image: { front: 10, back: 10, both: 15 },
  combo: { any: 12 },
};

const loadGrid = async () => {
  const rows = await CustomizationPricing.find({ isActive: true });
  const grid = { text: {}, image: {}, combo: {} };
  for (const r of rows) {
    if (r && grid[r.type]) {
      grid[r.type][r.placement] = r.price;
    }
  }
  // Remplir les valeurs par défaut manquantes
  for (const t of ['text','image']) {
    for (const p of ['front','back','both']) {
      if (typeof grid[t][p] !== 'number') grid[t][p] = DEFAULTS[t][p];
    }
  }
  if (typeof grid.combo.any !== 'number') grid.combo.any = DEFAULTS.combo.any;
  return grid;
};

// POST /api/calculate-price - Calculer le prix total basé sur les sélections
router.post('/calculate-price', optionalAuth, async (req, res) => {
  try {
    const { textFront = false, textBack = false, imageFront = false, imageBack = false, baseModelPrice } = req.body || {};

    const grid = await loadGrid();

    // Determine placements
    const textPlacement = textFront && textBack ? 'both' : (textFront ? 'front' : (textBack ? 'back' : null));
    const imagePlacement = imageFront && imageBack ? 'both' : (imageFront ? 'front' : (imageBack ? 'back' : null));

    let textPrice = 0;
    let imagePrice = 0;
    let comboApplied = false;
    let textSavings = 0;
    let imageSavings = 0;

    if (textPlacement) {
      textPrice = grid.text[textPlacement];
      if (textPlacement === 'both') {
        const singles = (grid.text.front + grid.text.back);
        textSavings = Math.max(0, singles - textPrice);
      }
    }
    if (imagePlacement) {
      imagePrice = grid.image[imagePlacement];
      if (imagePlacement === 'both') {
        const singles = (grid.image.front + grid.image.back);
        imageSavings = Math.max(0, singles - imagePrice);
      }
    }

    // Appliquer le prix combiné E si texte et image sont sélectionnés
    let customizationPrice = Number((textPrice + imagePrice).toFixed(2));
    if (textPlacement && imagePlacement && typeof grid.combo?.any === 'number') {
      customizationPrice = Number((grid.combo.any).toFixed(2));
      comboApplied = true;
    }

    const base = Number(baseModelPrice);
    const hasBase = Number.isFinite(base) && base >= 0;
    const grandTotal = hasBase ? Number((base + customizationPrice).toFixed(2)) : undefined;

    return res.json({
      success: true,
      data: {
        selections: { textFront, textBack, imageFront, imageBack },
        grid,
        details: {
          textPlacement: textPlacement || 'none',
          imagePlacement: imagePlacement || 'none',
          textPrice,
          imagePrice,
          combo: { applied: comboApplied, price: comboApplied ? grid.combo.any : null },
          savings: {
            text: textSavings,
            image: imageSavings,
            total: Number((textSavings + imageSavings).toFixed(2)),
          },
        },
        totals: {
          customizationPrice,
          baseModelPrice: hasBase ? base : null,
          grandTotal: hasBase ? grandTotal : null,
        }
      }
    });
  } catch (err) {
    console.error('[POST calculate-price] error', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

module.exports = router;