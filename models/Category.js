const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Le nom de la catégorie est requis'],
    trim: true,
    maxlength: [50, 'Le nom ne peut pas dépasser 50 caractères']
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'La description ne peut pas dépasser 500 caractères']
  },
  image: {
    url: String,
    alt: String
  },
  icon: {
    type: String,
    trim: true
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
  level: {
    type: Number,
    default: 0,
    min: 0,
    max: 3
  },
  path: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  sortOrder: {
    type: Number,
    default: 0
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
    }]
  },
  customizationOptions: {
    allowText: {
      type: Boolean,
      default: true
    },
    allowImage: {
      type: Boolean,
      default: true
    },
    allowEmbroidery: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index
// Retirer l’index slug en double: la colonne slug est déjà unique.
categorySchema.index({ parent: 1, sortOrder: 1 });
categorySchema.index({ isActive: 1, sortOrder: 1 });
categorySchema.index({ level: 1 });

// Virtual pour les enfants
categorySchema.virtual('children', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'parent'
});

// Virtual pour le nombre de produits
categorySchema.virtual('productCount', {
  ref: 'Product',
  localField: 'slug',
  foreignField: 'category',
  count: true
});

// Middleware pour générer le slug
categorySchema.pre('save', function(next) {
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});

// Middleware pour calculer le niveau et le chemin
categorySchema.pre('save', async function(next) {
  if (this.isModified('parent')) {
    if (this.parent) {
      const parentCategory = await this.constructor.findById(this.parent);
      if (parentCategory) {
        this.level = parentCategory.level + 1;
        this.path = [...parentCategory.path, parentCategory._id];
      }
    } else {
      this.level = 0;
      this.path = [];
    }
  }
  next();
});

// Méthode pour obtenir la hiérarchie complète
categorySchema.methods.getHierarchy = async function() {
  await this.populate('path');
  return this.path.concat([this]);
};

// Méthode statique pour obtenir l'arbre des catégories
categorySchema.statics.getTree = function() {
  return this.find({ isActive: true })
    .sort({ level: 1, sortOrder: 1 })
    .populate('children');
};

module.exports = mongoose.model('Category', categorySchema);