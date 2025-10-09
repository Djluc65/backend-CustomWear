const { body, validationResult } = require('express-validator');

// Middleware pour gérer les erreurs de validation
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Erreurs de validation',
      errors: errors.array().map(error => ({
        field: error.path,
        message: error.msg,
        value: error.value
      }))
    });
  }
  
  next();
};

// Validations pour l'inscription
const validateRegister = [
  body('firstName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Le prénom doit contenir entre 2 et 50 caractères')
    .matches(/^[a-zA-ZÀ-ÿ\s-']+$/)
    .withMessage('Le prénom ne peut contenir que des lettres, espaces, tirets et apostrophes'),
  
  body('lastName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Le nom doit contenir entre 2 et 50 caractères')
    .matches(/^[a-zA-ZÀ-ÿ\s-']+$/)
    .withMessage('Le nom ne peut contenir que des lettres, espaces, tirets et apostrophes'),
  
  body('email')
    .isEmail()
    .withMessage('Veuillez entrer un email valide')
    .normalizeEmail()
    .isLength({ max: 100 })
    .withMessage('L\'email ne peut pas dépasser 100 caractères'),
  
  body('password')
    .isLength({ min: 6, max: 128 })
    .withMessage('Le mot de passe doit contenir entre 6 et 128 caractères')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Le mot de passe doit contenir au moins une minuscule, une majuscule et un chiffre'),
  
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Les mots de passe ne correspondent pas');
      }
      return true;
    }),
  
  handleValidationErrors
];

// Validations pour la connexion
const validateLogin = [
  body('email')
    .isEmail()
    .withMessage('Veuillez entrer un email valide')
    .normalizeEmail(),
  
  body('password')
    .notEmpty()
    .withMessage('Le mot de passe est requis'),
  
  handleValidationErrors
];

// Validations pour la mise à jour du profil
const validateProfileUpdate = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Le prénom doit contenir entre 2 et 50 caractères')
    .matches(/^[a-zA-ZÀ-ÿ\s-']+$/)
    .withMessage('Le prénom ne peut contenir que des lettres, espaces, tirets et apostrophes'),
  
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Le nom doit contenir entre 2 et 50 caractères')
    .matches(/^[a-zA-ZÀ-ÿ\s-']+$/)
    .withMessage('Le nom ne peut contenir que des lettres, espaces, tirets et apostrophes'),
  
  body('phone')
    .optional()
    .matches(/^[\+]?[1-9][\d]{0,15}$/)
    .withMessage('Veuillez entrer un numéro de téléphone valide'),
  
  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Veuillez entrer une date de naissance valide')
    .custom((value) => {
      const birthDate = new Date(value);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      
      if (age < 13 || age > 120) {
        throw new Error('L\'âge doit être entre 13 et 120 ans');
      }
      return true;
    }),
  
  body('gender')
    .optional()
    .isIn(['homme', 'femme', 'autre', 'non-specifie'])
    .withMessage('Genre invalide'),
  
  handleValidationErrors
];

// Validations pour l'ajout d'une adresse
const validateAddress = [
  body('type')
    .optional()
    .isIn(['domicile', 'travail', 'autre'])
    .withMessage('Type d\'adresse invalide'),
  
  body('street')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('L\'adresse doit contenir entre 5 et 200 caractères'),
  
  body('city')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('La ville doit contenir entre 2 et 100 caractères')
    .matches(/^[a-zA-ZÀ-ÿ\s-']+$/)
    .withMessage('La ville ne peut contenir que des lettres, espaces, tirets et apostrophes'),
  
  body('postalCode')
    .trim()
    .matches(/^[0-9]{5}$/)
    .withMessage('Le code postal doit contenir 5 chiffres'),
  
  body('country')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Le pays doit contenir entre 2 et 100 caractères'),
  
  handleValidationErrors
];

// Validations pour le changement de mot de passe
const validatePasswordChange = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Le mot de passe actuel est requis'),
  
  body('newPassword')
    .isLength({ min: 6, max: 128 })
    .withMessage('Le nouveau mot de passe doit contenir entre 6 et 128 caractères')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Le nouveau mot de passe doit contenir au moins une minuscule, une majuscule et un chiffre'),
  
  body('confirmNewPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Les nouveaux mots de passe ne correspondent pas');
      }
      return true;
    }),
  
  handleValidationErrors
];

// Validations pour la réinitialisation de mot de passe
const validatePasswordReset = [
  body('email')
    .isEmail()
    .withMessage('Veuillez entrer un email valide')
    .normalizeEmail(),
  
  handleValidationErrors
];

// Validations pour la confirmation de réinitialisation
const validatePasswordResetConfirm = [
  body('token')
    .notEmpty()
    .withMessage('Le token de réinitialisation est requis'),
  
  body('newPassword')
    .isLength({ min: 6, max: 128 })
    .withMessage('Le mot de passe doit contenir entre 6 et 128 caractères')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Le mot de passe doit contenir au moins une minuscule, une majuscule et un chiffre'),
  
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Les mots de passe ne correspondent pas');
      }
      return true;
    }),
  
  handleValidationErrors
];

// Validations pour les produits
const validateProduct = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Le nom du produit doit contenir entre 2 et 100 caractères'),
  
  body('description')
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('La description doit contenir entre 10 et 2000 caractères'),
  
  body('category')
    .isIn(['t-shirts', 'vestes', 'casquettes', 'vaisselle'])
    .withMessage('Catégorie invalide'),
  
  body('price.base')
    .isFloat({ min: 0 })
    .withMessage('Le prix de base doit être un nombre positif'),
  
  body('price.sale')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Le prix de vente doit être un nombre positif'),
  
  body('sku')
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('Le SKU doit contenir entre 3 et 20 caractères')
    .matches(/^[A-Z0-9-]+$/)
    .withMessage('Le SKU ne peut contenir que des lettres majuscules, chiffres et tirets'),
  
  handleValidationErrors
];

// Validations pour les commandes
const validateOrder = [
  body('items')
    .isArray({ min: 1 })
    .withMessage('La commande doit contenir au moins un article'),
  
  body('items.*.product')
    .isMongoId()
    .withMessage('ID de produit invalide'),
  
  body('items.*.quantity')
    .isInt({ min: 1, max: 100 })
    .withMessage('La quantité doit être entre 1 et 100'),
  
  body('shippingAddress.firstName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Le prénom doit contenir entre 2 et 50 caractères'),
  
  body('shippingAddress.lastName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Le nom doit contenir entre 2 et 50 caractères'),
  
  body('shippingAddress.street')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('L\'adresse doit contenir entre 5 et 200 caractères'),
  
  body('shippingAddress.city')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('La ville doit contenir entre 2 et 100 caractères'),
  
  body('shippingAddress.postalCode')
    .trim()
    .matches(/^[0-9]{5}$/)
    .withMessage('Le code postal doit contenir 5 chiffres'),
  
  body('payment.method')
    .isIn(['card', 'paypal', 'bank-transfer'])
    .withMessage('Méthode de paiement invalide'),
  
  handleValidationErrors
];

module.exports = {
  validateRegister,
  validateLogin,
  validateProfileUpdate,
  validateAddress,
  validatePasswordChange,
  validatePasswordReset,
  validatePasswordResetConfirm,
  validateProduct,
  validateOrder,
  handleValidationErrors
};