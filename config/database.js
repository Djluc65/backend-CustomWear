const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Réutiliser la connexion existante pour éviter les reconnections coûteuses en serverless
    if (mongoose.connection.readyState >= 1) {
      return mongoose.connection;
    }

    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 15000, // échoue en 15s si le cluster est inaccessible
      connectTimeoutMS: 10000, // limite la tentative de connexion initiale
      socketTimeoutMS: 20000 // évite que les requêtes pendent trop longtemps
    });

    console.log(`MongoDB connecté: ${conn.connection.host}`);

    // Nettoyage d'index obsolètes susceptibles de bloquer l'inscription
    try {
      const usersColl = conn.connection.db.collection('users');
      const indexes = await usersColl.indexes();
      const hasPseudoIndex = indexes.some((idx) => idx.name === 'pseudo_1');
      if (hasPseudoIndex) {
        console.warn('Index obsolète détecté sur users.pseudo, suppression en cours...');
        await usersColl.dropIndex('pseudo_1');
        console.log('Index pseudo_1 supprimé avec succès');
      }
    } catch (idxErr) {
      // Journaliser mais ne pas interrompre le serveur
      console.warn('Échec de la vérification/suppression index pseudo_1:', idxErr?.message || idxErr);
    }
  } catch (error) {
    console.error('Erreur de connexion MongoDB:', error.message);
    // En environnement serverless, éviter process.exit qui peut provoquer des timeouts
    throw error;
  }
};

module.exports = connectDB;