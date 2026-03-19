const SESSION_KEY = 'plonopolis-current-user-v1';
const TOKEN_KEY = 'plonopolis-auth-token-v1';
const API_BASE = '';

const cropData = [
  { level: 1, key: 'marchew', name: { pl: 'Marchew', en: 'Carrot' }, cost: 5, duration: 30, yield: 3, exp: 2 },
  { level: 2, key: 'ziemniak', name: { pl: 'Ziemniak', en: 'Potato' }, cost: 8, duration: 35, yield: 3, exp: 3 },
  { level: 3, key: 'pomidor', name: { pl: 'Pomidor', en: 'Tomato' }, cost: 12, duration: 40, yield: 3, exp: 4 },
  { level: 4, key: 'ogorek', name: { pl: 'Ogórek', en: 'Cucumber' }, cost: 15, duration: 45, yield: 3, exp: 5 },
  { level: 5, key: 'cebula', name: { pl: 'Cebula', en: 'Onion' }, cost: 18, duration: 50, yield: 3, exp: 6 },
  { level: 6, key: 'czosnek', name: { pl: 'Czosnek', en: 'Garlic' }, cost: 22, duration: 55, yield: 2, exp: 7 },
  { level: 7, key: 'salata', name: { pl: 'Sałata', en: 'Lettuce' }, cost: 10, duration: 25, yield: 4, exp: 4 },
  { level: 8, key: 'rzodkiewka', name: { pl: 'Rzodkiewka', en: 'Radish' }, cost: 6, duration: 20, yield: 5, exp: 3 },
  { level: 9, key: 'burak', name: { pl: 'Burak', en: 'Beetroot' }, cost: 20, duration: 60, yield: 2, exp: 8 },
  { level: 10, key: 'papryka', name: { pl: 'Papryka', en: 'Pepper' }, cost: 30, duration: 75, yield: 2, exp: 10 },
  { level: 11, key: 'kapusta', name: { pl: 'Kapusta', en: 'Cabbage' }, cost: 40, duration: 90, yield: 2, exp: 12 },
  { level: 12, key: 'brokul', name: { pl: 'Brokuł', en: 'Broccoli' }, cost: 50, duration: 110, yield: 2, exp: 14 },
  { level: 13, key: 'kalafior', name: { pl: 'Kalafior', en: 'Cauliflower' }, cost: 60, duration: 130, yield: 2, exp: 16 },
  { level: 14, key: 'truskawka', name: { pl: 'Truskawka', en: 'Strawberry' }, cost: 90, duration: 160, yield: 3, exp: 20 },
  { level: 15, key: 'malina', name: { pl: 'Malina', en: 'Raspberry' }, cost: 100, duration: 180, yield: 3, exp: 22 },
  { level: 16, key: 'borowka', name: { pl: 'Borówka', en: 'Blueberry' }, cost: 120, duration: 200, yield: 3, exp: 25 },
  { level: 17, key: 'jablon', name: { pl: 'Jabłoń', en: 'Apple Tree' }, cost: 180, duration: 260, yield: 2, exp: 30 },
  { level: 18, key: 'grusza', name: { pl: 'Grusza', en: 'Pear Tree' }, cost: 200, duration: 300, yield: 2, exp: 35 },
  { level: 19, key: 'arbuz', name: { pl: 'Arbuz', en: 'Watermelon' }, cost: 300, duration: 360, yield: 2, exp: 40 },
  { level: 20, key: 'winogrono', name: { pl: 'Winogrono', en: 'Grapes' }, cost: 320, duration: 340, yield: 3, exp: 42 },
  { level: 21, key: 'dynia', name: { pl: 'Dynia', en: 'Pumpkin' }, cost: 250, duration: 300, yield: 2, exp: 38 },
  { level: 22, key: 'rzepak', name: { pl: 'Rzepak', en: 'Rapeseed' }, cost: 400, duration: 420, yield: 2, exp: 50 },
  { level: 23, key: 'slonecznik', name: { pl: 'Słonecznik', en: 'Sunflower' }, cost: 500, duration: 480, yield: 2, exp: 55 },
  { level: 24, key: 'kawa', name: { pl: 'Kawa', en: 'Coffee' }, cost: 800, duration: 600, yield: 1, exp: 70 },
  { level: 25, key: 'kokos', name: { pl: 'Kokos', en: 'Coconut' }, cost: 1200, duration: 900, yield: 1, exp: 100 },
];

