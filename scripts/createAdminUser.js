const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

const createAdminUser = async () => {
  try {
    // Connexion à la base de données
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/customwear');
    console.log('✅ Connexion à MongoDB réussie');

    // Données de l'utilisateur admin
    const adminData = {
      firstName: 'Admin',
      lastName: 'CustomWear',
      email: 'admin@customwear.com',
      password: 'admin123456', // Sera hashé automatiquement
      role: 'admin',
      isActive: true,
      isEmailVerified: true
    };

    // Vérifier si l'admin existe déjà
    const existingAdmin = await User.findOne({ email: adminData.email });
    if (existingAdmin) {
      console.log('⚠️  Un utilisateur admin existe déjà avec cet email');
      console.log('📧 Email:', existingAdmin.email);
      console.log('👤 Nom:', existingAdmin.firstName, existingAdmin.lastName);
      console.log('🔑 Rôle:', existingAdmin.role);
      return;
    }

    // Créer l'utilisateur admin
    const adminUser = new User(adminData);
    await adminUser.save();

    console.log('🎉 Utilisateur admin créé avec succès !');
    console.log('📧 Email:', adminUser.email);
    console.log('👤 Nom:', adminUser.firstName, adminUser.lastName);
    console.log('🔑 Rôle:', adminUser.role);
    console.log('🆔 ID:', adminUser._id);
    console.log('');
    console.log('🔐 Informations de connexion :');
    console.log('   Pseudo: Admin (ou admin)');
    console.log('   Email: admin@customwear.com');
    console.log('   Mot de passe: admin123456');
    console.log('   Rôle: admin');

  } catch (error) {
    console.error('❌ Erreur lors de la création de l\'utilisateur admin:', error);
  } finally {
    // Fermer la connexion
    await mongoose.connection.close();
    console.log('🔌 Connexion MongoDB fermée');
    process.exit(0);
  }
};

// Créer également un modérateur de test
const createModeratorUser = async () => {
  try {
    // Connexion à la base de données
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/customwear');

    // Données du modérateur
    const moderatorData = {
      firstName: 'Moderator',
      lastName: 'CustomWear',
      email: 'moderator@customwear.com',
      password: 'moderator123456',
      role: 'moderator',
      isActive: true,
      isEmailVerified: true
    };

    // Vérifier si le modérateur existe déjà
    const existingModerator = await User.findOne({ email: moderatorData.email });
    if (existingModerator) {
      console.log('⚠️  Un utilisateur modérateur existe déjà avec cet email');
      return;
    }

    // Créer l'utilisateur modérateur
    const moderatorUser = new User(moderatorData);
    await moderatorUser.save();

    console.log('🎉 Utilisateur modérateur créé avec succès !');
    console.log('📧 Email:', moderatorUser.email);
    console.log('👤 Nom:', moderatorUser.firstName, moderatorUser.lastName);
    console.log('🔑 Rôle:', moderatorUser.role);
    console.log('');
    console.log('🔐 Informations de connexion :');
    console.log('   Pseudo: Moderator (ou moderator)');
    console.log('   Email: moderator@customwear.com');
    console.log('   Mot de passe: moderator123456');
    console.log('   Rôle: moderator');

  } catch (error) {
    console.error('❌ Erreur lors de la création de l\'utilisateur modérateur:', error);
  }
};

const createBothUsers = async () => {
  await createAdminUser();
  await createModeratorUser();
};

// Exécuter le script
if (require.main === module) {
  createBothUsers();
}

module.exports = { createAdminUser, createModeratorUser };