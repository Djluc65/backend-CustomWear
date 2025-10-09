const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Le nom du produit est requis'],
    trim: true,
    maxlength: [100, 'Le nom ne peut pas dépasser 100 caractères']
  },
  description: {
    type: String,
    required: [true, 'La description est requise'],
    trim: true,
    maxlength: [2000, 'La description ne peut pas dépasser 2000 caractères']
  },
  shortDescription: {
    type: String,
    trim: true,
    maxlength: [200, 'La description courte ne peut pas dépasser 200 caractères']
  },
  category: {
    type: String,
    required: [true, 'La catégorie est requise'],
    enum: ['t-shirts', 'vestes', 'casquettes', 'vaisselle'],
    lowercase: true
  },
  subcategory: {
    type: String,
    trim: true,
    lowercase: true
  },
  brand: {
    type: String,
    trim: true,
    maxlength: [50, 'La marque ne peut pas dépasser 50 caractères']
  },
  sku: {
    type: String,
    required: [true, 'Le SKU est requis'],
    unique: true,
    trim: true,
    uppercase: true
  },
  images: [{
    url: {
      type: String,
      required: true
    },
    alt: {
      type: String,
      trim: true
    },
    isPrimary: {
      type: Boolean,
      default: false
    },
    color: String // Couleur associée à cette image
  }],
  price: {
    base: {
      type: Number,
      required: [true, 'Le prix de base est requis'],
      min: [0, 'Le prix ne peut pas être négatif']
    },
    sale: {
      type: Number,
      min: [0, 'Le prix de vente ne peut pas être négatif'],
      validate: {
        validator: function(value) {
          return !value || value < this.price.base;
        },
        message: 'Le prix de vente doit être inférieur au prix de base'
      }
    },
    currency: {
      type: String,
      enum: ['EUR', 'USD', 'GBP'],
      default: 'EUR'
    }
  },
  variants: [{
    size: {
      type: String,
      required: true,
      enum: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'Unique']
    },
    color: {
      name: {
        type: String,
        required: true,
        trim: true
      },
      hex: {
        type: String,
        match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Format de couleur hexadécimal invalide']
      }
    },
    material: {
      type: String,
      trim: true
    },
    stock: {
      type: Number,
      required: true,
      min: [0, 'Le stock ne peut pas être négatif'],
      default: 0
    },
    weight: {
      value: Number,
      unit: {
        type: String,
        enum: ['g', 'kg'],
        default: 'g'
      }
    },
    dimensions: {
      length: Number,
      width: Number,
      height: Number,
      unit: {
        type: String,
        enum: ['cm', 'm'],
        default: 'cm'
      }
    },
    priceModifier: {
      type: Number,
      default: 0 // Modificateur de prix pour cette variante
    }
  }],
  customization: {
    isCustomizable: {
      type: Boolean,
      default: false
    },
    options: {
      text: {
        enabled: {
          type: Boolean,
          default: false
        },
        maxLength: {
          type: Number,
          default: 50
        },
        fonts: [{
          name: String,
          price: {
            type: Number,
            default: 0
          }
        }],
        colors: [{
          name: String,
          hex: String,
          price: {
            type: Number,
            default: 0
          }
        }],
        positions: [{
          name: String, // 'front', 'back', 'left-sleeve', etc.
          price: {
            type: Number,
            default: 0
          }
        }]
      },
      image: {
        enabled: {
          type: Boolean,
          default: false
        },
        maxSize: {
          type: Number,
          default: 5 // MB
        },
        allowedFormats: [{
          type: String,
          enum: ['jpg', 'jpeg', 'png', 'svg', 'pdf']
        }],
        positions: [{
          name: String,
          price: {
            type: Number,
            default: 0
          }
        }],
        basePrice: {
          type: Number,
          default: 0
        }
      },
      embroidery: {
        enabled: {
          type: Boolean,
          default: false
        },
        basePrice: {
          type: Number,
          default: 0
        },
        pricePerStitch: {
          type: Number,
          default: 0
        }
      }
    }
  },
  specifications: {
    material: {
      type: String,
      trim: true
    },
    careInstructions: [{
      type: String,
      trim: true
    }],
    features: [{
      type: String,
      trim: true
    }],
    origin: {
      type: String,
      trim: true
    },
    certifications: [{
      name: String,
      description: String
    }]
  },
  seo: {
    metaTitle: {
      type: String,
      trim: true,
      maxlength: [60, 'Le titre meta ne peut pas dépasser 60 caractères']
    },
    metaDescription: {
      type: String,
      trim: true,
      maxlength: [160, 'La description meta ne peut pas dépasser 160 caractères']
    },
    keywords: [{
      type: String,
      trim: true,
      lowercase: true
    }],
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true
    }
  },
  ratings: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  status: {
    type: String,
    enum: ['draft', 'active', 'inactive', 'discontinued'],
    default: 'draft'
  },
  featured: {
    type: Boolean,
    default: false
  },
  isNew: {
    type: Boolean,
    default: true
  },
  newUntil: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 jours
  },
  shipping: {
    weight: {
      value: Number,
      unit: {
        type: String,
        enum: ['g', 'kg'],
        default: 'g'
      }
    },
    dimensions: {
      length: Number,
      width: Number,
      height: Number,
      unit: {
        type: String,
        enum: ['cm', 'm'],
        default: 'cm'
      }
    },
    freeShippingEligible: {
      type: Boolean,
      default: false
    },
    shippingClass: {
      type: String,
      enum: ['standard', 'express', 'fragile', 'oversized'],
      default: 'standard'
    }
  },
  analytics: {
    views: {
      type: Number,
      default: 0
    },
    purchases: {
      type: Number,
      default: 0
    },
    addedToCart: {
      type: Number,
      default: 0
    },
    wishlistAdds: {
      type: Number,
      default: 0
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index pour améliorer les performances
productSchema.index({ category: 1, status: 1 });
productSchema.index({ sku: 1 });
productSchema.index({ 'seo.slug': 1 });
productSchema.index({ featured: 1, status: 1 });
productSchema.index({ status: 1, createdAt: -1 });
productSchema.index({ 'price.base': 1 });
productSchema.index({ 'ratings.average': -1 });
productSchema.index({ tags: 1 });

// Index de recherche textuelle
productSchema.index({
  name: 'text',
  description: 'text',
  'seo.keywords': 'text',
  tags: 'text'
});

// Virtual pour le prix effectif (avec promotion)
productSchema.virtual('effectivePrice').get(function() {
  return this.price.sale || this.price.base;
});

// Virtual pour le pourcentage de réduction
productSchema.virtual('discountPercentage').get(function() {
  if (!this.price.sale) return 0;
  return Math.round(((this.price.base - this.price.sale) / this.price.base) * 100);
});

// Virtual pour vérifier si le produit est en stock
productSchema.virtual('inStock').get(function() {
  return this.variants.some(variant => variant.stock > 0);
});

// Virtual pour le stock total
productSchema.virtual('totalStock').get(function() {
  return this.variants.reduce((total, variant) => total + variant.stock, 0);
});

// Virtual pour l'image principale
productSchema.virtual('primaryImage').get(function() {
  const primary = this.images.find(img => img.isPrimary);
  return primary || this.images[0];
});

// Virtual pour vérifier si le produit est nouveau
productSchema.virtual('isNewProduct').get(function() {
  return this.isNew && this.newUntil > new Date();
});

// Middleware pour générer le slug automatiquement
productSchema.pre('save', function(next) {
  if (this.isModified('name') && !this.seo.slug) {
    this.seo.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});

// Middleware pour s'assurer qu'une seule image principale existe
productSchema.pre('save', function(next) {
  if (this.images && this.images.length > 0) {
    const primaryImages = this.images.filter(img => img.isPrimary);
    if (primaryImages.length > 1) {
      // Garder seulement la première comme principale
      this.images.forEach((img, index) => {
        img.isPrimary = index === 0;
      });
    } else if (primaryImages.length === 0) {
      // Si aucune image principale, définir la première
      this.images[0].isPrimary = true;
    }
  }
  next();
});

// Middleware pour mettre à jour lastModifiedBy
productSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.lastModifiedBy = this.modifiedBy || this.lastModifiedBy;
  }
  next();
});

