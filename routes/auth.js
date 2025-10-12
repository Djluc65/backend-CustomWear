const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const https = require('https');
const { sendEmail } = require('../config/mailer');
const { 
  generateToken, 
  generateRefreshToken, 
  verifyRefreshToken,
  authenticateToken 
} = require('../middleware/auth');
const {
  validateRegister,
  validateLogin,
  validatePasswordReset,
  validatePasswordResetConfirm,
  validatePasswordChange
} = require('../middleware/validation');

const router = express.Router();

// Configuration Google OAuth
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// @route   POST /api/auth/register
// @desc    Inscription d'un nouvel utilisateur
// @access  Public
router.post('/register', validateRegister, async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;
    console.log('[server/auth] Register request', { email, firstName, lastName });

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log('[server/auth] Register blocked: email already exists', { email });
      return res.status(400).json({
        success: false,
        message: 'Un compte avec cet email existe déjà'
      });
    }

    // Créer le nouvel utilisateur
    const user = new User({
      firstName,
      lastName,
      email,
      password
    });

    await user.save();
    console.log('[server/auth] Register success', { userId: user._id.toString(), email: user.email });

    // Générer les tokens
    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Réponse avec les données utilisateur (sans mot de passe)
    const userResponse = user.getPublicProfile();

    res.status(201).json({
      success: true,
      message: 'Compte créé avec succès',
      data: {
        user: userResponse,
        token,
        refreshToken
      }
    });

  } catch (error) {
    console.error('Erreur lors de l\'inscription:', error);
    console.log('[server/auth] Register error details', { message: error?.message, stack: error?.stack });
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   POST /api/auth/login
// @desc    Connexion utilisateur
// @access  Public
router.post('/login', validateLogin, async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('[server/auth] Login attempt', { email });

    // Trouver l'utilisateur avec le mot de passe
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      console.log('[server/auth] Login failed: user not found', { email });
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect'
      });
    }

    // Vérifier si le compte est verrouillé
    if (user.isLocked) {
      return res.status(423).json({
        success: false,
        message: 'Compte temporairement verrouillé. Réessayez plus tard.'
      });
    }

    // Vérifier le mot de passe
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      // Incrémenter les tentatives de connexion
      await user.incLoginAttempts();
      console.log('[server/auth] Login failed: invalid password', { email });
      
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect'
      });
    }

    // Vérifier si le compte est actif
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Compte désactivé'
      });
    }

    // Réinitialiser les tentatives de connexion
    if (user.loginAttempts > 0) {
      await user.resetLoginAttempts();
    }

    // Mettre à jour la dernière connexion
    user.lastLogin = new Date();
    await user.save();
    console.log('[server/auth] Login success', { userId: user._id.toString(), email: user.email });

    // Générer les tokens
    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Réponse avec les données utilisateur
    const userResponse = user.getPublicProfile();

    res.json({
      success: true,
      message: 'Connexion réussie',
      data: {
        user: userResponse,
        token,
        refreshToken
      }
    });

  } catch (error) {
    console.error('Erreur lors de la connexion:', error);
    console.log('[server/auth] Login error details', { message: error?.message, stack: error?.stack });
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   POST /api/auth/google
// @desc    Connexion avec Google OAuth
// @access  Public
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;
    console.log('[server/auth] Google login attempt', { hasCredential: Boolean(credential) });

    if (!credential) {
      return res.status(400).json({
        success: false,
        message: 'Token Google requis'
      });
    }

    // Vérifier la configuration Google côté serveur
    const audience = process.env.GOOGLE_CLIENT_ID;
    if (!audience) {
      console.warn('[server/auth] GOOGLE_CLIENT_ID manquant dans la configuration serveur');
      return res.status(500).json({
        success: false,
        message: 'Configuration OAuth Google manquante (GOOGLE_CLIENT_ID)'
      });
    }

    // Vérifier le token Google
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience
    });

    const payload = ticket.getPayload();
    const { sub: googleId, email, given_name: firstName, family_name: lastName, picture: avatar } = payload;
    console.log('[server/auth] Google token verified', { email, googleId });

    // Chercher un utilisateur existant
    let user = await User.findByEmailOrGoogleId(email, googleId);

    if (user) {
      // Utilisateur existant - mettre à jour les informations Google si nécessaire
      if (!user.googleId) {
        user.googleId = googleId;
      }
      if (!user.avatar && avatar) {
        user.avatar = avatar;
      }
      user.lastLogin = new Date();
      await user.save();
    } else {
      // Créer un nouveau compte
      user = new User({
        firstName,
        lastName,
        email,
        googleId,
        avatar,
        isEmailVerified: true // Les comptes Google sont considérés comme vérifiés
      });
      await user.save();
    }

    // Vérifier si le compte est actif
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Compte désactivé'
      });
    }

    // Générer les tokens
    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Réponse avec les données utilisateur
    const userResponse = user.getPublicProfile();

    res.json({
      success: true,
      message: 'Connexion Google réussie',
      data: {
        user: userResponse,
        token,
        refreshToken
      }
    });

  } catch (error) {
    console.error('Erreur lors de la connexion Google:', error);
    console.log('[server/auth] Google login error details', { message: error?.message, stack: error?.stack });
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la connexion Google'
    });
  }
});

