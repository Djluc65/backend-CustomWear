const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const Product = require('../models/Product');
const { 
  authenticateToken, 
  requireAdmin, 
  requireModerator 
} = require('../middleware/auth');
const {
  validateProfileUpdate,
  validateAddress
} = require('../middleware/validation');

const router = express.Router();

// @route   GET /api/users/profile
// @desc    Obtenir le profil de l'utilisateur connecté
// @access  Private
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const userResponse = req.user.getPublicProfile();
    
    res.json({
      success: true,
      data: {
        user: userResponse
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération du profil:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   PUT /api/users/profile
// @desc    Mettre à jour le profil utilisateur
// @access  Private
router.put('/profile', authenticateToken, validateProfileUpdate, async (req, res) => {
  try {
    const { firstName, lastName, phone, dateOfBirth, preferences } = req.body;
    
    const user = req.user;
    
    // Mettre à jour les champs autorisés
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone) user.phone = phone;
    if (dateOfBirth) user.dateOfBirth = dateOfBirth;
    if (preferences) {
      user.preferences = { ...user.preferences, ...preferences };
    }

    await user.save();

    const userResponse = user.getPublicProfile();

    res.json({
      success: true,
      message: 'Profil mis à jour avec succès',
      data: {
        user: userResponse
      }
    });

  } catch (error) {
    console.error('Erreur lors de la mise à jour du profil:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// =============================
// Wishlist (favoris)
// =============================

// @route   GET /api/users/wishlist
// @desc    Récupérer la wishlist de l'utilisateur connecté
// @access  Private
router.get('/wishlist', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('wishlist')
      .populate({
        path: 'wishlist',
        select: 'name category images price ratings seo'
      });

    res.json({
      success: true,
      data: {
        wishlist: user?.wishlist || []
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération de la wishlist:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   POST /api/users/wishlist/:productId
// @desc    Ajouter un produit à la wishlist
// @access  Private
router.post('/wishlist/:productId', authenticateToken, async (req, res) => {
  try {
    const { productId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(404).json({
        success: false,
        message: 'Produit non trouvé'
      });
    }

    const product = await Product.findOne({ _id: productId, status: 'active' }).select('_id');
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Produit non trouvé ou inactif'
      });
    }

    const user = await User.findById(req.user._id).select('wishlist');
    const alreadyInWishlist = Array.isArray(user.wishlist) && user.wishlist.some(id => id.toString() === productId);

    await User.updateOne({ _id: req.user._id }, { $addToSet: { wishlist: product._id } });

    if (!alreadyInWishlist) {
      await Product.updateOne({ _id: product._id }, { $inc: { 'analytics.wishlistAdds': 1 } });
    }

    res.json({
      success: true,
      message: 'Produit ajouté aux favoris',
      data: { productId }
    });
  } catch (error) {
    console.error('Erreur lors de l\'ajout à la wishlist:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   DELETE /api/users/wishlist/:productId
// @desc    Retirer un produit de la wishlist
// @access  Private
router.delete('/wishlist/:productId', authenticateToken, async (req, res) => {
  try {
    const { productId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(404).json({
        success: false,
        message: 'Produit non trouvé'
      });
    }

    const user = await User.findById(req.user._id).select('wishlist');
    const wasInWishlist = Array.isArray(user.wishlist) && user.wishlist.some(id => id.toString() === productId);

    await User.updateOne({ _id: req.user._id }, { $pull: { wishlist: productId } });

    if (wasInWishlist) {
      // Décrémenter l\'analytics uniquement si le produit était présent
      await Product.updateOne({ _id: productId }, { $inc: { 'analytics.wishlistAdds': -1 } });
    }

    res.json({
      success: true,
      message: 'Produit retiré des favoris',
      data: { productId }
    });
  } catch (error) {
    console.error('Erreur lors du retrait de la wishlist:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   GET /api/users/addresses
// @desc    Obtenir les adresses de l'utilisateur
// @access  Private
router.get('/addresses', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('addresses');
    
    res.json({
      success: true,
      data: {
        addresses: user.addresses
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des adresses:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   POST /api/users/addresses
// @desc    Ajouter une nouvelle adresse
// @access  Private
router.post('/addresses', authenticateToken, validateAddress, async (req, res) => {
  try {
    const { type, firstName, lastName, company, street, city, state, postalCode, country, phone, isDefault } = req.body;
    
    const user = req.user;
    
    // Si cette adresse est définie comme par défaut, retirer le statut par défaut des autres
    if (isDefault) {
      user.addresses.forEach(addr => {
        if (addr.type === type) {
          addr.isDefault = false;
        }
      });
    }

    // Ajouter la nouvelle adresse
    const newAddress = {
      type,
      firstName,
      lastName,
      company,
      street,
      city,
      state,
      postalCode,
      country,
      phone,
      isDefault: isDefault || user.addresses.filter(addr => addr.type === type).length === 0
    };

    user.addresses.push(newAddress);
    await user.save();

    res.status(201).json({
      success: true,
      message: 'Adresse ajoutée avec succès',
      data: {
        address: newAddress
      }
    });

  } catch (error) {
    console.error('Erreur lors de l\'ajout de l\'adresse:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   PUT /api/users/addresses/:addressId
// @desc    Mettre à jour une adresse
// @access  Private
router.put('/addresses/:addressId', authenticateToken, validateAddress, async (req, res) => {
  try {
    const { addressId } = req.params;
    const { type, firstName, lastName, company, street, city, state, postalCode, country, phone, isDefault } = req.body;
    
    const user = req.user;
    const address = user.addresses.id(addressId);
    
    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Adresse non trouvée'
      });
    }

    // Si cette adresse est définie comme par défaut, retirer le statut par défaut des autres
    if (isDefault && !address.isDefault) {
      user.addresses.forEach(addr => {
        if (addr.type === type && addr._id.toString() !== addressId) {
          addr.isDefault = false;
        }
      });
    }

    // Mettre à jour l'adresse
    address.type = type || address.type;
    address.firstName = firstName || address.firstName;
    address.lastName = lastName || address.lastName;
    address.company = company || address.company;
    address.street = street || address.street;
    address.city = city || address.city;
    address.state = state || address.state;
    address.postalCode = postalCode || address.postalCode;
    address.country = country || address.country;
    address.phone = phone || address.phone;
    if (isDefault !== undefined) address.isDefault = isDefault;

    await user.save();

    res.json({
      success: true,
      message: 'Adresse mise à jour avec succès',
      data: {
        address
      }
    });

  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'adresse:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   DELETE /api/users/addresses/:addressId
// @desc    Supprimer une adresse
// @access  Private
router.delete('/addresses/:addressId', authenticateToken, async (req, res) => {
  try {
    const { addressId } = req.params;
    
    const user = req.user;
    const address = user.addresses.id(addressId);
    
    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Adresse non trouvée'
      });
    }

    // Si l'adresse supprimée était par défaut, définir une autre adresse du même type comme par défaut
    if (address.isDefault) {
      const sameTypeAddresses = user.addresses.filter(addr => 
        addr.type === address.type && addr._id.toString() !== addressId
      );
      
      if (sameTypeAddresses.length > 0) {
        sameTypeAddresses[0].isDefault = true;
      }
    }

    user.addresses.pull(addressId);
    await user.save();

    res.json({
      success: true,
      message: 'Adresse supprimée avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de la suppression de l\'adresse:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   GET /api/users
// @desc    Obtenir la liste des utilisateurs (Admin seulement)
// @access  Private/Admin
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const role = req.query.role || '';
    const status = req.query.status || '';

    // Construire le filtre de recherche
    const filter = {};
    
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (role) {
      filter.role = role;
    }
    
    if (status === 'active') {
      filter.isActive = true;
    } else if (status === 'inactive') {
      filter.isActive = false;
    }

    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password -passwordResetToken -passwordResetExpires -loginAttempts -lockUntil')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des utilisateurs:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   GET /api/users/:userId
// @desc    Obtenir un utilisateur par ID (Admin/Moderator)
// @access  Private/Admin/Moderator
router.get('/:userId', authenticateToken, requireModerator, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId)
      .select('-password -passwordResetToken -passwordResetExpires');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    res.json({
      success: true,
      data: {
        user
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération de l\'utilisateur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   PUT /api/users/:userId/status
// @desc    Modifier le statut d'un utilisateur (Admin seulement)
// @access  Private/Admin
router.put('/:userId/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;
    
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Le statut doit être un booléen'
      });
    }

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Empêcher la désactivation de son propre compte
    if (userId === req.user._id.toString() && !isActive) {
      return res.status(400).json({
        success: false,
        message: 'Vous ne pouvez pas désactiver votre propre compte'
      });
    }

    user.isActive = isActive;
    await user.save();

    res.json({
      success: true,
      message: `Utilisateur ${isActive ? 'activé' : 'désactivé'} avec succès`,
      data: {
        user: user.getPublicProfile()
      }
    });

  } catch (error) {
    console.error('Erreur lors de la modification du statut:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   PUT /api/users/:userId/role
// @desc    Modifier le rôle d'un utilisateur (Admin seulement)
// @access  Private/Admin
router.put('/:userId/role', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    
    const validRoles = ['user', 'moderator', 'admin'];
    
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Rôle invalide'
      });
    }

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Empêcher la modification de son propre rôle
    if (userId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Vous ne pouvez pas modifier votre propre rôle'
      });
    }

    user.role = role;
    await user.save();

    res.json({
      success: true,
      message: 'Rôle modifié avec succès',
      data: {
        user: user.getPublicProfile()
      }
    });

  } catch (error) {
    console.error('Erreur lors de la modification du rôle:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

module.exports = router;