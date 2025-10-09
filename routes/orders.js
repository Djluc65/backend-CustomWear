const express = require('express');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { 
  authenticateToken, 
  requireAdmin, 
  requireModerator 
} = require('../middleware/auth');
const {
  validateOrder
} = require('../middleware/validation');

const router = express.Router();

// @route   POST /api/orders
// @desc    Créer une nouvelle commande
// @access  Private
router.post('/', authenticateToken, validateOrder, async (req, res) => {
  try {
    const { items, shippingAddress, billingAddress, paymentMethod, couponCode } = req.body;
    
    // Vérifier la disponibilité des produits et calculer les prix
    let subtotal = 0;
    let customizationTotal = 0;
    const orderItems = [];

    for (const item of items) {
      const product = await Product.findById(item.productId);
      
      if (!product || product.status !== 'active') {
        return res.status(400).json({
          success: false,
          message: `Produit non disponible: ${item.productId}`
        });
      }

      // Vérifier la variante
      const variant = product.variants.find(v => 
        v.size === item.variant.size && 
        v.color === item.variant.color && 
        v.material === item.variant.material
      );

      if (!variant) {
        return res.status(400).json({
          success: false,
          message: `Variante non disponible pour le produit: ${product.name}`
        });
      }

      if (variant.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Stock insuffisant pour: ${product.name} (${variant.size}, ${variant.color})`
        });
      }

      // Calculer les prix
      const unitPrice = product.salePrice || product.basePrice;
      const itemCustomizationPrice = item.customization ? 
        product.calculateCustomizationPrice(item.customization) : 0;

      const orderItem = {
        product: product._id,
        productName: product.name,
        productImage: product.images[0]?.url || '',
        variant: item.variant,
        quantity: item.quantity,
        unitPrice,
        customization: item.customization || {},
        customizationPrice: itemCustomizationPrice,
        status: 'pending'
      };

      orderItems.push(orderItem);
      subtotal += unitPrice * item.quantity;
      customizationTotal += itemCustomizationPrice * item.quantity;
    }

    // Calculer les frais de livraison (logique simplifiée)
    const shippingCost = subtotal > 50 ? 0 : 5.99;
    
    // Calculer les taxes (exemple: 20% TVA)
    const taxRate = 0.20;
    const taxAmount = (subtotal + customizationTotal + shippingCost) * taxRate;
    
    // Calculer le total
    const totalAmount = subtotal + customizationTotal + shippingCost + taxAmount;

    // Créer la commande
    const order = new Order({
      user: req.user._id,
      items: orderItems,
      pricing: {
        subtotal,
        customizationTotal,
        shipping: shippingCost,
        tax: taxAmount,
        total: totalAmount,
        currency: 'EUR'
      },
      shippingAddress,
      billingAddress,
      payment: {
        method: paymentMethod,
        status: 'pending'
      },
      status: 'pending'
    });

    await order.save();

    // Décrémenter le stock des produits
    for (const item of orderItems) {
      await Product.updateOne(
        { 
          '_id': item.product,
          'variants.size': item.variant.size,
          'variants.color': item.variant.color,
          'variants.material': item.variant.material
        },
        { 
          $inc: { 'variants.$.stock': -item.quantity }
        }
      );
    }

    await order.populate('user', 'firstName lastName email');

    res.status(201).json({
      success: true,
      message: 'Commande créée avec succès',
      data: {
        order
      }
    });

  } catch (error) {
    console.error('Erreur lors de la création de la commande:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   GET /api/orders
// @desc    Obtenir les commandes de l'utilisateur connecté
// @access  Private
router.get('/', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status || '';

    const filter = { user: req.user._id };
    
    if (status) {
      filter.status = status;
    }

    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('user', 'firstName lastName email')
        .select('-__v'),
      Order.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des commandes:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   GET /api/orders/all
// @desc    Obtenir toutes les commandes (Admin/Moderator)
// @access  Private/Admin/Moderator
router.get('/all', authenticateToken, requireModerator, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status || '';
    const search = req.query.search || '';

    const filter = {};
    
    if (status) {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { 'shippingAddress.firstName': { $regex: search, $options: 'i' } },
        { 'shippingAddress.lastName': { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('user', 'firstName lastName email')
        .select('-__v'),
      Order.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des commandes:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   GET /api/orders/:orderId
// @desc    Obtenir une commande par ID
// @access  Private
router.get('/:orderId', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const filter = { _id: orderId };
    
    // Si l'utilisateur n'est pas admin/moderator, limiter aux ses propres commandes
    if (!['admin', 'moderator'].includes(req.user.role)) {
      filter.user = req.user._id;
    }

    const order = await Order.findOne(filter)
      .populate('user', 'firstName lastName email')
      .populate('items.product', 'name images')
      .select('-__v');
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Commande non trouvée'
      });
    }

    res.json({
      success: true,
      data: {
        order
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération de la commande:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   PUT /api/orders/:orderId/status
// @desc    Mettre à jour le statut d'une commande (Admin/Moderator)
// @access  Private/Admin/Moderator
router.put('/:orderId/status', authenticateToken, requireModerator, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, note } = req.body;
    
    const validStatuses = [
      'pending', 'confirmed', 'processing', 'production', 
      'shipped', 'delivered', 'cancelled', 'refunded'
    ];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Statut invalide'
      });
    }

    const order = await Order.findById(orderId);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Commande non trouvée'
      });
    }

    // Mettre à jour le statut
    await order.updateStatus(status, req.user._id, note);

    await order.populate('user', 'firstName lastName email');

    res.json({
      success: true,
      message: 'Statut de la commande mis à jour',
      data: {
        order
      }
    });

  } catch (error) {
    console.error('Erreur lors de la mise à jour du statut:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   PUT /api/orders/:orderId/tracking
// @desc    Ajouter des informations de suivi (Admin/Moderator)
// @access  Private/Admin/Moderator
router.put('/:orderId/tracking', authenticateToken, requireModerator, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { carrier, trackingNumber, trackingUrl } = req.body;
    
    if (!carrier || !trackingNumber) {
      return res.status(400).json({
        success: false,
        message: 'Transporteur et numéro de suivi requis'
      });
    }

    const order = await Order.findById(orderId);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Commande non trouvée'
      });
    }

    // Ajouter les informations de suivi
    await order.addTracking(carrier, trackingNumber, trackingUrl);

    await order.populate('user', 'firstName lastName email');

    res.json({
      success: true,
      message: 'Informations de suivi ajoutées',
      data: {
        order
      }
    });

  } catch (error) {
    console.error('Erreur lors de l\'ajout du suivi:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   POST /api/orders/:orderId/cancel
// @desc    Annuler une commande
// @access  Private
router.post('/:orderId/cancel', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;
    
    const filter = { _id: orderId };
    
    // Si l'utilisateur n'est pas admin/moderator, limiter aux ses propres commandes
    if (!['admin', 'moderator'].includes(req.user.role)) {
      filter.user = req.user._id;
    }

    const order = await Order.findOne(filter);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Commande non trouvée'
      });
    }

    // Vérifier si la commande peut être annulée
    const cancellableStatuses = ['pending', 'confirmed'];
    if (!cancellableStatuses.includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: 'Cette commande ne peut plus être annulée'
      });
    }

    // Annuler la commande
    await order.updateStatus('cancelled', req.user._id, reason || 'Annulée par le client');

    // Remettre en stock les produits
    for (const item of order.items) {
      await Product.updateOne(
        { 
          '_id': item.product,
          'variants.size': item.variant.size,
          'variants.color': item.variant.color,
          'variants.material': item.variant.material
        },
        { 
          $inc: { 'variants.$.stock': item.quantity }
        }
      );
    }

    await order.populate('user', 'firstName lastName email');

    res.json({
      success: true,
      message: 'Commande annulée avec succès',
      data: {
        order
      }
    });

  } catch (error) {
    console.error('Erreur lors de l\'annulation de la commande:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   GET /api/orders/stats/dashboard
// @desc    Obtenir les statistiques des commandes (Admin/Moderator)
// @access  Private/Admin/Moderator
router.get('/stats/dashboard', authenticateToken, requireModerator, async (req, res) => {
  try {
    const stats = await Order.getOrderStats();
    
    res.json({
      success: true,
      data: {
        stats
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

module.exports = router;