const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
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
    process.exit(1);
  }
};

module.exports = connectDB;