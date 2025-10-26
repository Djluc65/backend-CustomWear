const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin, requireModerator } = require('../middleware/auth');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Category = require('../models/Category');
const multer = require('multer');
const cloudinary = require('../config/cloudinary');

// Utiliser un stockage mémoire pour fiabiliser et gérer le retry Cloudinary
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 10 }
});

// Options d'upload Cloudinary communes
const CLOUDINARY_UPLOAD_OPTIONS = {
  folder: 'customwear/products',
  transformation: [
    { width: 1200, height: 1200, crop: 'limit' },
    { quality: 'auto' },
    { fetch_format: 'auto' }
  ]
};

// Upload avec retry exponentiel sur erreurs 5xx Cloudinary
const uploadToCloudinaryWithRetry = async (file, options = {}, maxRetries = 2) => {
  const dataUri = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
  let attempt = 0;
  while (true) {
    try {
      return await cloudinary.uploader.upload(dataUri, options);
    } catch (err) {
      const msg = err?.message || '';
      const code = err?.http_code || err?.status || 0;
      const is5xx = (typeof code === 'number' && code >= 500 && code < 600) || /status code - 5\d{2}/.test(msg);
      if (!is5xx || attempt >= maxRetries) throw err;
      const delayMs = 500 * Math.pow(2, attempt);
      await new Promise(r => setTimeout(r, delayMs));
      attempt += 1;
    }
  }
};

// @desc    Obtenir les statistiques du dashboard admin
// @route   GET /api/admin/stats
// @access  Private/Admin/Moderator
router.get('/stats', authenticateToken, requireModerator, async (req, res) => {
  try {
    // Statistiques des utilisateurs
    const totalUsers = await User.countDocuments();
    const newUsersThisMonth = await User.countDocuments({
      createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }
    });
    const activeUsers = await User.countDocuments({ status: 'active' });

    // Statistiques des produits
    const totalProducts = await Product.countDocuments();
    const activeProducts = await Product.countDocuments({ status: 'active' });
    const lowStockProducts = await Product.countDocuments({ stock: { $lt: 10 } });

    // Statistiques des commandes
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ status: 'pending' });
    const completedOrders = await Order.countDocuments({ status: 'delivered' });
    const ordersThisMonth = await Order.countDocuments({
      createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }
    });

    // Calcul du chiffre d'affaires
    const revenueResult = await Order.aggregate([
      { $match: { status: { $in: ['paid', 'shipped', 'delivered'] } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

    const monthlyRevenueResult = await Order.aggregate([
      {
        $match: {
          status: { $in: ['paid', 'shipped', 'delivered'] },
          createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }
        }
      },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    const monthlyRevenue = monthlyRevenueResult.length > 0 ? monthlyRevenueResult[0].total : 0;

    // Commandes récentes
    const recentOrders = await Order.find()
      .populate('user', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(5)
      .select('_id orderNumber totalAmount status createdAt user');

    // Produits les plus vendus
    const topProducts = await Order.aggregate([
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          totalSold: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } }
        }
      },
      { $sort: { totalSold: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'productInfo'
        }
      },
      { $unwind: '$productInfo' },
      {
        $project: {
          _id: 1,
          name: '$productInfo.name',
          image: '$productInfo.images.0',
          totalSold: 1,
          revenue: 1
        }
      }
    ]);

    // Évolution mensuelle des ventes (6 derniers mois)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlySales = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: sixMonthsAgo },
          status: { $in: ['paid', 'shipped', 'delivered'] }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          orders: { $sum: 1 },
          revenue: { $sum: '$totalAmount' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          totalUsers,
          newUsersThisMonth,
          activeUsers,
          totalProducts,
          activeProducts,
          lowStockProducts,
          totalOrders,
          pendingOrders,
          completedOrders,
          ordersThisMonth,
          totalRevenue,
          monthlyRevenue
        },
        recentOrders,
        topProducts,
        monthlySales
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des statistiques'
    });
  }
});

// @desc    Obtenir tous les utilisateurs (admin)
// @route   GET /api/admin/users
// @access  Private/Admin
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const role = req.query.role || '';

    const skip = (page - 1) * limit;

    // Construction de la requête de recherche
    let query = {};
    
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (role) {
      query.role = role;
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalCount = await User.countDocuments(query);
    const totalPages = Math.ceil(totalCount / limit);

    // Ajouter les statistiques de commandes pour chaque utilisateur
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const orderCount = await Order.countDocuments({ user: user._id });
        const totalSpentResult = await Order.aggregate([
          { $match: { user: user._id, status: { $in: ['paid', 'shipped', 'delivered'] } } },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]);
        const totalSpent = totalSpentResult.length > 0 ? totalSpentResult[0].total : 0;

        return {
          ...user.toObject(),
          orderCount,
          totalSpent
        };
      })
    );

    res.json({
      success: true,
      data: {
        users: usersWithStats,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des utilisateurs:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des utilisateurs'
    });
  }
});