// @route   POST /api/auth/facebook
// @desc    Connexion avec Facebook OAuth (via access token)
// @access  Public
router.post('/facebook', async (req, res) => {
  try {
    const accessToken = req.body?.accessToken || req.body?.token;
    const appId = process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    console.log('[server/auth] Facebook login attempt', { hasAccessToken: Boolean(accessToken) });

    if (!accessToken) {
      return res.status(400).json({ success: false, message: 'Token Facebook requis' });
    }
    if (!appId || !appSecret) {
      console.warn('[server/auth] Missing Facebook app credentials');
      return res.status(500).json({ success: false, message: 'Configuration Facebook manquante' });
    }

    // Petite helper pour GET JSON via https natif
    const getJSON = (url) => new Promise((resolve, reject) => {
      https
        .get(url, (resp) => {
          let data = '';
          resp.on('data', (chunk) => (data += chunk));
          resp.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              resolve(parsed);
            } catch (e) {
              reject(e);
            }
          });
        })
        .on('error', (err) => reject(err));
    });

    // Valider le token utilisateur via debug_token
    const appAccessToken = `${appId}|${appSecret}`;
    const debugUrl = `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(appAccessToken)}`;
    const debug = await getJSON(debugUrl);
    const isValid = debug?.data?.is_valid;
    const userIdFromDebug = debug?.data?.user_id;
    if (!isValid) {
      console.log('[server/auth] Facebook token invalid', { debug });
      return res.status(401).json({ success: false, message: 'Token Facebook invalide' });
    }

    // Récupérer le profil de l'utilisateur
    const meUrl = `https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${encodeURIComponent(accessToken)}`;
    const profile = await getJSON(meUrl);
    const facebookId = profile?.id || userIdFromDebug;
    const fullName = profile?.name || '';
    const email = profile?.email || null;
    const avatar = profile?.picture?.data?.url || null;

    console.log('[server/auth] Facebook token verified', { facebookId, email });

    // Découper le nom
    let firstName = 'Utilisateur';
    let lastName = 'Facebook';
    if (fullName && typeof fullName === 'string') {
      const parts = fullName.trim().split(' ');
      if (parts.length === 1) {
        firstName = parts[0];
      } else if (parts.length > 1) {
        firstName = parts.slice(0, -1).join(' ');
        lastName = parts[parts.length - 1];
      }
    }

    // Si pas d'email fourni par Facebook, créer un email de secours
    const effectiveEmail = email || `fb_${facebookId}@facebook.com`;

    // Chercher un utilisateur existant
    let user = await User.findByEmailOrFacebookId(effectiveEmail, facebookId);

    if (user) {
      if (!user.facebookId) user.facebookId = facebookId;
      if (!user.avatar && avatar) user.avatar = avatar;
      user.lastLogin = new Date();
      await user.save();
    } else {
      user = new User({
        firstName,
        lastName,
        email: effectiveEmail,
        facebookId,
        avatar,
        isEmailVerified: Boolean(email) // vérifié si email réel fourni
      });
      await user.save();
    }

    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Compte désactivé' });
    }

    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);
    const userResponse = user.getPublicProfile();

    res.json({
      success: true,
      message: 'Connexion Facebook réussie',
      data: { user: userResponse, token, refreshToken }
    });
  } catch (error) {
    console.error('Erreur lors de la connexion Facebook:', error);
    console.log('[server/auth] Facebook login error details', { message: error?.message, stack: error?.stack });
    res.status(500).json({ success: false, message: 'Erreur lors de la connexion Facebook' });
  }
});

