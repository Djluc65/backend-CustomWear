const mongoose = require('mongoose');

const positionSchema = new mongoose.Schema({
  x: { type: Number, default: 50 }, // percentage 0-100
  y: { type: Number, default: 50 }  // percentage 0-100
}, { _id: false });

const textConfigSchema = new mongoose.Schema({
  content: { type: String, default: '' },
  font: { type: String, default: 'Arial' },
  fontSize: { type: Number, default: 24 },
  color: { type: String, default: '#000000' },
  rotation: { type: Number, default: 0 },
  align: { type: String, enum: ['left', 'center', 'right'], default: 'center' },
  shape: { type: String, enum: ['horizontal', 'vertical', 'diagonal', 'arc'], default: 'horizontal' },
  position: { type: positionSchema, default: () => ({}) },
  side: { type: String, enum: ['front', 'back'], default: 'front' }
}, { _id: false });

const imageConfigSchema = new mongoose.Schema({
  dataUrl: { type: String },
  size: { type: Number, default: 100 }, // px
  rotation: { type: Number, default: 0 },
  position: { type: positionSchema, default: () => ({}) },
  side: { type: String, enum: ['front', 'back'], default: 'front' }
}, { _id: false });

const backgroundSchema = new mongoose.Schema({
  type: { type: String, enum: ['none', 'color', 'image'], default: 'none' },
  color: { type: String, default: '#ffffff' },
  imageDataUrl: { type: String },
  opacity: { type: Number, default: 1 }
}, { _id: false });

const customizationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  productType: { type: String, trim: true }, // e.g., 't-shirts', 'sweats', 'casquettes'
  productColor: { type: String, trim: true }, // hex
  text: textConfigSchema,
  image: imageConfigSchema,
  background: backgroundSchema,
  totalPrice: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Customization', customizationSchema);