// @desc    Mettre à jour le statut d'un utilisateur
// @route   PUT /api/admin/users/:id/status
// @access  Private/Admin
router.put('/users/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['active', 'inactive', 'suspended'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Statut invalide'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    res.json({
      success: true,
      data: { user },
      message: 'Statut utilisateur mis à jour avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du statut utilisateur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la mise à jour du statut'
    });
  }
});

// @desc    Obtenir toutes les commandes (admin)
// @route   GET /api/admin/orders
// @access  Private/Admin
router.get('/orders', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const status = req.query.status || '';

    const skip = (page - 1) * limit;

    // Construction de la requête de recherche
    let query = {};
    
    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status) {
      query.status = status;
    }

    const orders = await Order.find(query)
      .populate('user', 'firstName lastName email')
      .populate('items.product', 'name images')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalCount = await Order.countDocuments(query);
    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des commandes:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des commandes'
    });
  }
});

// @desc    Mettre à jour le statut d'une commande
// @route   PUT /api/admin/orders/:id/status
// @access  Private/Admin
router.put('/orders/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    
    const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Statut invalide'
      });
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { 
        status,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    ).populate('user', 'firstName lastName email');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Commande non trouvée'
      });
    }

    res.json({
      success: true,
      data: { order },
      message: 'Statut de la commande mis à jour avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du statut de la commande:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la mise à jour du statut'
    });
  }
});

// @desc    Récupérer tous les produits (admin)
// @route   GET /api/admin/products
// @access  Private/Admin
router.get('/products', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const { search, category, status, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    
    // Construction du filtre
    let filter = {};
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (category && category !== 'all') {
      filter.category = category;
    }
    
    if (status && status !== 'all') {
      filter.status = status;
    }
    
    // Construction du tri
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    const totalCount = await Product.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / limit);
    
    const products = await Product.find(filter)
      .populate('category', 'name')
      .sort(sortOptions)
      .skip(skip)
      .limit(limit);
    
    res.json({
      success: true,
      data: {
        products,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des produits:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des produits'
    });
  }
});