const fieldCosts = {
  4: { level: 2, price: 138 }, 5: { level: 2, price: 159 }, 6: { level: 3, price: 183 }, 7: { level: 3, price: 210 },
  8: { level: 4, price: 241 }, 9: { level: 4, price: 278 }, 10: { level: 5, price: 319 }, 11: { level: 5, price: 367 },
  12: { level: 6, price: 422 }, 13: { level: 6, price: 485 }, 14: { level: 7, price: 558 }, 15: { level: 7, price: 642 },
  16: { level: 8, price: 738 }, 17: { level: 8, price: 849 }, 18: { level: 9, price: 976 }, 19: { level: 9, price: 1123 },
  20: { level: 10, price: 1291 }, 21: { level: 10, price: 1485 }, 22: { level: 11, price: 1708 }, 23: { level: 11, price: 1964 },
  24: { level: 12, price: 2259 }, 25: { level: 12, price: 2597 }, 26: { level: 13, price: 2987 }, 27: { level: 13, price: 3435 },
  28: { level: 14, price: 3950 }, 29: { level: 14, price: 4543 }, 30: { level: 15, price: 5224 }, 31: { level: 15, price: 6008 },
  32: { level: 16, price: 6909 }, 33: { level: 16, price: 7945 }, 34: { level: 17, price: 9137 }, 35: { level: 17, price: 10508 },
  36: { level: 18, price: 12084 }, 37: { level: 18, price: 13897 }, 38: { level: 19, price: 15981 }, 39: { level: 19, price: 18378 },
  40: { level: 20, price: 21135 }, 41: { level: 20, price: 24305 }, 42: { level: 21, price: 27951 }, 43: { level: 21, price: 32144 },
  44: { level: 22, price: 36965 }, 45: { level: 22, price: 42510 }, 46: { level: 23, price: 48886 }, 47: { level: 23, price: 56219 },
  48: { level: 24, price: 64652 }, 49: { level: 24, price: 74350 }, 50: { level: 25, price: 85503 },
};

const compostPacks = [
  { amount: 25, price: 250 },
  { amount: 100, price: 900 },
  { amount: 250, price: 2000 },
];

const richCompostCosts = [100, 300, 1000, 2500, 5000];
const recycleCosts = [25, 100, 300, 750, 1500];
const richChanceValues = [25, 30, 35, 40, 45, 50];
const recycleChanceValues = [1, 2, 4, 6, 8, 10];

const ranchImages = {
  1: 'assets/ranch1.png',
  2: 'assets/ranch2.png',
  3: 'assets/ranch3.png',
  4: 'assets/ranch4.png',
  5: 'assets/ranch5.png',
};

const hitboxes = {
  1: { house: { left: 14, top: 15, width: 28, height: 28 }, shed: { left: 58, top: 12, width: 30, height: 28 }, field: { left: 47, top: 55, width: 39, height: 31 } },
  2: { house: { left: 14, top: 16, width: 28, height: 27 }, shed: { left: 58, top: 13, width: 30, height: 28 }, field: { left: 47, top: 54, width: 39, height: 31 } },
  3: { house: { left: 15, top: 16, width: 27, height: 27 }, shed: { left: 58, top: 14, width: 30, height: 27 }, field: { left: 45, top: 55, width: 41, height: 30 } },
  4: { house: { left: 14, top: 16, width: 28, height: 28 }, shed: { left: 59, top: 14, width: 29, height: 28 }, field: { left: 44, top: 53, width: 42, height: 32 } },
  5: { house: { left: 12, top: 13, width: 28, height: 30 }, shed: { left: 57, top: 13, width: 31, height: 30 }, field: { left: 45, top: 52, width: 40, height: 32 } },
};

