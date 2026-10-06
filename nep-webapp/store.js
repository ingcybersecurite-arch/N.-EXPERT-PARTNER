// Stockage simple des messages dans un fichier JSON (data/messages.json).
// Choisi volontairement à la place d'une vraie base de données pour éviter
// toute compilation native (node-gyp / Visual Studio) lors de l'installation
// sur les postes Windows. Largement suffisant pour un formulaire de contact.

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'messages.json');

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf8');
}

function readAll() {
  ensureStore();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const data = JSON.parse(raw || '[]');
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error('Erreur de lecture du stockage des messages, réinitialisation.', e);
    return [];
  }
}

function writeAll(messages) {
  ensureStore();
  // Écriture atomique : on écrit dans un fichier temporaire puis on renomme,
  // pour éviter de corrompre les données en cas de coupure pendant l'écriture.
  const tmpFile = DATA_FILE + '.tmp';
  fs.writeFileSync(tmpFile, JSON.stringify(messages, null, 2), 'utf8');
  fs.renameSync(tmpFile, DATA_FILE);
}

function insertMessage({ name, email, phone, subject, message, lang, ip }) {
  const messages = readAll();
  const nextId = messages.length ? Math.max(...messages.map((m) => m.id)) + 1 : 1;
  const entry = {
    id: nextId,
    name,
    email,
    phone: phone || null,
    subject: subject || null,
    message,
    lang: lang || 'fr',
    ip: ip || null,
    created_at: new Date().toISOString(),
    is_read: false,
  };
  messages.unshift(entry); // les plus récents en premier
  writeAll(messages);
  return entry;
}

function getAllMessages() {
  return readAll().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function markAsRead(id) {
  const messages = readAll();
  const target = messages.find((m) => m.id === id);
  if (!target) return false;
  target.is_read = true;
  writeAll(messages);
  return true;
}

function deleteMessage(id) {
  const messages = readAll();
  const filtered = messages.filter((m) => m.id !== id);
  const changed = filtered.length !== messages.length;
  if (changed) writeAll(filtered);
  return changed;
}

module.exports = { insertMessage, getAllMessages, markAsRead, deleteMessage };
