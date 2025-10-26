const mongoose = require('mongoose');

// Ajout du type combiné et placement générique
const TYPES = ['text', 'image', 'combo'];
const PLACEMENTS = ['front', 'back', 'both', 'any'];

const CustomizationPricingSchema = new mongoose.Schema({
  type: { type: String, enum: TYPES, required: true },
  placement: { type: String, enum: PLACEMENTS, required: true },
  price: { type: Number, required: true, min: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

CustomizationPricingSchema.index({ type: 1, placement: 1 }, { unique: true });

module.exports = mongoose.model('CustomizationPricing', CustomizationPricingSchema);