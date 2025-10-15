# backend-CustomWear

## RBAC (Role-Based Access Control)

Le backend implémente un contrôle d’accès par rôles (`user`, `moderator`, `admin`) via des middlewares centralisés dans `server/middleware/auth.js`.

- `authenticateToken`: vérifie le JWT (`Authorization: Bearer <token>`) et charge `req.user`.
- `requireRole(role)`: autorise uniquement un rôle spécifique.
- `requireAdmin`: alias de `requireRole('admin')`.
- `requireModerator`: alias de `requireRole('moderator')`.
- `optionalAuth`: attache l’utilisateur si un token est présent, sinon continue en public.

Exemples d’utilisation dans les routes:

```js
// Admin uniquement
router.get('/stats', authenticateToken, requireAdmin, async (req, res) => { /* ... */ });

// Moderator ou Admin (selon votre logique)
router.post('/products', authenticateToken, requireModerator, async (req, res) => { /* ... */ });

// Admin strict
router.delete('/products/:id', authenticateToken, requireAdmin, async (req, res) => { /* ... */ });
```

Le champ `role` est inclus dans le profil public retourné par `user.getPublicProfile()` et est exposé au frontend via `GET /api/users/profile` (protégé par `authenticateToken`). Cela permet au client de masquer les fonctionnalités admin/modérateur pour les autres rôles.

## Authentification (incl. Google)

Les routes d’authentification sont montées sous `/api/auth`:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/google` (connexion via Google Identity Services)
- `POST /api/auth/facebook` (connexion via token Facebook)
- `POST /api/auth/refresh` (renouvellement du token d’accès)

Configuration requise côté serveur:

- `JWT_SECRET`: secret JWT.
- `JWT_REFRESH_SECRET`: secret pour les refresh tokens (sinon `JWT_SECRET` sera utilisé).
- `GOOGLE_CLIENT_ID`: ID client OAuth côté serveur (doit correspondre au client Google configuré).
- `MONGODB_URI`: URL de connexion MongoDB.

Si `GOOGLE_CLIENT_ID` est manquant, `POST /api/auth/google` renverra une erreur de configuration (500). Vérifiez que l’ID client côté serveur correspond au `REACT_APP_GOOGLE_CLIENT_ID` côté client.

## Création d’utilisateurs Admin et Modérateur

Des scripts utilitaires sont fournis pour initialiser des comptes admin/modérateur:

- `node server/scripts/createAdminUser.js`

Ce script crée un utilisateur `admin@customwear.com` (rôle `admin`) et un utilisateur `moderator@customwear.com` (rôle `moderator`). Vous pouvez fournir des mots de passe via les variables d’environnement:

- `ADMIN_PASSWORD`: mot de passe admin (sinon généré aléatoirement)
- `MODERATOR_PASSWORD`: mot de passe modérateur (sinon généré aléatoirement)

Assurez-vous d’avoir `MONGODB_URI` configuré avant d’exécuter le script.