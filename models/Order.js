const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    variant: {
      size: {
        type: String,
        required: true
      },
      color: {
        name: String,
        hex: String
      },
      material: String
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'La quantité doit être au moins 1']
    },
    unitPrice: {
      type: Number,
      required: true,
      min: [0, 'Le prix unitaire ne peut pas être négatif']
    },
    customization: {
      text: {
        content: String,
        font: String,
        color: String,
        position: String,
        size: Number
      },
      image: {
        url: String,
        position: String,
        size: {
          width: Number,
          height: Number
        }
      },
      embroidery: {
        design: String,
        stitches: Number,
        colors: [String]
      },
      totalCustomizationPrice: {
        type: Number,
        default: 0
      }
    },
    totalPrice: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'in-production', 'ready', 'shipped', 'delivered', 'cancelled'],
      default: 'pending'
    },
    notes: String
  }],
  pricing: {
    subtotal: {
      type: Number,
      required: true,
      min: 0
    },
    customizationTotal: {
      type: Number,
      default: 0,
      min: 0
    },
    shipping: {
      cost: {
        type: Number,
        default: 0,
        min: 0
      },
      method: {
        type: String,
        enum: ['standard', 'express', 'overnight', 'pickup'],
        default: 'standard'
      },
      estimatedDays: {
        type: Number,
        default: 3
      }
    },
    tax: {
      rate: {
        type: Number,
        default: 0.20, // 20% TVA par défaut
        min: 0,
        max: 1
      },
      amount: {
        type: Number,
        default: 0,
        min: 0
      }
    },
    discount: {
      code: String,
      type: {
        type: String,
        enum: ['percentage', 'fixed'],
        default: 'percentage'
      },
      value: {
        type: Number,
        default: 0,
        min: 0
      },
      amount: {
        type: Number,
        default: 0,
        min: 0
      }
    },
    total: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      enum: ['EUR', 'USD', 'GBP'],
      default: 'EUR'
    }
  },
  shippingAddress: {
    firstName: {
      type: String,
      required: true,
      trim: true
    },
    lastName: {
      type: String,
      required: true,
      trim: true
    },
    company: {
      type: String,
      trim: true
    },
    street: {
      type: String,
      required: true,
      trim: true
    },
    city: {
      type: String,
      required: true,
      trim: true
    },
    postalCode: {
      type: String,
      required: true,
      trim: true
    },
    country: {
      type: String,
      required: true,
      trim: true,
      default: 'France'
    },
    phone: {
      type: String,
      trim: true
    },
    instructions: {
      type: String,
      trim: true,
      maxlength: [500, 'Les instructions ne peuvent pas dépasser 500 caractères']
    }
  },
  billingAddress: {
    firstName: {
      type: String,
      required: true,
      trim: true
    },
    lastName: {
      type: String,
      required: true,
      trim: true
    },
    company: {
      type: String,
      trim: true
    },
    street: {
      type: String,
      required: true,
      trim: true
    },
    city: {
      type: String,
      required: true,
      trim: true
    },
    postalCode: {
      type: String,
      required: true,
      trim: true
    },
    country: {
      type: String,
      required: true,
      trim: true,
      default: 'France'
    }
  },
  payment: {
    method: {
      type: String,
      enum: ['card', 'paypal', 'bank-transfer', 'cash-on-delivery'],
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'refunded', 'partially-refunded'],
      default: 'pending'
    },
    transactionId: String,
    paymentIntentId: String, // Pour Stripe
    paypalOrderId: String, // Pour PayPal
    paidAt: Date,
    refunds: [{
      amount: {
        type: Number,
        required: true,
        min: 0
      },
      reason: {
        type: String,
        required: true,
        trim: true
      },
      refundId: String,
      processedAt: {
        type: Date,
        default: Date.now
      },
      processedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    }]
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
    default: 'pending'
  },
  tracking: {
    carrier: String,
    trackingNumber: String,
    trackingUrl: String,
    shippedAt: Date,
    estimatedDelivery: Date,
    deliveredAt: Date,
    updates: [{
      status: String,
      description: String,
      location: String,
      timestamp: {
        type: Date,
        default: Date.now
      }
    }]
  },
  communication: {
    customerNotes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Les notes client ne peuvent pas dépasser 1000 caractères']
    },
    internalNotes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Les notes internes ne peuvent pas dépasser 1000 caractères']
    },
    emails: [{
      type: {
        type: String,
        enum: ['confirmation', 'payment-received', 'processing', 'shipped', 'delivered', 'cancelled'],
        required: true
      },
      sentAt: {
        type: Date,
        default: Date.now
      },
      subject: String,
      template: String
    }]
  },
  timeline: [{
    status: {
      type: String,
      required: true
    },
    description: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    automatic: {
      type: Boolean,
      default: false
    }
  }],
  metadata: {
    source: {
      type: String,
      enum: ['web', 'mobile', 'admin', 'api'],
      default: 'web'
    },
    userAgent: String,
    ipAddress: String,
    referrer: String,
    utm: {
      source: String,
      medium: String,
      campaign: String,
      term: String,
      content: String
    }
  },
  estimatedProductionTime: {
    type: Number, // en jours
    default: 3
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index pour améliorer les performances
// Retirer l’index en double: orderNumber est déjà unique.
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ 'payment.status': 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ 'tracking.trackingNumber': 1 });

