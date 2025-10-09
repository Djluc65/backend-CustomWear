const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Modèle User
const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  pseudo: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin', 'moderator'], default: 'user' },
  isActive: { type: Boolean, default: true },
  emailVerified: { type: Boolean, default: false }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

async function createModerator() {
  try {
    // Connexion à MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connecté à MongoDB');

    // Vérifier si le modérateur existe déjà
    const existingModerator = await User.findOne({ email: 'moderator@customwear.com' });
    if (existingModerator) {
      console.log('ℹ️  Le modérateur existe déjà');
      return;
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash('moderator123456', 12);

    // Créer un utilisateur modérateur
    const moderatorUser = new User({
      firstName: 'Moderator',
      lastName: 'User',
      pseudo: 'Moderator',
      email: 'moderator@customwear.com',
      password: hashedPassword,
      role: 'moderator',
      isActive: true,
      emailVerified: true
    });

    await moderatorUser.save();
    console.log('✅ Utilisateur modérateur créé avec succès !');
    console.log('📧 Email: moderator@customwear.com');
    console.log('🔑 Mot de passe: moderator123456');
    console.log('👤 Rôle: moderator');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Connexion MongoDB fermée');
  }
}

createModerator();