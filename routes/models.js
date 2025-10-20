const express = require('express');
const router = express.Router();
const ProductModel = require('../models/ProductModel');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Créer un modèle (admin)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, type, category, gender, basePrice, sizes, colors, images, imagesByColor, active } = req.body;

    if (!name || !type || !category || !gender || !basePrice || !sizes || !colors || !images || !images.front || !images.back) {
      return res.status(400).json({ success: false, message: 'Champs requis manquants' });
    }

    const model = await ProductModel.create({
      name,
      type,
      category,
      gender,
      basePrice,
      sizes,
      colors,
      images,
      imagesByColor: imagesByColor || {},
      active: active !== undefined ? active : true,
      createdBy: req.user?._id,
    });

    res.status(201).json({ success: true, data: model });
  } catch (error) {
    console.error('Erreur création modèle:', error);
    res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
  }
});

// Lister tous les modèles (public)
router.get('/', async (req, res) => {
  try {
    const { active, type, gender, category, color, size } = req.query;
    const filter = {};
    if (active !== undefined) {
      filter.active = active === 'true';
    }
    if (type) filter.type = type;
    if (gender) filter.gender = gender;
    if (category) filter.category = category;
    if (color) filter.colors = { $in: Array.isArray(color) ? color : [color] };
    if (size) filter.sizes = { $in: Array.isArray(size) ? size : [size] };

    const models = await ProductModel.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, data: models });
  } catch (error) {
    console.error('Erreur liste modèles:', error);
    res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
  }
});

// Obtenir un modèle par ID (public)
router.get('/:id', async (req, res) => {
  try {
    const model = await ProductModel.findById(req.params.id);
    if (!model) return res.status(404).json({ success: false, message: 'Modèle non trouvé' });
    res.json({ success: true, data: model });
  } catch (error) {
    console.error('Erreur get modèle:', error);
    res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
  }
});

// Mettre à jour un modèle (admin)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const updates = req.body;
    const model = await ProductModel.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!model) return res.status(404).json({ success: false, message: 'Modèle non trouvé' });
    res.json({ success: true, data: model });
  } catch (error) {
    console.error('Erreur update modèle:', error);
    res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
  }
});

// Supprimer un modèle (admin)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const model = await ProductModel.findByIdAndDelete(req.params.id);
    if (!model) return res.status(404).json({ success: false, message: 'Modèle non trouvé' });
    res.json({ success: true, message: 'Modèle supprimé' });
  } catch (error) {
    console.error('Erreur delete modèle:', error);
    res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
  }
});

module.exports = router;