// Virtual pour le nom complet de l'adresse de livraison
orderSchema.virtual('shippingAddress.fullName').get(function() {
  return `${this.shippingAddress.firstName} ${this.shippingAddress.lastName}`;
});

// Virtual pour l'adresse de livraison formatée
orderSchema.virtual('shippingAddress.formatted').get(function() {
  const addr = this.shippingAddress;
  return `${addr.street}, ${addr.city} ${addr.postalCode}, ${addr.country}`;
});

// Virtual pour vérifier si la commande peut être annulée
orderSchema.virtual('canBeCancelled').get(function() {
  return ['pending', 'confirmed'].includes(this.status) && 
         ['pending', 'processing'].includes(this.payment.status);
});

// Virtual pour vérifier si la commande peut être remboursée
orderSchema.virtual('canBeRefunded').get(function() {
  return this.payment.status === 'completed' && 
         ['confirmed', 'processing', 'shipped'].includes(this.status);
});

// Virtual pour le montant total remboursé
orderSchema.virtual('totalRefunded').get(function() {
  return this.payment.refunds.reduce((total, refund) => total + refund.amount, 0);
});

// Virtual pour le montant remboursable
orderSchema.virtual('refundableAmount').get(function() {
  return this.pricing.total - this.totalRefunded;
});

// Middleware pour générer le numéro de commande
orderSchema.pre('save', async function(next) {
  if (this.isNew && !this.orderNumber) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    // Compter les commandes du jour
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
    
    const count = await this.constructor.countDocuments({
      createdAt: { $gte: startOfDay, $lt: endOfDay }
    });
    
    const sequence = (count + 1).toString().padStart(4, '0');
    this.orderNumber = `CW${year}${month}${day}${sequence}`;
  }
  next();
});

// Middleware pour calculer les totaux
orderSchema.pre('save', function(next) {
  // Calculer le sous-total
  this.pricing.subtotal = this.items.reduce((total, item) => {
    return total + (item.unitPrice * item.quantity);
  }, 0);

  // Calculer le total de personnalisation
  this.pricing.customizationTotal = this.items.reduce((total, item) => {
    return total + (item.customization?.totalCustomizationPrice || 0);
  }, 0);

  // Calculer la TVA
  const taxableAmount = this.pricing.subtotal + this.pricing.customizationTotal + this.pricing.shipping.cost - this.pricing.discount.amount;
  this.pricing.tax.amount = taxableAmount * this.pricing.tax.rate;

  // Calculer le total
  this.pricing.total = taxableAmount + this.pricing.tax.amount;

  next();
});

// Middleware pour ajouter à la timeline
orderSchema.pre('save', function(next) {
  if (this.isModified('status') && !this.isNew) {
    this.timeline.push({
      status: this.status,
      description: `Statut changé vers: ${this.status}`,
      automatic: true
    });
  }
  next();
});

// Méthode pour ajouter une entrée à la timeline
orderSchema.methods.addTimelineEntry = function(status, description, updatedBy = null) {
  this.timeline.push({
    status,
    description,
    updatedBy,
    automatic: false
  });
  return this.save();
};

