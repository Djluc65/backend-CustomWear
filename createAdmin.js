const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

async function createAdmin() {
  try {
    await mongoose.connect('mongodb://localhost:27017/customwear');
    console.log('Connecté à MongoDB');
    
    // Vérifier s'il y a déjà un utilisateur admin
    const existingAdmin = await User.findOne({ role: 'admin' });
    
    if (existingAdmin) {
      console.log('Utilisateur admin existant:', existingAdmin.email);
      return;
    }
    
    // Créer un utilisateur admin
    const hashedPassword = await bcrypt.hash('admin123', 12);
    
    const adminUser = new User({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@customwear.com',
      password: hashedPassword,
      role: 'admin',
      status: 'active'
    });
    
    await adminUser.save();
    console.log('✅ Utilisateur admin créé avec succès!');
    console.log('Email: admin@customwear.com');
    console.log('Mot de passe: admin123');
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Déconnecté de MongoDB');
  }
}

createAdmin();