// @route   POST /api/auth/refresh
// @desc    Rafraîchir le token d'accès
// @access  Public
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    console.log('[server/auth] Refresh token attempt', { hasRefreshToken: Boolean(refreshToken) });

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token requis'
      });
    }

    // Vérifier le refresh token
    const decoded = verifyRefreshToken(refreshToken);
    console.log('[server/auth] Refresh token decoded', { type: decoded?.type, userId: decoded?.userId });
    
    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        message: 'Token invalide'
      });
    }

    // Vérifier que l'utilisateur existe toujours
    const user = await User.findById(decoded.userId);
    
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Utilisateur non trouvé ou désactivé'
      });
    }

    // Générer un nouveau token d'accès
    const newToken = generateToken(user._id);
    console.log('[server/auth] Refresh token success', { userId: user._id.toString() });

    res.json({
      success: true,
      data: {
        token: newToken
      }
    });

  } catch (error) {
    console.error('Erreur lors du rafraîchissement du token:', error);
    console.log('[server/auth] Refresh token error details', { message: error?.message, stack: error?.stack });
    res.status(401).json({
      success: false,
      message: 'Refresh token invalide'
    });
  }
});

// @route   POST /api/auth/logout
// @desc    Déconnexion utilisateur
// @access  Private
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // Dans une implémentation complète, on pourrait ajouter le token à une blacklist
    // Pour l'instant, on se contente de confirmer la déconnexion
    
    res.json({
      success: true,
      message: 'Déconnexion réussie'
    });

  } catch (error) {
    console.error('Erreur lors de la déconnexion:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   GET /api/auth/me
// @desc    Obtenir les informations de l'utilisateur connecté
// @access  Private
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const userResponse = req.user.getPublicProfile();
    
    res.json({
      success: true,
      data: {
        user: userResponse
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération du profil:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   POST /api/auth/change-password
// @desc    Changer le mot de passe
// @access  Private
router.post('/change-password', authenticateToken, validatePasswordChange, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    // Récupérer l'utilisateur avec le mot de passe
    const user = await User.findById(req.user._id).select('+password');
    
    if (!user.password) {
      return res.status(400).json({
        success: false,
        message: 'Ce compte utilise la connexion Google. Impossible de changer le mot de passe.'
      });
    }

    // Vérifier le mot de passe actuel
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Mot de passe actuel incorrect'
      });
    }

    // Mettre à jour le mot de passe
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Mot de passe modifié avec succès'
    });

  } catch (error) {
    console.error('Erreur lors du changement de mot de passe:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   POST /api/auth/forgot-password
// @desc    Demander une réinitialisation de mot de passe
// @access  Public
router.post('/forgot-password', validatePasswordReset, async (req, res) => {
  try {
    const { email } = req.body;
    
    const user = await User.findOne({ email });
    
    if (!user) {
      // Ne pas révéler si l'email existe ou non
      return res.json({
        success: true,
        message: 'Si cet email existe, un lien de réinitialisation a été envoyé'
      });
    }

    if (!user.password) {
      return res.status(400).json({
        success: false,
        message: 'Ce compte utilise la connexion Google. Impossible de réinitialiser le mot de passe.'
      });
    }

    // Générer un token de réinitialisation
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    await user.save();

    // Construire l'URL de réinitialisation (client)
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const resetUrl = `${clientUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

    // Envoyer l'email
    try {
      await sendEmail({
        to: email,
        subject: 'Réinitialisation de votre mot de passe',
        text: `Bonjour,\n\nVous avez demandé à réinitialiser votre mot de passe.\nCliquez sur ce lien pour continuer: ${resetUrl}\nCe lien expire dans 10 minutes.\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.`,
        html: `<p>Bonjour,</p><p>Vous avez demandé à réinitialiser votre mot de passe.</p><p><a href="${resetUrl}">Réinitialiser votre mot de passe</a></p><p>Ce lien expire dans 10 minutes.</p><p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>`
      });
    } catch (mailError) {
      console.error('[Mailer] Erreur envoi email reset:', mailError?.message);
    }

    // Réponse API
    res.json({
      success: true,
      message: 'Lien de réinitialisation envoyé par email',
      ...(process.env.NODE_ENV === 'development' && { resetToken, resetUrl })
    });

  } catch (error) {
    console.error('Erreur lors de la demande de réinitialisation:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   POST /api/auth/reset-password
// @desc    Réinitialiser le mot de passe
// @access  Public
router.post('/reset-password', validatePasswordResetConfirm, async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    
    // Hasher le token pour la comparaison
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    
    // Trouver l'utilisateur avec le token valide
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Token de réinitialisation invalide ou expiré'
      });
    }

    // Mettre à jour le mot de passe
    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    
    // Réinitialiser les tentatives de connexion
    await user.resetLoginAttempts();
    
    await user.save();

    res.json({
      success: true,
      message: 'Mot de passe réinitialisé avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de la réinitialisation:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   POST /api/auth/admin/login
// @desc    Connexion admin avec validation des champs requis
// @access  Public
router.post('/admin/login', async (req, res) => {
  try {
    const { pseudo, email, password, role } = req.body;
    console.log('[server/auth] Admin login attempt', { pseudo, email, role });

    // Validation des champs requis
    if (!pseudo || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Tous les champs sont requis (pseudo, email, password, role)'
      });
    }

    // Validation du format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Format d\'email invalide'
      });
    }

    // Validation du rôle
    if (!['admin', 'moderator'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Rôle invalide. Seuls admin et moderator sont autorisés'
      });
    }

    // Rechercher l'utilisateur par email
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      console.log('[server/auth] Admin login failed: user not found', { email });
      return res.status(401).json({
        success: false,
        message: 'Identifiants invalides'
      });
    }

    // Vérifier le mot de passe
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      console.log('[server/auth] Admin login failed: invalid password', { email });
      return res.status(401).json({
        success: false,
        message: 'Identifiants invalides'
      });
    }

    // Vérifier que l'utilisateur a le bon rôle
    if (user.role !== role) {
      console.log('[server/auth] Admin login failed: wrong role', { email, expected: role, actual: user.role });
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé. Rôle insuffisant'
      });
    }

    // Vérifier que le pseudo correspond (optionnel, selon votre logique métier)
    // Si vous stockez le pseudo dans firstName ou un autre champ
    const userPseudo = user.firstName || user.lastName || user.email.split('@')[0];
    if (userPseudo.toLowerCase() !== pseudo.toLowerCase()) {
      console.log('[server/auth] Admin login failed: wrong pseudo', { email, pseudoAttempt: pseudo, userPseudo });
      return res.status(401).json({
        success: false,
        message: 'Pseudo incorrect'
      });
    }

    // Vérifier que le compte est actif
    if (!user.isActive) {
      console.log('[server/auth] Admin login blocked: user inactive', { email });
      return res.status(403).json({
        success: false,
        message: 'Compte désactivé'
      });
    }

    // Générer les tokens
    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Mettre à jour le refresh token
    user.refreshToken = refreshToken;
    user.lastLogin = new Date();
    await user.save();
    console.log('[server/auth] Admin login success', { userId: user._id.toString(), email: user.email, role: user.role });

    // Préparer les données utilisateur (sans le mot de passe)
    const userData = {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified
    };

    res.status(200).json({
      success: true,
      message: 'Connexion admin réussie',
      data: {
        user: userData,
        token,
        refreshToken
      }
    });

  } catch (error) {
    console.error('Erreur lors de la connexion admin:', error);
    console.log('[server/auth] Admin login error details', { message: error?.message, stack: error?.stack });
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

module.exports = router;