// Méthode pour obtenir les variantes disponibles
productSchema.methods.getAvailableVariants = function() {
  return this.variants.filter(variant => variant.stock > 0);
};

// Méthode pour obtenir le prix avec personnalisation
productSchema.methods.getCustomizationPrice = function(customizations = {}) {
  let basePrice = this.effectivePrice;
  let customizationPrice = 0;

  if (customizations.text && this.customization.options.text.enabled) {
    // Prix pour le texte (position, couleur, police)
    if (customizations.text.position) {
      const position = this.customization.options.text.positions.find(p => p.name === customizations.text.position);
      if (position) customizationPrice += position.price;
    }
    if (customizations.text.color) {
      const color = this.customization.options.text.colors.find(c => c.name === customizations.text.color);
      if (color) customizationPrice += color.price;
    }
    if (customizations.text.font) {
      const font = this.customization.options.text.fonts.find(f => f.name === customizations.text.font);
      if (font) customizationPrice += font.price;
    }
  }

  if (customizations.image && this.customization.options.image.enabled) {
    customizationPrice += this.customization.options.image.basePrice;
    if (customizations.image.position) {
      const position = this.customization.options.image.positions.find(p => p.name === customizations.image.position);
      if (position) customizationPrice += position.price;
    }
  }

  if (customizations.embroidery && this.customization.options.embroidery.enabled) {
    customizationPrice += this.customization.options.embroidery.basePrice;
    if (customizations.embroidery.stitches) {
      customizationPrice += customizations.embroidery.stitches * this.customization.options.embroidery.pricePerStitch;
    }
  }

  return basePrice + customizationPrice;
};