const texts = {
  pl: {
    login: 'Logowanie', register: 'Rejestracja', email: 'Email', password: 'Hasło', confirmPassword: 'Powtórz hasło',
    loginBtn: 'Zaloguj się', registerBtn: 'Utwórz konto', authSubtitle: 'Przeglądarkowa gra HTML5 z rankingiem online',
    level: 'Poziom', exp: 'EXP', upgrades: 'Ulepszenia', logout: 'Wyloguj', ranking: 'Ranking', points: 'Punkty',
    houseInfo: 'Dom jeszcze nie ma funkcji.', storage: 'Magazyn', fields: 'Pola', close: 'Zamknij', inventory: 'Uprawy', compost: 'Kompost',
    createCompost: 'Stwórz 1 kompost (3 rośliny)', buyPack: 'Kup pakiet', sell1: 'Sprzedaj 1', sellAll: 'Sprzedaj wszystko',
    seeds: 'Siej', water: 'Podlej', harvest: 'Żniwa', fertilize: 'Nawóź', fertilized: 'Nawożone', watered: 'Podlane',
    empty: 'Puste', ready: 'Gotowe', locked: 'Zablokowane', buyField: 'Kup pole', requirement: 'Wymagany poziom',
    price: 'Cena', chooseCrop: 'Wybierz uprawę', current: 'Aktualnie', next: 'Następny', richCompost: 'Bogaty kompost', recycle: 'Recykling plonów',
    doubleHarvest: 'Szansa na podwójny plon po nawożeniu', recycleDesc: 'Szansa na odzyskanie kompostu podczas nawożenia',
    upgrade: 'Ulepsz', levelShort: 'Lv.', fieldNo: 'Pole', buy: 'Kup', coinsMissing: 'Za mało monet.', levelMissing: 'Za niski poziom.',
    compostMissing: 'Brak kompostu.', fieldBought: 'Kupiono nowe pole.', harvested: 'Zebrano plony.', planted: 'Zasiano.', wateredToast: 'Podlano roślinę.',
    fertilizedToast: 'Pole nawiezione.', recycledToast: '♻️ Kompost odzyskany!', fullCompost: 'Magazyn kompostu pełny.', notEnoughPlants: 'Za mało roślin do kompostu.',
    sold: 'Sprzedano.', registered: 'Konto utworzone. Możesz się zalogować.', passwordMismatch: 'Hasła się nie zgadzają.', invalidLogin: 'Błędny email lub hasło.',
    saved: 'Zapisano', saveNow: 'Zapisywanie...', savePending: 'Zmiany...', saveError: 'Błąd zapisu', sellPriceAssumption: 'Cena sprzedaży 1 sztuki = koszt siewu 1 nasiona.',
    rankingTitle: 'Ranking graczy online', rank: 'Miejsce', player: 'Gracz', noPlayers: 'Brak graczy w rankingu.', serverRequired: 'Uruchom grę przez serwer Node.js.',
  },
  en: {
    login: 'Login', register: 'Register', email: 'Email', password: 'Password', confirmPassword: 'Repeat password',
    loginBtn: 'Login', registerBtn: 'Create account', authSubtitle: 'HTML5 browser game with online ranking',
    level: 'Level', exp: 'EXP', upgrades: 'Upgrades', logout: 'Logout', ranking: 'Ranking', points: 'Points',
    houseInfo: 'The house has no function yet.', storage: 'Storage', fields: 'Fields', close: 'Close', inventory: 'Crops', compost: 'Compost',
    createCompost: 'Create 1 compost (3 crops)', buyPack: 'Buy pack', sell1: 'Sell 1', sellAll: 'Sell all',
    seeds: 'Sow', water: 'Water', harvest: 'Harvest', fertilize: 'Fertilize', fertilized: 'Fertilized', watered: 'Watered',
    empty: 'Empty', ready: 'Ready', locked: 'Locked', buyField: 'Buy field', requirement: 'Required level',
    price: 'Price', chooseCrop: 'Choose crop', current: 'Current', next: 'Next', richCompost: 'Rich compost', recycle: 'Crop recycling',
    doubleHarvest: 'Chance for double yield after fertilizing', recycleDesc: 'Chance to recover compost while fertilizing',
    upgrade: 'Upgrade', levelShort: 'Lv.', fieldNo: 'Field', buy: 'Buy', coinsMissing: 'Not enough coins.', levelMissing: 'Level too low.',
    compostMissing: 'No compost.', fieldBought: 'New field purchased.', harvested: 'Harvested.', planted: 'Seed planted.', wateredToast: 'Plant watered.',
    fertilizedToast: 'Field fertilized.', recycledToast: '♻️ Compost recovered!', fullCompost: 'Compost storage full.', notEnoughPlants: 'Not enough crops for compost.',
    sold: 'Sold.', registered: 'Account created. You can log in now.', passwordMismatch: 'Passwords do not match.', invalidLogin: 'Wrong email or password.',
    saved: 'Saved', saveNow: 'Saving...', savePending: 'Pending...', saveError: 'Save error', sellPriceAssumption: 'Sell price of 1 crop = seed cost of 1 crop.',
    rankingTitle: 'Online player ranking', rank: 'Rank', player: 'Player', noPlayers: 'No players in ranking yet.', serverRequired: 'Run the game through the Node.js server.',
  },
};

let currentLang = 'pl';
let authMode = 'login';
let currentUser = null;
let state = null;
let modalType = null;
let saveTimer = null;
let isDirty = false;
let saveInFlight = false;

function t(key) { return texts[currentLang][key] || key; }
function formatNumber(value) { return new Intl.NumberFormat(currentLang === 'pl' ? 'pl-PL' : 'en-US').format(value || 0); }
function getCropName(crop) { return crop.name[currentLang]; }
function getToken() { return localStorage.getItem(TOKEN_KEY) || ''; }

