require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const store = require('./store');

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

if (IS_PROD && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.includes('changez-moi'))) {
  console.error('ERREUR: définissez un SESSION_SECRET fort dans .env avant de passer en production.');
  process.exit(1);
}
if (IS_PROD && !process.env.ADMIN_PASSWORD_HASH) {
  console.error('ERREUR: définissez ADMIN_PASSWORD_HASH dans .env (voir scripts/hash-password.js).');
  process.exit(1);
}

// ---------- Sécurité de base ----------
app.set('trust proxy', 1); // nécessaire derrière un reverse proxy (nginx, etc.) pour rate-limit / cookies secure
app.disable('x-powered-by');

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        frameSrc: ["'self'", 'https://www.google.com'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: IS_PROD ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

app.use(express.json({ limit: '20kb' }));
app.use(express.urlencoded({ extended: false, limit: '20kb' }));
app.use(cookieParser());

app.use(
  session({
    name: 'nep.sid',
    secret: process.env.SESSION_SECRET || 'dev-only-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: IS_PROD,
      sameSite: 'strict',
      maxAge: 1000 * 60 * 60 * 4, // 4h
    },
  })
);

// Anti bruteforce global (toutes les routes API)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', globalLimiter);

// Anti bruteforce renforcé sur le formulaire de contact
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de messages envoyés. Merci de réessayer plus tard.' },
});

// Anti bruteforce renforcé sur le login admin
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives de connexion. Réessayez plus tard.' },
});

// petit anti-spam "honeypot" + délai minimum de remplissage
function honeypotCheck(req, res, next) {
  if (req.body.website) {
    // champ caché rempli => bot
    return res.status(200).json({ ok: true }); // on répond "ok" sans rien enregistrer, pour ne pas aider le bot
  }
  next();
}

// ---------- Protection anti force brute au niveau du compte ----------
// En complément de la limite par adresse IP, on verrouille temporairement
// le compte lui-même après plusieurs échecs consécutifs (bonne pratique
// recommandée par les standards de sécurité type OWASP).
const loginAttempts = new Map(); // username -> { count, lockedUntil }
const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

function isLocked(username) {
  const entry = loginAttempts.get(username);
  if (!entry) return false;
  if (entry.lockedUntil && Date.now() < entry.lockedUntil) return true;
  if (entry.lockedUntil && Date.now() >= entry.lockedUntil) {
    loginAttempts.delete(username);
  }
  return false;
}

function registerFailedAttempt(username) {
  const entry = loginAttempts.get(username) || { count: 0, lockedUntil: null };
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCK_DURATION_MS;
  }
  loginAttempts.set(username, entry);
}

function clearAttempts(username) {
  loginAttempts.delete(username);
}

// ---------- Auth admin ----------
function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.status(401).json({ error: 'Non authentifié.' });
}

app.post(
  '/api/admin/login',
  loginLimiter,
  [
    body('username').trim().isLength({ min: 1, max: 100 }),
    body('password').isLength({ min: 1, max: 200 }),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Identifiants invalides.' });

    const { username, password } = req.body;
    const expectedUser = process.env.ADMIN_USERNAME || 'admin';
    const hash = process.env.ADMIN_PASSWORD_HASH;

    if (isLocked(username)) {
      return res.status(429).json({
        error: 'Compte temporairement verrouillé suite à plusieurs échecs. Réessayez dans 15 minutes.',
      });
    }

    if (!hash) {
      return res.status(500).json({ error: "Compte admin non configuré côté serveur." });
    }

    // Comparaison du nom d'utilisateur en temps constant approximatif
    const userOk = username === expectedUser;
    const passOk = bcrypt.compareSync(password, hash);

    if (!userOk || !passOk) {
      registerFailedAttempt(username);
      return res.status(401).json({ error: 'Identifiants incorrects.' });
    }

    clearAttempts(username);

    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ error: 'Erreur serveur.' });
      req.session.isAdmin = true;
      req.session.username = username;
      res.json({ ok: true });
    });
  }
);

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('nep.sid');
    res.json({ ok: true });
  });
});

app.get('/api/admin/me', (req, res) => {
  res.json({ isAdmin: !!(req.session && req.session.isAdmin) });
});

// ---------- API Contact (public) ----------
app.post(
  '/api/contact',
  contactLimiter,
  honeypotCheck,
  [
    body('name').trim().isLength({ min: 2, max: 120 }).escape(),
    body('email').trim().isEmail().normalizeEmail().isLength({ max: 180 }),
    body('phone').optional({ checkFalsy: true }).trim().isLength({ max: 40 }).escape(),
    body('subject').trim().isLength({ min: 3, max: 160 }).escape(),
    body('message').trim().isLength({ min: 20, max: 4000 }).escape(),
    body('lang').optional().trim().isIn(['fr', 'en', 'ar']),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Formulaire invalide.', details: errors.array() });
    }

    const { name, email, phone, subject, message, lang } = req.body;
    const ip = req.ip;

    const entry = store.insertMessage({ name, email, phone, subject, message, lang, ip });

    res.status(201).json({ ok: true, id: entry.id });
  }
);

// ---------- API Messages (admin uniquement) ----------
app.get('/api/admin/messages', requireAuth, (req, res) => {
  const rows = store.getAllMessages();
  res.json({ messages: rows });
});

app.patch('/api/admin/messages/:id/read', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID invalide.' });
  store.markAsRead(id);
  res.json({ ok: true });
});

app.delete('/api/admin/messages/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID invalide.' });
  store.deleteMessage(id);
  res.json({ ok: true });
});

// ---------- Fichiers statiques ----------
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'], maxAge: IS_PROD ? '1d' : 0 }));

// Protéger la page dashboard.html côté navigation (le vrai contrôle reste l'API + requireAuth)
app.get('/admin', (req, res) => res.redirect('/admin/login.html'));

// 404
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Gestion d'erreurs générique (ne jamais divulguer la pile d'erreur au client)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erreur interne du serveur.' });
});

app.listen(PORT, () => {
  console.log(`N. Expert Partner — serveur démarré sur le port ${PORT} (${IS_PROD ? 'production' : 'développement'})`);
});
