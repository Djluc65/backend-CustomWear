const mongoose = require('mongoose');

const ALLOWED_TYPES = ['t-shirt', 'sweat', 'hoodie', 'casquette', 'mug'];
const ALLOWED_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];
const ALLOWED_COLORS = ['Noir', 'Blanc', 'Bleu', 'Vert', 'Jaune', 'Rouge', 'Mauve', 'Rose', 'Marron'];
// Ajout des genres supportés
const ALLOWED_GENDERS = ['unisexe', 'homme', 'femme', 'enfant'];

const ImagesSchema = new mongoose.Schema({
  front: { type: String, required: true },
  back: { type: String, required: true },
}, { _id: false });

const ProductModelSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  type: { type: String, enum: ALLOWED_TYPES, required: true },
  // Nouvelle catégorie libre (optionnellement, on pourra lier à Category par slug)
  category: { type: String, trim: true, required: true },
  // Nouveau genre contraint aux valeurs demandées
  gender: { type: String, enum: ALLOWED_GENDERS, required: true },
  basePrice: { type: Number, required: true, min: 0 },
  sizes: [{ type: String, enum: ALLOWED_SIZES, required: true }],
  colors: [{ type: String, enum: ALLOWED_COLORS, required: true }],
  images: { type: ImagesSchema, required: true },
  // Mapping facultatif couleur -> liste d'URLs d'images spécifiques à la couleur
  imagesByColor: { type: Object, default: {} },
  active: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('ProductModel', ProductModelSchema);