const express = require('express');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Category = require('../models/Category');
const { 
  authenticateToken, 
  requireAdmin, 
  requireModerator,
  optionalAuth 
} = require('../middleware/auth');
const {
  validateProduct
} = require('../middleware/validation');

const router = express.Router();

// @route   GET /api/products
// @desc    Obtenir la liste des produits avec filtres et pagination
// @access  Public
router.get('/', optionalAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const search = req.query.search || '';
    const category = req.query.category || '';
    const minPrice = parseFloat(req.query.minPrice) || 0;
    const maxPrice = parseFloat(req.query.maxPrice) || Number.MAX_VALUE;
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const featured = req.query.featured === 'true';
    const inStock = req.query.inStock === 'true';
    const minRating = parseFloat(req.query.minRating) || 0;

    // Construire le filtre de recherche
    const filter = {
      status: 'active'
    };
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }
    
    if (category) {
      filter.category = category;
    }
    
    if (featured) {
      filter.featured = true;
    }
    
    // Filtre de prix sur le prix effectif (price.sale ou price.base)
    filter.$expr = {
      $and: [
        { $gte: [{ $ifNull: ['$price.sale', '$price.base'] }, minPrice] },
        { $lte: [{ $ifNull: ['$price.sale', '$price.base'] }, maxPrice] }
      ]
    };
    
    if (inStock) {
      filter['variants.stock'] = { $gt: 0 };
    }

    // Filtre d'évaluation minimale
    if (minRating > 0) {
      filter['ratings.average'] = { $gte: minRating };
    }

    const skip = (page - 1) * limit;

    // Construire l'objet de tri
    const sort = {};
    sort[sortBy] = sortOrder;

    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .select('-__v'),
     Product.countDocuments(filter)
    ]);

    // Ne pas incrémenter les vues sur la liste pour éviter gonflement artificiel

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des produits:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   GET /api/products/featured
// @desc    Obtenir les produits en vedette
// @access  Public
router.get('/featured', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 8;
    
    const products = await Product.find({
      status: 'active',
      featured: true
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('-__v');

    res.json({
      success: true,
      data: {
        products
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des produits en vedette:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   GET /api/products/categories
// @desc    Obtenir les catégories de produits
// @access  Public
router.get('/categories', async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true })
      .sort({ sortOrder: 1, name: 1 })
      .select('-__v');

    res.json({
      success: true,
      data: {
        categories
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des catégories:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   GET /api/products/:productId
// @desc    Obtenir un produit par ID
// @access  Public
router.get('/:productId', optionalAuth, async (req, res) => {
  try {
    const { productId } = req.params;
    // Valider l'ID pour éviter les erreurs de cast et répondre proprement
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(404).json({
        success: false,
        message: 'Produit non trouvé'
      });
    }
    
    const product = await Product.findOne({
      _id: productId,
      status: 'active'
    })
      .select('-__v');
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Produit non trouvé'
      });
    }

    // Incrémenter les vues
    await product.incrementViews();

    // Calculer si l'utilisateur connecté a liké ce produit
    const likedByUser = !!(req.user && Array.isArray(req.user.wishlist) && req.user.wishlist.some(id => id.toString() === product._id.toString()));

    // Préparer la réponse produit avec le flag likedByUser
    const productResponse = product.toObject();
    productResponse.likedByUser = likedByUser;

    // Obtenir des produits similaires
    const relatedProducts = await Product.find({
      _id: { $ne: productId },
      category: product.category,
      status: 'active'
    })
      .limit(4)
      .select('name seo.slug images price ratings category');

    res.json({
      success: true,
      data: {
        product: productResponse,
        relatedProducts
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération du produit:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   POST /api/products
// @desc    Créer un nouveau produit (Admin/Moderator)
// @access  Private/Admin/Moderator
router.post('/', authenticateToken, requireModerator, validateProduct, async (req, res) => {
  try {
    const productData = {
      ...req.body,
      createdBy: req.user._id
    };

    const product = new Product(productData);
    await product.save();

    await product.populate('category', 'name slug');

    res.status(201).json({
      success: true,
      message: 'Produit créé avec succès',
      data: {
        product
      }
    });

  } catch (error) {
    console.error('Erreur lors de la création du produit:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Données invalides',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   PUT /api/products/:productId
// @desc    Mettre à jour un produit (Admin/Moderator)
// @access  Private/Admin/Moderator
router.put('/:productId', authenticateToken, requireModerator, async (req, res) => {
  try {
    const { productId } = req.params;
    
    const product = await Product.findById(productId);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Produit non trouvé'
      });
    }

    // Mettre à jour les champs autorisés
    const allowedFields = [
      'name', 'description', 'category', 'sku', 'images', 'basePrice', 'salePrice',
      'variants', 'customizationOptions', 'specifications', 'seoTitle', 'seoDescription',
      'seoKeywords', 'tags', 'status', 'isFeatured', 'featuredOrder', 'shipping',
      'isCustomizable'
    ];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        product[field] = req.body[field];
      }
    });

    product.updatedBy = req.user._id;
    await product.save();

    await product.populate('category', 'name slug');

    res.json({
      success: true,
      message: 'Produit mis à jour avec succès',
      data: {
        product
      }
    });

  } catch (error) {
    console.error('Erreur lors de la mise à jour du produit:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Données invalides',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   DELETE /api/products/:productId
// @desc    Supprimer un produit (Admin seulement)
// @access  Private/Admin
router.delete('/:productId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { productId } = req.params;
    
    const product = await Product.findById(productId);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Produit non trouvé'
      });
    }

    // Soft delete - marquer comme inactif au lieu de supprimer
    product.status = 'inactive';
    product.updatedBy = req.user._id;
    await product.save();

    res.json({
      success: true,
      message: 'Produit supprimé avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de la suppression du produit:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   POST /api/products/:productId/reviews
// @desc    Ajouter un avis sur un produit
// @access  Private
router.post('/:productId/reviews', authenticateToken, async (req, res) => {
  try {
    const { productId } = req.params;
    const { rating, comment } = req.body;
    
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'La note doit être entre 1 et 5'
      });
    }

    const product = await Product.findById(productId);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Produit non trouvé'
      });
    }

    // Vérifier si l'utilisateur a déjà laissé un avis
    const existingReview = product.reviews.find(
      review => review.user.toString() === req.user._id.toString()
    );

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'Vous avez déjà laissé un avis pour ce produit'
      });
    }

    // Ajouter l'avis
    const review = {
      user: req.user._id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      rating,
      comment: comment || '',
      date: new Date()
    };

    product.reviews.push(review);

    // Recalculer la note moyenne
    const totalRating = product.reviews.reduce((sum, review) => sum + review.rating, 0);
    product.rating = totalRating / product.reviews.length;

    await product.save();

    res.status(201).json({
      success: true,
      message: 'Avis ajouté avec succès',
      data: {
        review
      }
    });

  } catch (error) {
    console.error('Erreur lors de l\'ajout de l\'avis:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   GET /api/products/:productId/customization-price
// @desc    Calculer le prix de personnalisation
// @access  Public
router.get('/:productId/customization-price', async (req, res) => {
  try {
    const { productId } = req.params;
    const { customizations } = req.query;
    
    if (!customizations) {
      return res.json({
        success: true,
        data: {
          customizationPrice: 0
        }
      });
    }

    const product = await Product.findById(productId);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Produit non trouvé'
      });
    }

    let parsedCustomizations;
    try {
      parsedCustomizations = JSON.parse(customizations);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Format de personnalisation invalide'
      });
    }

    const customizationPrice = product.calculateCustomizationPrice(parsedCustomizations);

    res.json({
      success: true,
      data: {
        customizationPrice
      }
    });

  } catch (error) {
    console.error('Erreur lors du calcul du prix de personnalisation:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

module.exports = router;