async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch (_error) {
    throw new Error(t('serverRequired'));
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function createInitialState(email) {
  return {
    email,
    level: 1,
    exp: 0,
    coins: 40,
    compost: 0,
    richCompostLevel: 0,
    recycleLevel: 0,
    inventory: Object.fromEntries(cropData.map(crop => [crop.key, 0])),
    fields: Array.from({ length: 50 }, (_, idx) => ({
      id: idx + 1,
      unlocked: idx < 3,
      state: 'empty',
      cropKey: null,
      fertilized: false,
      watered: false,
      startAt: null,
      endAt: null,
    })),
    lastSavedAt: 0,
  };
}

function getInventoryValue(save) {
  if (!save?.inventory) return 0;
  return cropData.reduce((sum, crop) => sum + ((save.inventory[crop.key] || 0) * crop.cost), 0);
}
function getCurrentFieldCount(save) {
  return (save?.fields || []).filter(field => field.unlocked).length;
}
function getTotalExpAccumulated(save) {
  if (!save) return 0;
  let total = save.exp || 0;
  for (let lvl = 1; lvl < (save.level || 1); lvl += 1) total += getExpToNextLevel(lvl);
  return total;
}
function getPlayerPoints(save) {
  if (!save) return 0;
  const economy = (save.coins || 0) + getInventoryValue(save) + ((save.compost || 0) * 8);
  const progression = getTotalExpAccumulated(save) + (getCurrentFieldCount(save) * 40) + ((save.richCompostLevel || 0) * 250) + ((save.recycleLevel || 0) * 150);
  return Math.floor(economy + progression);
}
function getExpToNextLevel(level) { return Math.floor(15 + 8 * Math.pow(level, 1.5)); }
function getRanchTier(level) {
  if (level >= 20) return 5;
  if (level >= 14) return 4;
  if (level >= 9) return 3;
  if (level >= 5) return 2;
  return 1;
}
function getProgress(field) {
  if (field.state === 'ready') return 100;
  if (field.state !== 'growing' || !field.startAt || !field.endAt) return 0;
  const total = field.endAt - field.startAt;
  const elapsed = Date.now() - field.startAt;
  return Math.max(0, Math.min(100, Math.floor((elapsed / total) * 100)));
}
function syncFieldStates() {
  if (!state) return;
  const now = Date.now();
  state.fields.forEach(field => {
    if (field.state === 'growing' && field.endAt && now >= field.endAt) field.state = 'ready';
  });
}
function getRichChance() { return richChanceValues[state.richCompostLevel] / 100; }
function getRecycleChance() { return recycleChanceValues[state.recycleLevel] / 100; }
function markDirty() {
  isDirty = true;
  const el = document.getElementById('save-status');
  if (el) el.textContent = t('savePending');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveState(), 800);
}

