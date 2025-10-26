const mongoose = require('mongoose');

const ALLOWED_GENDERS = ['unisexe', 'homme', 'femme', 'enfant'];

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
    enum: ['t-shirts', 'vestes', 'casquettes', 'bonnets', 'vaisselle'],
    lowercase: true
  },
  gender: {
    type: String,
    enum: ALLOWED_GENDERS,
    default: 'unisexe',
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
    color: String,
    side: {
      type: String,
      enum: ['front', 'back'],
      lowercase: true
    },
    publicId: {
      type: String,
      trim: true
    }
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
  sizes: [{ type: String, enum: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', 'Unique'] }],
  variants: [{
    size: {
      type: String,
      required: true,
      enum: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', 'XXL', 'XXXL', 'Unique']
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
    default: function() {
      const date = new Date(this.createdAt || Date.now());
      date.setDate(date.getDate() + 30);
      return date;
    }
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

productSchema.index({ category: 1, status: 1 });
productSchema.index({ featured: 1, status: 1 });
productSchema.index({ status: 1, createdAt: -1 });
productSchema.index({ 'price.base': 1 });
productSchema.index({ 'ratings.average': -1 });
productSchema.index({ tags: 1 });
productSchema.index({ gender: 1 });

productSchema.index({
  name: 'text',
  description: 'text',
  'seo.keywords': 'text',
  tags: 'text'
});

productSchema.virtual('effectivePrice').get(function() {
  return typeof this.price?.sale === 'number' && this.price.sale > 0 && this.price.sale < this.price.base
    ? this.price.sale
    : this.price.base;
});

productSchema.virtual('discountPercentage').get(function() {
  if (typeof this.price?.sale !== 'number' || this.price.sale <= 0) return 0;
  return Math.round((1 - (this.price.sale / this.price.base)) * 100);
});

productSchema.virtual('inStock').get(function() {
  return (Array.isArray(this.variants) && this.variants.some(v => (v.stock || 0) > 0)) || false;
});

productSchema.virtual('totalStock').get(function() {
  return Array.isArray(this.variants) ? this.variants.reduce((acc, v) => acc + (v.stock || 0), 0) : 0;
});

productSchema.virtual('primaryImage').get(function() {
  const primary = Array.isArray(this.images) ? this.images.find(i => i.isPrimary) : null;
  return primary || (Array.isArray(this.images) ? this.images[0] : null) || null;
});

productSchema.virtual('isNewProduct').get(function() {
  const now = new Date();
  return this.isNew && this.newUntil && this.newUntil > now;
});

productSchema.pre('save', function(next) {
  if (this.isModified('name')) {
    const baseSlug = (this.name || '').toString()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    this.seo = this.seo || {};
    this.seo.slug = baseSlug;
  }
  next();
});

productSchema.pre('save', function(next) {
  if (this.isModified('gender') && this.gender) {
    this.gender = this.gender.toLowerCase();
    if (!ALLOWED_GENDERS.includes(this.gender)) {
      return next(new Error(`Genre invalide. Autorisés: ${ALLOWED_GENDERS.join(', ')}`));
    }
  }
  next();
});

productSchema.pre('save', function(next) {
  if (this.isModified('price') && this.price?.sale && this.price?.base && this.price.sale >= this.price.base) {
    return next(new Error('Le prix de vente doit être inférieur au prix de base'));
  }
  next();
});

productSchema.methods.getAvailableVariants = function() {
  return (Array.isArray(this.variants) ? this.variants.filter(v => (v.stock || 0) > 0) : []);
};

productSchema.methods.getCustomizationPrice = function(customizations = {}) {
  const options = this.customization?.options || {};
  let price = 0;
  if (options.text?.enabled && customizations.text) {
    price += options.text.basePrice || 0;
  }
  if (options.image?.enabled && customizations.image) {
    price += options.image.basePrice || 0;
  }
  if (options.embroidery?.enabled && customizations.embroidery) {
    price += options.embroidery.basePrice || 0;
  }
  return price;
};

productSchema.methods.incrementViews = function() {
  this.analytics = this.analytics || {};
  this.analytics.views = (this.analytics.views || 0) + 1;
};

productSchema.methods.incrementCartAdds = function() {
  this.analytics = this.analytics || {};
  this.analytics.addedToCart = (this.analytics.addedToCart || 0) + 1;
};

productSchema.methods.incrementPurchases = function(quantity = 1) {
  this.analytics = this.analytics || {};
  this.analytics.purchases = (this.analytics.purchases || 0) + quantity;
};

productSchema.statics.searchProducts = function(query, options = {}) {
  const page = Math.max(1, parseInt(options.page, 10) || 1);
  const limit = Math.max(1, Math.min(50, parseInt(options.limit, 10) || 10));
  const skip = (page - 1) * limit;

  const filter = { status: 'active' };
  if (query?.search) {
    filter.$text = { $search: query.search };
  }
  if (query?.category) {
    filter.category = query.category;
  }
  if (query?.gender) {
    filter.gender = query.gender;
  }

  const sort = {};
  const sortBy = options.sortBy || 'createdAt';
  const sortOrder = options.sortOrder === 'asc' ? 1 : -1;
  sort[sortBy] = sortOrder;

  return this.find(filter)
    .sort(sort)
    .skip(skip)
    .limit(limit);
};

module.exports = mongoose.model('Product', productSchema);