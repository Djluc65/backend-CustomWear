const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/auth');
const Customization = require('../models/Customization');
const Product = require('../models/Product');

// Créer une personnalisation
router.post('/', optionalAuth, async (req, res) => {
  try {
    const {
      productId,
      productType,
      productColor,
      text,
      image,
      background
    } = req.body || {};

    let product = null;
    if (productId) {
      product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ message: 'Produit introuvable' });
      }
    }

    // Validation simple
    if (!product && !productType) {
      return res.status(400).json({ message: 'productId ou productType requis' });
    }

    // Validation taille image (approx, base64)
    if (image?.dataUrl) {
      const base64Length = image.dataUrl.length;
      const sizeInMB = (base64Length * 3) / 4 / (1024 * 1024); // estimation
      if (sizeInMB > 10) {
        return res.status(413).json({ message: 'Image trop volumineuse (>10MB)' });
      }
    }

    // Calcul prix de personnalisation si produit fourni
    let totalPrice = 0;
    if (product) {
      const customizations = {};
      if (text?.side) {
        customizations.text = {
          position: text.side,
          color: text.color,
          font: text.font
        };
      }
      if (image?.side) {
        customizations.image = {
          position: image.side
        };
      }
      try {
        totalPrice = product.getCustomizationPrice(customizations);
      } catch (e) {
        // Ne pas bloquer si méthode échoue
        totalPrice = product.effectivePrice || (product.price?.sale ?? product.price?.base ?? 0);
      }
    }

    const doc = await Customization.create({
      user: req.user?._id,
      product: product?._id,
      productType,
      productColor,
      text,
      image,
      background,
      totalPrice
    });

    return res.status(201).json({
      message: 'Personnalisation sauvegardée',
      data: { id: doc._id, customization: doc }
    });
  } catch (error) {
    console.error('[customizations] POST / error', error);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
});

// Récupérer une personnalisation
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const doc = await Customization.findById(req.params.id).populate('product').populate('user', 'firstName lastName email');
    if (!doc) return res.status(404).json({ message: 'Personnalisation introuvable' });
    return res.json({ data: doc });
  } catch (error) {
    console.error('[customizations] GET /:id error', error);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
});

module.exports = router;