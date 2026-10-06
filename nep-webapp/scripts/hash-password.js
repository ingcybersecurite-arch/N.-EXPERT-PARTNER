// Usage : node scripts/hash-password.js "VotreMotDePasseSolide123!"
// Copiez le résultat dans ADMIN_PASSWORD_HASH de votre fichier .env
const bcrypt = require('bcryptjs');

const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/hash-password.js "VotreMotDePasse"');
  process.exit(1);
}

// Recommandation de sécurité (norme courante type OWASP) : mot de passe
// d'au moins 12 caractères, mélangeant majuscules, minuscules et chiffres.
const isLongEnough = password.length >= 12;
const hasUpper = /[A-Z]/.test(password);
const hasLower = /[a-z]/.test(password);
const hasDigit = /[0-9]/.test(password);

if (!isLongEnough || !hasUpper || !hasLower || !hasDigit) {
  console.warn('\n⚠️  Attention : ce mot de passe est faible pour un accès administrateur.');
  console.warn('   Recommandé : au moins 12 caractères, avec majuscules, minuscules et chiffres.');
  console.warn('   Le hash sera quand même généré, mais changez ce mot de passe si possible.\n');
}

const hash = bcrypt.hashSync(password, 12);
console.log('\nAjoutez cette ligne dans votre fichier .env :\n');
console.log(`ADMIN_PASSWORD_HASH=${hash}\n`);