// @desc    Créer un nouveau produit
// @route   POST /api/admin/products
// @access  Private/Admin
router.post('/products', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Log minimal et non sensible
    console.log('[ADMIN] POST /products');
    const {
      name,
      description,
      price,
      category,
      images,
      sizes,
      colors,
      materials,
      sku,
      stock,
      status = 'active',
      gender
    } = req.body;
    
    // Vérification des champs requis
    if (!name || !description || !price || !category) {
      return res.status(400).json({
        success: false,
        message: 'Les champs nom, description, prix et catégorie sont requis'
      });
    }
    
    // Vérifier si le SKU existe déjà
    if (sku) {
      const existingProduct = await Product.findOne({ sku });
      if (existingProduct) {
        return res.status(400).json({
          success: false,
          message: 'Ce SKU existe déjà'
        });
      }
    }
    
    // Normaliser la catégorie aux valeurs autorisées par le schéma
    const allowedCategories = ['t-shirts', 'vestes', 'casquettes', 'bonnets', 'vaisselle'];
    let normalizedCategory = (category || '').toLowerCase();
    if (normalizedCategory === 'tshirts') normalizedCategory = 't-shirts';
    if (normalizedCategory === 'hoodies') normalizedCategory = 'vestes';
    if (normalizedCategory === 'polos') normalizedCategory = 't-shirts';
    if (!allowedCategories.includes(normalizedCategory)) {
      console.warn('[ADMIN] Catégorie invalide:', { input: category, normalizedCategory });
      return res.status(400).json({
        success: false,
        message: `Catégorie invalide. Valeurs autorisées: ${allowedCategories.join(', ')}`
      });
    }

    // Normaliser/valider le genre
    const allowedGenders = ['unisexe', 'homme', 'femme', 'enfant'];
    let normalizedGender = (gender || 'unisexe').toLowerCase();
    if (!allowedGenders.includes(normalizedGender)) {
      return res.status(400).json({
        success: false,
        message: `Genre invalide. Valeurs autorisées: ${allowedGenders.join(', ')}`
      });
    }

    // Mapper les images en supportant chaînes et objets { url, publicId?, ... }
    const mappedImages = Array.isArray(images)
      ? images
          .map((item, idx) => {
            if (typeof item === 'string') {
              return { url: item, isPrimary: idx === 0 };
            }
            if (item && typeof item === 'object') {
              const url = item.url || '';
              if (!url) return null;
              return {
                url,
                alt: item.alt,
                color: item.color,
                side: (typeof item.side === 'string') ? item.side.toLowerCase() : undefined,
                publicId: item.publicId || item.public_id,
                isPrimary: idx === 0
              };
            }
            return null;
          })
          .filter(Boolean)
      : [];
    console.log('[ADMIN] Images mappées:', { count: mappedImages.length, primary: mappedImages[0]?.url });

    // Mapper le prix vers l’objet attendu { base, sale?, currency? }
    let mappedPrice;
    if (typeof price === 'number') {
      mappedPrice = { base: price };
    } else if (price && typeof price === 'object') {
      const base = Number(price.base);
      if (Number.isNaN(base)) {
        console.warn('[ADMIN] Prix invalide (base NaN):', price);
        return res.status(400).json({
          success: false,
          message: 'Prix invalide'
        });
      }
      mappedPrice = {
        base,
        sale: price.sale,
        currency: price.currency
      };
    } else {
      console.warn('[ADMIN] Format de prix invalide:', { priceType: typeof price, price });
      return res.status(400).json({
        success: false,
        message: 'Format de prix invalide'
      });
    }

    // Normaliser tailles et couleurs
    const allowedSizes = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', 'Unique'];
    const normalizeSize = (s) => {
      const t = (s || '').toString().toUpperCase().replace(/\s+/g, '');
      if (t === 'XXL') return '2XL';
      if (t === 'XXXL') return '3XL';
      return allowedSizes.includes(t) ? t : null;
    };
    const normalizedSizes = Array.isArray(sizes)
      ? Array.from(new Set(sizes.map(normalizeSize).filter(Boolean)))
      : [];
    const normalizedColors = Array.isArray(colors)
      ? Array.from(new Set(colors.filter(Boolean)))
      : [];

    const product = new Product({
      name,
      description,
      price: mappedPrice,
      category: normalizedCategory,
      gender: normalizedGender,
      images: mappedImages,
      sizes: normalizedSizes,
      colors: normalizedColors,
      materials: materials || [],
      sku: (sku || `PROD-${Date.now()}`).toUpperCase(),
      status,
      createdBy: req.user._id
    });

    // Générer les variantes tailles x couleurs
    const colorsForVariants = normalizedColors.length ? normalizedColors : ['Standard'];
    const sizesForVariants = normalizedSizes.length ? normalizedSizes : ['Unique'];
    product.variants = [];
    for (const sz of sizesForVariants) {
      for (const colorName of colorsForVariants) {
        product.variants.push({ size: sz, color: { name: colorName }, material: 'Default', stock: 0 });
      }
    }

    // Appliquer le stock global: affecter au premier variant si fourni
    const initialStock = Number(stock);
    if (!Number.isNaN(initialStock) && product.variants.length > 0) {
      product.variants[0].stock = initialStock;
    }
    console.log('[ADMIN] Sauvegarde du produit en base...', {
      name: product.name,
      sku: product.sku,
      category: product.category,
      price: product.price,
      gender: product.gender
    });
    
    await product.save();
    console.log('[ADMIN] Produit créé avec succès:', { id: product._id, createdAt: product.createdAt });

    res.status(201).json({
      success: true,
      data: product,
      message: 'Produit créé avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la création du produit:', error?.message);
    if (error?.stack) console.error(error.stack);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la création du produit'
    });
  }
});