async function saveState() {
  if (!currentUser || !state || !isDirty || saveInFlight) return;
  saveInFlight = true;
  try {
    document.getElementById('save-status').textContent = t('saveNow');
    state.lastSavedAt = Date.now();
    await apiFetch('/api/save', { method: 'POST', body: JSON.stringify({ save: state }) });
    localStorage.setItem(SESSION_KEY, currentUser);
    document.getElementById('save-status').textContent = `${t('saved')} ${new Date(state.lastSavedAt).toLocaleTimeString(currentLang === 'pl' ? 'pl-PL' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    isDirty = false;
  } catch (error) {
    document.getElementById('save-status').textContent = t('saveError');
    showToast(error.message);
  } finally {
    saveInFlight = false;
  }
}

async function loadState(email, serverSave) {
  state = serverSave || createInitialState(email);
  syncFieldStates();
  renderAll();
  isDirty = true;
  await saveState();
}

function addExp(amount) {
  state.exp += amount;
  while (state.level < 25) {
    const need = getExpToNextLevel(state.level);
    if (state.exp < need) break;
    state.exp -= need;
    state.level += 1;
    showToast(`${t('level')} ${state.level}!`);
  }
}

function updateLanguageUI() {
  document.getElementById('auth-subtitle').textContent = t('authSubtitle');
  document.getElementById('login-tab').textContent = t('login');
  document.getElementById('register-tab').textContent = t('register');
  document.getElementById('email-label').textContent = t('email');
  document.getElementById('password-label').textContent = t('password');
  document.getElementById('confirm-label').textContent = t('confirmPassword');
  document.getElementById('auth-submit').textContent = authMode === 'login' ? t('loginBtn') : t('registerBtn');
  document.getElementById('level-label').textContent = t('level');
  document.getElementById('exp-label').textContent = t('exp');
  document.getElementById('points-label').textContent = t('points');
  document.getElementById('ranking-btn').textContent = t('ranking');
  document.getElementById('upgrades-btn').textContent = t('upgrades');
  document.getElementById('logout-btn').textContent = t('logout');
}
function showAuthScreen() {
  document.getElementById('auth-screen').classList.add('active');
  document.getElementById('game-screen').classList.remove('active');
  updateLanguageUI();
}
function showGameScreen() {
  document.getElementById('auth-screen').classList.remove('active');
  document.getElementById('game-screen').classList.add('active');
  renderAll();
}
function renderTopbar() {
  document.getElementById('player-name').textContent = currentUser;
  document.getElementById('player-level').textContent = state.level;
  document.getElementById('player-points').textContent = formatNumber(getPlayerPoints(state));
  document.getElementById('coins').textContent = formatNumber(state.coins);
  document.getElementById('compost').textContent = formatNumber(state.compost);
  const need = getExpToNextLevel(state.level);
  const percent = state.level >= 25 ? 100 : Math.floor((state.exp / need) * 100);
  document.getElementById('exp-percent').textContent = `${percent}%`;
  document.getElementById('exp-fill').style.width = `${percent}%`;
}
function applyHitboxes() {
  const tier = getRanchTier(state.level);
  document.getElementById('ranch-image').src = ranchImages[tier];
  const config = hitboxes[tier];
  ['house', 'shed', 'field'].forEach(key => {
    const el = document.getElementById(`${key}-hitbox`);
    const box = config[key];
    el.style.left = `${box.left}%`;
    el.style.top = `${box.top}%`;
    el.style.width = `${box.width}%`;
    el.style.height = `${box.height}%`;
  });
}
function renderAll() {
  if (!state) return;
  syncFieldStates();
  updateLanguageUI();
  renderTopbar();
  applyHitboxes();
  if (!document.getElementById('modal-backdrop').classList.contains('hidden')) {
    if (modalType === 'storage') openStorage();
    if (modalType === 'fields') openFields();
    if (modalType === 'upgrades') openUpgrades();
  }
}

function showToast(text) {
  const toast = document.getElementById('toast');
  toast.textContent = text;
  toast.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toast.classList.remove('show'), 1800);
}
function setAuthMode(mode) {
  authMode = mode;
  document.getElementById('login-tab').classList.toggle('active', mode === 'login');
  document.getElementById('register-tab').classList.toggle('active', mode === 'register');
  document.getElementById('confirm-wrapper').classList.toggle('hidden', mode !== 'register');
  document.getElementById('auth-submit').textContent = mode === 'login' ? t('loginBtn') : t('registerBtn');
  document.getElementById('auth-message').textContent = '';
}

async function handleAuth(e) {
  e.preventDefault();
  const email = document.getElementById('auth-email').value.trim().toLowerCase();
  const password = document.getElementById('auth-password').value;
  const confirm = document.getElementById('auth-confirm').value;
  const message = document.getElementById('auth-message');
  message.textContent = '';
  try {
    if (authMode === 'register') {
      if (password !== confirm) {
        message.textContent = t('passwordMismatch');
        return;
      }
      await apiFetch('/api/register', { method: 'POST', body: JSON.stringify({ email, password }) });
      message.textContent = t('registered');
      setAuthMode('login');
      return;
    }
    const data = await apiFetch('/api/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(SESSION_KEY, data.email);
    currentUser = data.email;
    await loadState(data.email, data.save);
    showGameScreen();
  } catch (error) {
    message.textContent = error.message || t('invalidLogin');
  }
}

function openModal(content) {
  document.getElementById('modal').innerHTML = content;
  document.getElementById('modal-backdrop').classList.remove('hidden');
}
function closeModal() {
  modalType = null;
  document.getElementById('modal-backdrop').classList.add('hidden');
}

function openStorage() {
  modalType = 'storage';
  const cropRows = cropData.map(crop => {
    const amount = state.inventory[crop.key] || 0;
    return `
      <div class="crop-row">
        <div>
          <strong>${getCropName(crop)}</strong><br>
          <span class="small">${amount} szt. · ${t('price')}: ${formatNumber(crop.cost)}</span>
        </div>
        <button class="secondary-btn" onclick="sellCrop('${crop.key}', 1)" ${amount < 1 ? 'disabled' : ''}>${t('sell1')}</button>
        <button class="secondary-btn" onclick="sellCrop('${crop.key}', 'all')" ${amount < 1 ? 'disabled' : ''}>${t('sellAll')}</button>
      </div>`;
  }).join('');

  const packRows = compostPacks.map((pack, idx) => `
    <div class="crop-row">
      <div><strong>${t('buyPack')} ${idx + 1}</strong><br><span class="small">${pack.amount} ${t('compost')} · ${t('price')}: ${formatNumber(pack.price)}</span></div>
      <button class="primary-btn" onclick="buyCompostPack(${idx})">${t('buy')}</button>
      <div></div>
    </div>`).join('');

  openModal(`
    <div class="modal-head">
      <h2>📦 ${t('storage')}</h2>
      <button class="secondary-btn" onclick="closeModal()">${t('close')}</button>
    </div>
    <div class="grid-2">
      <div class="card">
        <h3>${t('inventory')}</h3>
        <div class="small">${t('sellPriceAssumption')}</div>
        <div class="crop-list">${cropRows}</div>
      </div>
      <div class="storage-grid">
        <div class="card">
          <h3>♻️ ${t('compost')}</h3>
          <p>${formatNumber(state.compost)}/250</p>
          <div class="row"><button class="primary-btn" onclick="makeCompost()">${t('createCompost')}</button></div>
          <p class="small">3 dowolne rośliny = 1 kompost</p>
        </div>
        <div class="card">
          <h3>🛒 ${t('compost')}</h3>
          <div class="crop-list">${packRows}</div>
        </div>
      </div>
    </div>`);
}

function getAvailableCrops() { return cropData.filter(c => c.level <= state.level); }
function openFields() {
  modalType = 'fields';
  syncFieldStates();
  const tiles = state.fields.map(field => renderFieldTile(field)).join('');
  openModal(`
    <div class="modal-head">
      <h2>🌱 ${t('fields')}</h2>
      <button class="secondary-btn" onclick="closeModal()">${t('close')}</button>
    </div>
    <div class="field-grid">${tiles}</div>`);
}
function renderFieldTile(field) {
  if (!field.unlocked) {
    const conf = fieldCosts[field.id];
    const canBuy = state.level >= conf.level && state.coins >= conf.price;
    return `
      <div class="field-tile locked">
        <div class="field-title">${t('fieldNo')} ${field.id}</div>
        <div>${t('locked')}</div>
        <div class="small">${t('requirement')}: ${conf.level}</div>
        <div class="small">${t('price')}: ${formatNumber(conf.price)}</div>
        <div class="actions"><button class="primary-btn" onclick="buyField(${field.id})" ${!canBuy ? 'disabled' : ''}>${t('buyField')}</button></div>
      </div>`;
  }
  if (field.state === 'empty') {
    return `
      <div class="field-tile">
        <div class="field-title">${t('fieldNo')} ${field.id}</div>
        <div>${field.fertilized ? `♻️ ${t('fertilized')}` : t('empty')}</div>
        <div class="actions">
          <button class="secondary-btn" onclick="fertilizeField(${field.id})">${t('fertilize')}</button>
          <button class="primary-btn" onclick="openSowMenu(${field.id})">${t('seeds')}</button>
        </div>
      </div>`;
  }
  const crop = cropData.find(c => c.key === field.cropKey);
  const progress = getProgress(field);
  const remaining = Math.max(0, Math.ceil((field.endAt - Date.now()) / 1000));
  if (field.state === 'growing') {
    return `
      <div class="field-tile">
        <div class="field-title">${t('fieldNo')} ${field.id}</div>
        <div><strong>${getCropName(crop)}</strong></div>
        <div class="progress"><div style="width:${progress}%"></div></div>
        <div class="small">${progress}% · ${remaining}s</div>
        <div class="small">${field.fertilized ? `♻️ ${t('fertilized')}` : ''} ${field.watered ? `💧 ${t('watered')}` : ''}</div>
        <div class="actions"><button class="secondary-btn" onclick="waterField(${field.id})" ${field.watered ? 'disabled' : ''}>${t('water')}</button></div>
      </div>`;
  }
  return `
    <div class="field-tile">
      <div class="field-title">${t('fieldNo')} ${field.id}</div>
      <div><strong>${getCropName(crop)}</strong></div>
      <div class="progress"><div style="width:100%"></div></div>
      <div class="small">${t('ready')}</div>
      <div class="small">${field.fertilized ? `♻️ ${t('fertilized')}` : ''}</div>
      <div class="actions"><button class="primary-btn" onclick="harvestField(${field.id})">${t('harvest')}</button></div>
    </div>`;
}

function openSowMenu(fieldId) {
  const field = state.fields[fieldId - 1];
  if (!field || field.state !== 'empty') return;
  const rows = getAvailableCrops().map(crop => `
    <div class="crop-row">
      <div>
        <strong>${getCropName(crop)}</strong><br>
        <span class="small">${t('levelShort')} ${crop.level} · ${t('price')}: ${formatNumber(crop.cost)} · ${crop.duration}s · ${t('yield')}: ${crop.yield} · EXP: ${crop.exp}</span>
      </div>
      <button class="primary-btn" onclick="sowCrop(${fieldId}, '${crop.key}')" ${state.coins < crop.cost ? 'disabled' : ''}>${t('seeds')}</button>
      <div></div>
    </div>`).join('');
  openModal(`
    <div class="modal-head">
      <h2>🌾 ${t('chooseCrop')} — ${t('fieldNo')} ${fieldId}</h2>
      <button class="secondary-btn" onclick="openFields()">${t('close')}</button>
    </div>
    <div class="card"><div class="crop-list">${rows}</div></div>`);
}

function sowCrop(fieldId, cropKey) {
  const field = state.fields[fieldId - 1];
  const crop = cropData.find(c => c.key === cropKey);
  if (!field || !crop || field.state !== 'empty') return;
  if (state.coins < crop.cost) return showToast(t('coinsMissing'));
  state.coins -= crop.cost;
  const now = Date.now();
  field.cropKey = crop.key;
  field.state = 'growing';
  field.watered = false;
  field.startAt = now;
  field.endAt = now + crop.duration * 1000;
  showToast(t('planted'));
  markDirty();
  openFields();
  renderAll();
}
function fertilizeField(fieldId) {
  const field = state.fields[fieldId - 1];
  if (!field || field.state !== 'empty') return;
  if (state.compost < 1) return showToast(t('compostMissing'));
  state.compost -= 1;
  field.fertilized = true;
  if (Math.random() < getRecycleChance()) {
    state.compost = Math.min(250, state.compost + 1);
    showToast(t('recycledToast'));
  } else {
    showToast(t('fertilizedToast'));
  }
  markDirty();
  openFields();
  renderAll();
}
function waterField(fieldId) {
  const field = state.fields[fieldId - 1];
  if (!field || field.state !== 'growing' || field.watered) return;
  const crop = cropData.find(c => c.key === field.cropKey);
  const reduceMs = crop.duration * 1000 * 0.15;
  field.endAt = Math.max(Date.now(), field.endAt - reduceMs);
  field.watered = true;
  if (Date.now() >= field.endAt) field.state = 'ready';
  showToast(t('wateredToast'));
  markDirty();
  openFields();
  renderAll();
}
function harvestField(fieldId) {
  const field = state.fields[fieldId - 1];
  if (!field || field.state !== 'ready') return;
  const crop = cropData.find(c => c.key === field.cropKey);
  let amount = crop.yield;
  if (field.fertilized && Math.random() < getRichChance()) amount *= 2;
  state.inventory[crop.key] += amount;
  addExp(crop.exp);
  field.cropKey = null;
  field.state = 'empty';
  field.watered = false;
  field.fertilized = false;
  field.startAt = null;
  field.endAt = null;
  showToast(`${t('harvested')} +${amount} ${getCropName(crop)}`);
  markDirty();
  openFields();
  renderAll();
}
function sellCrop(cropKey, amount) {
  const crop = cropData.find(c => c.key === cropKey);
  const owned = state.inventory[cropKey] || 0;
  if (!owned) return;
  const count = amount === 'all' ? owned : Math.min(owned, amount);
  state.inventory[cropKey] -= count;
  state.coins += count * crop.cost;
  showToast(`${t('sold')} +${formatNumber(count * crop.cost)} 💰`);
  markDirty();
  openStorage();
  renderAll();
}
function makeCompost() {
  if (state.compost >= 250) return showToast(t('fullCompost'));
  let total = 0;
  cropData.forEach(c => { total += state.inventory[c.key]; });
  if (total < 3) return showToast(t('notEnoughPlants'));
  let toRemove = 3;
  cropData.forEach(c => {
    while (toRemove > 0 && state.inventory[c.key] > 0) {
      state.inventory[c.key] -= 1;
      toRemove -= 1;
    }
  });
  state.compost = Math.min(250, state.compost + 1);
  showToast('+1 compost');
  markDirty();
  openStorage();
  renderAll();
}
function buyCompostPack(idx) {
  const pack = compostPacks[idx];
  if (state.coins < pack.price) return showToast(t('coinsMissing'));
  state.coins -= pack.price;
  state.compost = Math.min(250, state.compost + pack.amount);
  showToast(`+${pack.amount} ${t('compost')}`);
  markDirty();
  openStorage();
  renderAll();
}
function buyField(fieldId) {
  const field = state.fields[fieldId - 1];
  const conf = fieldCosts[fieldId];
  if (!field || field.unlocked) return;
  if (state.level < conf.level) return showToast(t('levelMissing'));
  if (state.coins < conf.price) return showToast(t('coinsMissing'));
  state.coins -= conf.price;
  field.unlocked = true;
  showToast(t('fieldBought'));
  markDirty();
  openFields();
  renderAll();
}

function openUpgrades() {
  modalType = 'upgrades';
  const richNext = state.richCompostLevel;
  const recycleNext = state.recycleLevel;
  const richCan = richNext < 5 && state.coins >= richCompostCosts[richNext];
  const recycleCan = recycleNext < 5 && state.coins >= recycleCosts[recycleNext];
  openModal(`
    <div class="modal-head">
      <h2>⬆️ ${t('upgrades')}</h2>
      <button class="secondary-btn" onclick="closeModal()">${t('close')}</button>
    </div>
    <div class="upgrade-grid">
      <div class="card">
        <h3>${t('richCompost')}</h3>
        <p>${t('doubleHarvest')}</p>
        <p><strong>${t('current')}:</strong> ${richChanceValues[state.richCompostLevel]}%</p>
        <p><strong>${t('next')}:</strong> ${state.richCompostLevel < 5 ? `${richChanceValues[state.richCompostLevel + 1]}%` : 'MAX'}</p>
        <p class="small">${t('price')}: ${state.richCompostLevel < 5 ? formatNumber(richCompostCosts[state.richCompostLevel]) : '—'}</p>
        <button class="primary-btn" onclick="upgradeRichCompost()" ${!richCan ? 'disabled' : ''}>${t('upgrade')}</button>
      </div>
      <div class="card">
        <h3>${t('recycle')}</h3>
        <p>${t('recycleDesc')}</p>
        <p><strong>${t('current')}:</strong> ${recycleChanceValues[state.recycleLevel]}%</p>
        <p><strong>${t('next')}:</strong> ${state.recycleLevel < 5 ? `${recycleChanceValues[state.recycleLevel + 1]}%` : 'MAX'}</p>
        <p class="small">${t('price')}: ${state.recycleLevel < 5 ? formatNumber(recycleCosts[state.recycleLevel]) : '—'}</p>
        <button class="primary-btn" onclick="upgradeRecycle()" ${!recycleCan ? 'disabled' : ''}>${t('upgrade')}</button>
      </div>
    </div>`);
}
function upgradeRichCompost() {
  if (state.richCompostLevel >= 5) return;
  const idx = state.richCompostLevel;
  if (state.coins < richCompostCosts[idx]) return showToast(t('coinsMissing'));
  state.coins -= richCompostCosts[idx];
  state.richCompostLevel += 1;
  markDirty();
  openUpgrades();
  renderAll();
}
function upgradeRecycle() {
  if (state.recycleLevel >= 5) return;
  const idx = state.recycleLevel;
  if (state.coins < recycleCosts[idx]) return showToast(t('coinsMissing'));
  state.coins -= recycleCosts[idx];
  state.recycleLevel += 1;
  markDirty();
  openUpgrades();
  renderAll();
}

async function openRanking() {
  modalType = 'ranking';
  try {
    const result = await apiFetch('/api/ranking');
    const rows = (result.ranking || [])
      .map(({ email, save }) => ({
        email,
        level: save?.level || 1,
        points: getPlayerPoints(save || {}),
        fields: getCurrentFieldCount(save || {}),
        updated: save?.lastSavedAt || 0,
      }))
      .sort((a, b) => b.points - a.points || b.level - a.level || b.updated - a.updated);

    const body = rows.length ? rows.map((row, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${row.email}</td>
        <td>${row.level}</td>
        <td>${formatNumber(row.points)}</td>
        <td>${row.fields}</td>
      </tr>`).join('') : `<tr><td colspan="5">${t('noPlayers')}</td></tr>`;

    openModal(`
      <div class="modal-head">
        <h2>🏆 ${t('rankingTitle')}</h2>
        <button class="secondary-btn" onclick="closeModal()">${t('close')}</button>
      </div>
      <div class="card">
        <table class="ranking-table">
          <thead>
            <tr>
              <th>${t('rank')}</th>
              <th>${t('player')}</th>
              <th>${t('level')}</th>
              <th>${t('points')}</th>
              <th>${t('fields')}</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>`);
  } catch (error) {
    showToast(error.message);
  }
}

