const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DB_PATH)) {
  fs.writeFileSync(DB_PATH, JSON.stringify({ accounts: {}, saves: {}, sessions: {} }, null, 2));
}

app.use(express.json({ limit: '1mb' }));
app.use(express.static(__dirname));

function readDb() {
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}
function writeDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}
function createToken() {
  return crypto.randomBytes(24).toString('hex');
}
function sanitizeSave(save) {
  if (!save || typeof save !== 'object') return null;
  return save;
}
function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Brak tokenu.' });
  const db = readDb();
  const session = db.sessions[token];
  if (!session) return res.status(401).json({ error: 'Sesja wygasła.' });
  req.db = db;
  req.token = token;
  req.email = session.email;
  next();
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/register', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!email || !password) return res.status(400).json({ error: 'Email i hasło są wymagane.' });
  const db = readDb();
  if (db.accounts[email]) return res.status(409).json({ error: 'Konto już istnieje.' });
  db.accounts[email] = {
    passwordHash: hashPassword(password),
    createdAt: Date.now(),
  };
  writeDb(db);
  res.json({ ok: true });
});

app.post('/api/login', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const db = readDb();
  const account = db.accounts[email];
  if (!account || account.passwordHash !== hashPassword(password)) {
    return res.status(401).json({ error: 'Nieprawidłowy email lub hasło.' });
  }
  const token = createToken();
  db.sessions[token] = { email, createdAt: Date.now() };
  account.lastLoginAt = Date.now();
  writeDb(db);
  res.json({ ok: true, token, email, save: db.saves[email] || null });
});

app.get('/api/me', auth, (req, res) => {
  res.json({ ok: true, email: req.email, save: req.db.saves[req.email] || null });
});

app.post('/api/save', auth, (req, res) => {
  const save = sanitizeSave(req.body.save);
  if (!save) return res.status(400).json({ error: 'Nieprawidłowy zapis gry.' });
  req.db.saves[req.email] = save;
  writeDb(req.db);
  res.json({ ok: true, savedAt: Date.now() });
});

app.get('/api/ranking', (_req, res) => {
  const db = readDb();
  const ranking = Object.entries(db.saves || {}).map(([email, save]) => ({ email, save }));
  res.json({ ok: true, ranking });
});

app.post('/api/logout', auth, (req, res) => {
  delete req.db.sessions[req.token];
  writeDb(req.db);
  res.json({ ok: true });
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Plonopolis działa na http://localhost:${PORT}`);
});