// Méthode pour mettre à jour le statut
orderSchema.methods.updateStatus = function(newStatus, description = null, updatedBy = null) {
  this.status = newStatus;
  
  if (description || updatedBy) {
    this.timeline.push({
      status: newStatus,
      description: description || `Statut changé vers: ${newStatus}`,
      updatedBy,
      automatic: !updatedBy
    });
  }

  return this.save();
};

// Méthode pour ajouter des informations de suivi
orderSchema.methods.addTracking = function(carrier, trackingNumber, trackingUrl = null) {
  this.tracking.carrier = carrier;
  this.tracking.trackingNumber = trackingNumber;
  this.tracking.trackingUrl = trackingUrl;
  this.tracking.shippedAt = new Date();
  
  this.status = 'shipped';
  
  return this.save();
};

// Méthode pour marquer comme livré
orderSchema.methods.markAsDelivered = function() {
  this.status = 'delivered';
  this.tracking.deliveredAt = new Date();
  
  return this.save();
};

// Méthode pour traiter un remboursement
orderSchema.methods.processRefund = function(amount, reason, refundId = null, processedBy = null) {
  if (amount > this.refundableAmount) {
    throw new Error('Le montant du remboursement dépasse le montant remboursable');
  }

  this.payment.refunds.push({
    amount,
    reason,
    refundId,
    processedBy
  });

  // Mettre à jour le statut de paiement
  if (this.totalRefunded >= this.pricing.total) {
    this.payment.status = 'refunded';
    this.status = 'refunded';
  } else {
    this.payment.status = 'partially-refunded';
  }

  return this.save();
};

// Méthode pour calculer le temps de production estimé
orderSchema.methods.calculateEstimatedProductionTime = function() {
  let maxTime = 0;
  
  this.items.forEach(item => {
    let itemTime = 1; // Temps de base
    
    // Ajouter du temps pour la personnalisation
    if (item.customization) {
      if (item.customization.text?.content) itemTime += 1;
      if (item.customization.image?.url) itemTime += 2;
      if (item.customization.embroidery?.design) itemTime += 3;
    }
    
    maxTime = Math.max(maxTime, itemTime);
  });
  
  this.estimatedProductionTime = maxTime;
  return maxTime;
};

// Méthode statique pour obtenir les statistiques des commandes
orderSchema.statics.getOrderStats = function(startDate, endDate) {
  const matchStage = {};
  if (startDate || endDate) {
    matchStage.createdAt = {};
    if (startDate) matchStage.createdAt.$gte = new Date(startDate);
    if (endDate) matchStage.createdAt.$lte = new Date(endDate);
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: '$pricing.total' },
        averageOrderValue: { $avg: '$pricing.total' },
        pendingOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
        },
        completedOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] }
        },
        cancelledOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
        }
      }
    }
  ]);
};

// Méthode statique pour rechercher des commandes
orderSchema.statics.searchOrders = function(query, options = {}) {
  const {
    status,
    paymentStatus,
    userId,
    startDate,
    endDate,
    sortBy = 'createdAt',
    sortOrder = -1,
    page = 1,
    limit = 20
  } = options;

  const searchQuery = {};

  // Recherche par numéro de commande ou email
  if (query) {
    searchQuery.$or = [
      { orderNumber: { $regex: query, $options: 'i' } },
      { 'shippingAddress.firstName': { $regex: query, $options: 'i' } },
      { 'shippingAddress.lastName': { $regex: query, $options: 'i' } }
    ];
  }

  // Filtres
  if (status) searchQuery.status = status;
  if (paymentStatus) searchQuery['payment.status'] = paymentStatus;
  if (userId) searchQuery.user = userId;

  if (startDate || endDate) {
    searchQuery.createdAt = {};
    if (startDate) searchQuery.createdAt.$gte = new Date(startDate);
    if (endDate) searchQuery.createdAt.$lte = new Date(endDate);
  }

  const skip = (page - 1) * limit;

  return this.find(searchQuery)
    .sort({ [sortBy]: sortOrder })
    .skip(skip)
    .limit(limit)
    .populate('user', 'firstName lastName email')
    .populate('items.product', 'name images sku');
};

module.exports = mongoose.model('Order', orderSchema);