// @desc    Mettre à jour un produit
// @route   PUT /api/admin/products/:id
// @access  Private/Admin
router.put('/products/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    console.log('[ADMIN] PUT /products/:id', { id: req.params.id });
    const {
      name,
      description,
      price,
      category,
      images,
      sizes,
      colors,
      materials,
      sku,
      stock,
      status,
      gender
    } = req.body;
    
    const product = await Product.findById(req.params.id);
    if (!product) {
      console.warn('[ADMIN] Produit non trouvé pour mise à jour:', req.params.id);
      return res.status(404).json({ success: false, message: 'Produit non trouvé' });
    }
    
    if (sku && sku !== product.sku) {
      const existingProduct = await Product.findOne({ sku, _id: { $ne: req.params.id } });
      if (existingProduct) {
        console.warn('[ADMIN] Conflit de SKU lors de la mise à jour:', { sku, id: req.params.id });
        return res.status(400).json({ success: false, message: 'Ce SKU existe déjà' });
      }
    }
    
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) updateData.price = price;
    if (category !== undefined) updateData.category = category;
    if (images !== undefined) updateData.images = images;
    if (sizes !== undefined) updateData.sizes = sizes;
    if (colors !== undefined) updateData.colors = colors;
    if (materials !== undefined) updateData.materials = materials;
    if (sku !== undefined) updateData.sku = sku;
    if (status !== undefined) updateData.status = status;
    if (gender !== undefined) {
      const allowedGenders = ['unisexe', 'homme', 'femme', 'enfant'];
      const normalizedGender = (gender || '').toLowerCase();
      if (!allowedGenders.includes(normalizedGender)) {
        return res.status(400).json({ success: false, message: `Genre invalide. Valeurs autorisées: ${allowedGenders.join(', ')}` });
      }
      updateData.gender = normalizedGender;
    }
    console.log('[ADMIN] Données de mise à jour préparées:', Object.keys(updateData));

    const updateOps = { $set: updateData };
    if (stock !== undefined) {
      const newStock = Number(stock);
      if (!Number.isNaN(newStock)) {
        if (Array.isArray(product.variants) && product.variants.length > 0) {
          updateOps.$set = { ...updateOps.$set, ['variants.0.stock']: newStock };
        } else {
          updateOps.$set = {
            ...updateOps.$set,
            variants: [{ size: 'Unique', color: { name: 'Standard' }, material: 'Default', stock: newStock }]
          };
        }
      }
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      updateOps,
      { new: true, runValidators: true }
    );
    
    res.json({ success: true, data: updatedProduct, message: 'Produit mis à jour avec succès' });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du produit:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur lors de la mise à jour du produit' });
  }
});

// @desc    Supprimer un produit
// @route   DELETE /api/admin/products/:id
// @access  Private/Admin
router.delete('/products/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Produit non trouvé'
      });
    }
    
    // Vérifier s'il y a des commandes en cours avec ce produit
    const activeOrders = await Order.countDocuments({
      'items.product': req.params.id,
      status: { $in: ['pending', 'processing', 'shipped'] }
    });
    
    if (activeOrders > 0) {
      return res.status(400).json({
        success: false,
        message: 'Impossible de supprimer ce produit car il est présent dans des commandes en cours'
      });
    }
    
    // Supprimer les assets Cloudinary liés (si publicId présent)
    try {
      const imagePublicIds = (product.images || [])
        .map(img => img.publicId)
        .filter(Boolean);
      if (imagePublicIds.length) {
        await Promise.all(
          imagePublicIds.map(pid => cloudinary.uploader.destroy(pid).catch(() => {}))
        );
      }
    } catch (cleanupErr) {
      console.warn('[ADMIN] Échec de nettoyage Cloudinary pour le produit:', req.params.id, cleanupErr?.message);
    }

    await Product.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: 'Produit supprimé avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la suppression du produit:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la suppression du produit'
    });
  }
});

// @desc    Upload d'images de produit vers Cloudinary
// @route   POST /api/admin/uploads
// @access  Private/Admin
router.post('/uploads', authenticateToken, requireAdmin, upload.array('images', 10), async (req, res) => {
  try {
    const files = req.files || [];
    console.log('[ADMIN] POST /uploads - fichiers reçus:', files.map(f => ({ name: f.originalname, size: f.size })));
    if (!files.length) {
      return res.status(400).json({
        success: false,
        message: 'Aucune image fournie'
      });
    }

    // Uploader chaque fichier vers Cloudinary avec retry
    const assets = [];
    for (const file of files) {
      const result = await uploadToCloudinaryWithRetry(file, CLOUDINARY_UPLOAD_OPTIONS, 2);
      assets.push({
        url: result.secure_url || result.url,
        public_id: result.public_id
      });
    }

    res.status(200).json({
      success: true,
      data: { urls: assets.map(a => a.url), assets },
      message: 'Images uploadées avec succès'
    });
  } catch (error) {
    console.error('Erreur upload Cloudinary:', error?.message);
    if (error?.stack) console.error(error.stack);
    const code = error?.http_code || error?.status;
    const is5xx = typeof code === 'number' && code >= 500 && code < 600;
    res.status(is5xx ? 503 : 500).json({
      success: false,
      message: is5xx ? 'Service Cloudinary temporairement indisponible' : 'Erreur serveur lors de l\'upload des images'
    });
  }
});

module.exports = router;