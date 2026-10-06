# N. Expert Partner Consulting — Site web

Application web complète pour le cabinet **N. Expert Partner Consulting** :
- Site vitrine professionnel en **Français / Anglais / Arabe** (avec support RTL pour l'arabe)
- Présentation des services, valeurs, coordonnées
- Formulaire de contact sécurisé : chaque message envoyé depuis le site est enregistré
- **Espace administrateur** protégé par mot de passe pour consulter les messages reçus, depuis un téléphone ou un ordinateur, à l'adresse `/admin/login.html`

## Pages du site

| Page | Contenu |
|---|---|
| `/` | Accueil, pourquoi nous choisir, témoignages |
| `/a-propos.html` | Qui sommes-nous et valeurs |
| `/services.html` | Les 6 services : chaque carte ouvre sa propre page |
| `/services/*.html` | Page de chaque service, avec contact par e-mail, téléphone, WhatsApp ou formulaire |
| `/contact.html` | Coordonnées, carte et formulaire de contact |
| `/admin/login.html` | Espace administrateur (messages reçus) |

Les pages publiques sont générées en HTML statique dans `public/` ; les textes sont dans `public/js/translations.js` et `translations-extra.js` (FR/EN/AR).

## 1. Prérequis

- [Node.js](https://nodejs.org) version 18 ou plus
- Un hébergement capable de faire tourner une application Node.js (VPS, Render, Railway, o2switch, etc.)

## 2. Installation

```bash
npm install
```

## 3. Configuration

1. Copiez le fichier `.env.example` en `.env` :
   ```bash
   cp .env.example .env
   ```
2. Générez une clé de session aléatoire :
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```
   Collez le résultat dans `SESSION_SECRET` du fichier `.env`.
3. Choisissez un mot de passe administrateur solide et générez son hash sécurisé :
   ```bash
   node scripts/hash-password.js "VotreMotDePasseSolide123!"
   ```
   Collez le résultat dans `ADMIN_PASSWORD_HASH` du fichier `.env`.
4. Définissez `ADMIN_USERNAME` (par défaut `admin`).

⚠️ Ne partagez jamais votre fichier `.env` et ne le mettez jamais sur GitHub (il est déjà exclu via `.gitignore`).

## 4. Lancer le site

```bash
npm start
```

Le site est alors disponible sur `http://localhost:3000` (ou le port choisi dans `.env`).

- Site public : `http://localhost:3000/`
- Espace admin : `http://localhost:3000/admin/login.html`

## 5. Consulter les messages reçus

Dès qu'un visiteur envoie le formulaire de contact, le message est enregistré dans le fichier `data/messages.json` du serveur (stockage simple en fichier, sans base de données à installer — aucune compilation requise). Connectez-vous à `/admin/login.html` avec vos identifiants pour :
- Voir tous les messages (nom, e-mail, téléphone, sujet, message, langue, date)
- Marquer un message comme lu
- Supprimer un message
- Rafraîchir la liste (elle se met aussi à jour automatiquement toutes les 30 secondes)

Cet espace fonctionne aussi bien sur téléphone que sur ordinateur.

## 6. Sécurité mise en place

- **Mots de passe** : jamais stockés en clair, uniquement en hash bcrypt
- **Sessions** : cookies `httpOnly`, `sameSite=strict`, et `secure` en production (HTTPS obligatoire)
- **En-têtes de sécurité** : Helmet (CSP, anti-clickjacking, etc.)
- **Anti force brute par IP** : limitation du nombre de tentatives de connexion et d'envois de formulaire par adresse IP
- **Verrouillage de compte** : après 5 échecs de connexion admin consécutifs, le compte est verrouillé 15 minutes (norme de sécurité recommandée type OWASP), en plus de la limite par IP
- **Anti-spam** : champ piège invisible (honeypot) + délai minimum de remplissage du formulaire
- **Validation stricte** des champs du formulaire côté serveur (nom, e-mail, objet et message tous obligatoires, longueur minimale du message pour éviter les messages trop courts/spam)
- **Consentement RGPD-like** : case à cocher obligatoire avec lien vers la politique de confidentialité avant tout envoi du formulaire
- **Échappement HTML** systématique de tout contenu affiché (protection contre les attaques XSS)
- Le fichier `.env` (mots de passe, clés secrètes) n'est jamais exposé publiquement
- Suggestions de saisie du navigateur désactivées sur les formulaires sensibles (contact et connexion admin)

⚠️ **Politique de confidentialité** : le fichier `public/politique-confidentialite.html` est un **modèle de base**, pas un document juridique validé. Avant la mise en ligne, faites-le relire/adapter par un professionnel du droit selon la réglementation applicable au Tchad et à votre activité.

## 7. Mise en ligne (hébergement)

1. Déployez le dossier complet sur votre serveur ou plateforme d'hébergement Node.js.
2. Installez les dépendances (`npm install --production`).
3. Configurez le fichier `.env` sur le serveur (avec `NODE_ENV=production` et un `SESSION_SECRET` unique).
4. Assurez-vous que le site est servi en **HTTPS** (obligatoire pour la sécurité des cookies admin).
5. Démarrez l'application avec un gestionnaire de process comme `pm2` :
   ```bash
   npm install -g pm2
   pm2 start server.js --name nep-site
   pm2 save
   ```
6. Placez un reverse proxy (Nginx, Caddy, etc.) devant l'application pour gérer le certificat HTTPS et rediriger le port 80/443 vers le port de l'application (3000 par défaut).

## 8. Structure du projet

```
nep-webapp/
├── server.js              # Serveur Express (API + sécurité)
├── package.json
├── .env.example            # Modèle de configuration
├── scripts/
│   └── hash-password.js    # Génère le hash du mot de passe admin
├── data/                   # Base de données SQLite (créée automatiquement)
└── public/
    ├── index.html, a-propos.html, services.html, contact.html   # Site public (FR/EN/AR)
    ├── services/            # Une page par service
    ├── css/style.css
    ├── js/
    │   ├── translations.js, translations-extra.js  # Dictionnaires FR/EN/AR
    │   └── main.js
    ├── assets/               # Logo et visuels de la marque
    └── admin/
        ├── login.html
        ├── dashboard.html
        ├── admin.css
        └── admin.js
```

## 9. Personnalisation

- **Couleurs / textes** : modifiables dans `public/css/style.css` et `public/js/translations.js`
- **Coordonnées** (adresse, téléphone, e-mail) : à mettre à jour dans `public/index.html` (section contact) et `public/js/translations.js`
- **Logo** : remplacez les fichiers dans `public/assets/`

---
Cabinet N. Expert Partner Consulting — N'Djamena, Tchad