async function logout() {
  try { await saveState(); } catch (_e) {}
  try { await apiFetch('/api/logout', { method: 'POST', body: '{}' }); } catch (_e) {}
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(TOKEN_KEY);
  currentUser = null;
  state = null;
  closeModal();
  showAuthScreen();
}

function setupEvents() {
  document.getElementById('auth-form').addEventListener('submit', handleAuth);
  document.getElementById('login-tab').addEventListener('click', () => setAuthMode('login'));
  document.getElementById('register-tab').addEventListener('click', () => setAuthMode('register'));
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentLang = btn.dataset.lang;
      document.querySelectorAll('.lang-btn').forEach(b => b.classList.toggle('active', b === btn));
      updateLanguageUI();
      if (state) renderAll();
    });
  });
  document.getElementById('house-hitbox').addEventListener('click', () => showToast(t('houseInfo')));
  document.getElementById('shed-hitbox').addEventListener('click', openStorage);
  document.getElementById('field-hitbox').addEventListener('click', openFields);
  document.getElementById('ranking-btn').addEventListener('click', openRanking);
  document.getElementById('upgrades-btn').addEventListener('click', openUpgrades);
  document.getElementById('logout-btn').addEventListener('click', logout);
  document.getElementById('modal-backdrop').addEventListener('click', (e) => {
    if (e.target.id === 'modal-backdrop') closeModal();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveState(); });
  window.addEventListener('beforeunload', () => { saveState(); });
}

async function tryAutoLogin() {
  const savedUser = localStorage.getItem(SESSION_KEY);
  const token = localStorage.getItem(TOKEN_KEY);
  if (!savedUser || !token) return;
  try {
    const data = await apiFetch('/api/me');
    currentUser = data.email;
    await loadState(data.email, data.save);
    showGameScreen();
  } catch (_error) {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(TOKEN_KEY);
  }
}

window.openStorage = openStorage;
window.openFields = openFields;
window.openUpgrades = openUpgrades;
window.openRanking = openRanking;
window.closeModal = closeModal;
window.sowCrop = sowCrop;
window.openSowMenu = openSowMenu;
window.fertilizeField = fertilizeField;
window.waterField = waterField;
window.harvestField = harvestField;
window.sellCrop = sellCrop;
window.makeCompost = makeCompost;
window.buyCompostPack = buyCompostPack;
window.buyField = buyField;
window.upgradeRichCompost = upgradeRichCompost;
window.upgradeRecycle = upgradeRecycle;

setupEvents();
setAuthMode('login');
showAuthScreen();
tryAutoLogin();
setInterval(() => {
  if (state) renderAll();
}, 1000);
setInterval(() => {
  if (state && isDirty) saveState();
}, 5000);