// Méthode pour incrémenter les vues
productSchema.methods.incrementViews = function() {
  return this.updateOne({ $inc: { 'analytics.views': 1 } });
};

// Méthode pour incrémenter les ajouts au panier
productSchema.methods.incrementCartAdds = function() {
  return this.updateOne({ $inc: { 'analytics.addedToCart': 1 } });
};

// Méthode pour incrémenter les achats
productSchema.methods.incrementPurchases = function(quantity = 1) {
  return this.updateOne({ $inc: { 'analytics.purchases': quantity } });
};

// Méthode statique pour rechercher des produits
productSchema.statics.searchProducts = function(query, options = {}) {
  const {
    category,
    minPrice,
    maxPrice,
    inStock = true,
    featured,
    sortBy = 'createdAt',
    sortOrder = -1,
    page = 1,
    limit = 20
  } = options;

  const searchQuery = { status: 'active' };

  // Recherche textuelle
  if (query) {
    searchQuery.$text = { $search: query };
  }

  // Filtres
  if (category) {
    searchQuery.category = category;
  }

  if (minPrice || maxPrice) {
    searchQuery['price.base'] = {};
    if (minPrice) searchQuery['price.base'].$gte = minPrice;
    if (maxPrice) searchQuery['price.base'].$lte = maxPrice;
  }

  if (inStock) {
    searchQuery['variants.stock'] = { $gt: 0 };
  }

  if (featured !== undefined) {
    searchQuery.featured = featured;
  }

  const skip = (page - 1) * limit;

  return this.find(searchQuery)
    .sort({ [sortBy]: sortOrder })
    .skip(skip)
    .limit(limit)
    .populate('createdBy', 'firstName lastName')
    .populate('lastModifiedBy', 'firstName lastName');
};

module.exports = mongoose.model('Product', productSchema);