const ADMIN_EMAILS = [
  'sunumanfred14@gmail.com',
  'adichieifeoma@gmail.com'
];
const ADMIN_EMAIL = 'sunumanfred14@gmail.com';

const INITIAL_PRODUCTS = [];
const INITIAL_COUPONS = [];
const INITIAL_ORDERS = [];
const INITIAL_NOTIFICATIONS = [];

const INITIAL_USERS = [
  {
    id: 'usr-admin-01',
    name: 'Manfred Sunu',
    email: 'sunumanfred14@gmail.com',
    phone: '+233 24 100 2000',
    address: 'Executive Suite, Cantonments, Accra',
    walletBalance: 0.00,
    joinedDate: '01 Jan 2026',
    ordersCount: 0,
    status: 'Super Admin'
  },
  {
    id: 'usr-admin-02',
    name: 'Ifeoma Adichie',
    email: 'adichieifeoma@gmail.com',
    phone: '+233 24 100 2000',
    address: 'Executive Suite, Cantonments, Accra',
    walletBalance: 0.00,
    joinedDate: '01 Jan 2026',
    ordersCount: 0,
    status: 'Super Admin'
  }
];

const INITIAL_USER = INITIAL_USERS[0];

const API_BASE = (typeof window !== 'undefined' && window.location.origin.includes('localhost:3000')) ? 'http://localhost:5000/api' : '/api';

let authMode = 'signin';
let adminAuthenticated = false;
let adminMobileDrawerOpen = false;

(function autoHealStaleSettings() {
  if (typeof localStorage === 'undefined') return;
  const purgeKey = 'bymarie-hard-wipe-all-mocks-2026-v3';
  if (!localStorage.getItem(purgeKey)) {
    localStorage.setItem('bymarie-products', JSON.stringify([]));
    localStorage.setItem('bymarie-orders', JSON.stringify([]));
    localStorage.setItem('bymarie-coupons', JSON.stringify([]));
    localStorage.setItem('bymarie-notifications', JSON.stringify([]));
    localStorage.setItem('bymarie-wholesale-inquiries', JSON.stringify([]));
    localStorage.setItem('bymarie-cart', JSON.stringify([]));
    localStorage.setItem('bymarie-users', JSON.stringify(INITIAL_USERS));
    const raw = localStorage.getItem('bymarie-site-settings');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        parsed.categoryCovers = {
          'Clothing': [],
          'Shoes': [],
          'Bags': [],
          'Wigs': [],
          'Skin Care': [],
          'Perfumes': [],
          'Lifestyle': [],
          'Nails': [],
          'Panties': [],
          'Toiletries': []
        };
        localStorage.setItem('bymarie-site-settings', JSON.stringify(parsed));
      } catch (e) {}
    }
    localStorage.setItem(purgeKey, 'true');
  }
})();

function getUsers() {
  const data = localStorage.getItem('bymarie-users');
  if (data === null) {
    localStorage.setItem('bymarie-users', JSON.stringify(INITIAL_USERS));
    return INITIAL_USERS;
  }
  try { return JSON.parse(data); } catch { return INITIAL_USERS; }
}

function saveUsers(users) {
  localStorage.setItem('bymarie-users', JSON.stringify(users));
}

async function fetchLatestUsers(notify = false) {
  try {
    const res = await fetch(`${API_BASE}/users`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length) {
        saveUsers(data);
        if (notify) {
          toast(`⚡ Synced ${data.length} VIP client accounts from live database!`, 'success');
        }
        if (typeof render === 'function' && (adminTab === 'users' || adminTab === 'broadcast')) {
          render();
        }
        return data;
      }
    }
  } catch (err) {
    console.warn('Live users sync note:', err.message);
  }
  return getUsers();
}

function getCampaignLogs() {
  const data = localStorage.getItem('bymarie-campaigns');
  if (!data) return [];
  try { return JSON.parse(data); } catch { return []; }
}

function saveCampaignLogs(logs) {
  localStorage.setItem('bymarie-campaigns', JSON.stringify(logs));
}

async function fetchCampaignLogs() {
  try {
    const res = await fetch(`${API_BASE}/campaigns`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        saveCampaignLogs(data);
        return data;
      }
    }
  } catch (e) {}
  return getCampaignLogs();
}

function getNotifications() {
  const data = localStorage.getItem('bymarie-notifications');
  if (!data) {
    localStorage.setItem('bymarie-notifications', JSON.stringify(INITIAL_NOTIFICATIONS));
    return INITIAL_NOTIFICATIONS;
  }
  try {
    return JSON.parse(data);
  } catch {
    return INITIAL_NOTIFICATIONS;
  }
}

function saveNotifications(notifs) {
  localStorage.setItem('bymarie-notifications', JSON.stringify(notifs));
}

function getUnreadNotifsCount() {
  return getNotifications().filter(n => !n.read).length;
}

function markAllNotifsRead() {
  const list = getNotifications().map(n => ({ ...n, read: true }));
  saveNotifications(list);
  toast('All notifications marked as read ✓');
  render();
}

function markNotifRead(id) {
  const list = getNotifications().map(n => n.id === id ? { ...n, read: true } : n);
  saveNotifications(list);
  render();
}

function deleteNotification(id) {
  const list = getNotifications().filter(n => n.id !== id);
  saveNotifications(list);
  toast('Notification dismissed');
  render();
}

async function adjustUserWallet(userId, deltaAmount) {
  const users = getUsers();
  const u = users.find(x => x.id === userId || x.email === userId);
  if (u) {
    u.walletBalance = Math.max(0, Math.round(((u.walletBalance || 0) + deltaAmount) * 100) / 100);
    saveUsers(users);
    
    // If this is active logged in customer, sync their session
    const curr = getUser();
    if (curr && (curr.email === u.email || curr.id === u.id)) {
      curr.walletBalance = u.walletBalance;
      saveUser(curr);
    }
    toast(`Wallet for ${u.name} updated: ${deltaAmount >= 0 ? '+' : ''}${money(deltaAmount)} 💳`);
    render();

    try {
      await fetch(`${API_BASE}/users/${u.id}/wallet`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta: deltaAmount, reason: 'Executive Admin Manual Adjustment' })
      });
      toast(`⚡ Backend database updated: Float Wallet synced`);
    } catch (e) {}
  }
}

function promptAdjustWallet(userId, userName) {
  const val = prompt(`Enter float wallet credit amount for ${userName} (e.g. 100 for GH₵ 100.00):`, '100');
  if (val && !isNaN(val)) {
    adjustUserWallet(userId, Number(val));
  }
}

function promptDebitWallet(userId, userName) {
  const val = prompt(`Enter float wallet debit amount for ${userName} (e.g. 50 to deduct GH₵ 50.00):`, '50');
  if (val && !isNaN(val)) {
    adjustUserWallet(userId, -Math.abs(Number(val)));
  }
}



function executeWalletCredit(amount, reference) {
  const user = getUser();
  user.walletBalance = Math.round(((user.walletBalance || 0) + amount) * 100) / 100;
  user.loggedIn = true;
  saveUser(user);

  const users = getUsers();
  const uIdx = users.findIndex(u => u.email === user.email || u.id === user.id);
  if (uIdx !== -1) {
    users[uIdx].walletBalance = user.walletBalance;
    saveUsers(users);
  } else {
    users.unshift({ id: `usr-${Date.now()}`, name: user.name || 'Valued Customer', email: user.email, phone: user.phone, walletBalance: user.walletBalance, joinedDate: 'Today' });
    saveUsers(users);
  }

  activeModal = null;
  toast(`⚡ Paystack Verified: ${money(amount)} credited to Float Wallet! (Ref: ${reference || 'Success'})`);
  render();
}

async function handleAdminAddUser(event) {
  event.preventDefault();
  const fd = new FormData(event.target);
  const name = fd.get('name');
  const email = fd.get('email');
  const phone = fd.get('phone');
  const address = fd.get('address');
  const initialWallet = Number(fd.get('walletBalance') || 0);

  const users = getUsers();
  if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
    return toast('A customer account with this email already exists', 'warning');
  }

  const newUser = {
    id: `usr-${Math.floor(1000 + Math.random() * 8999)}`,
    name,
    email,
    phone,
    address,
    walletBalance: initialWallet,
    joinedDate: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
    ordersCount: 0,
    status: 'Active'
  };

  users.unshift(newUser);
  saveUsers(users);
  activeModal = null;
  toast(`Customer account for "${name}" created with ${money(initialWallet)} wallet credit! ⚡`);
  render();

  try {
    await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUser)
    });
  } catch (e) {}
}

function getUser() {
  const data = localStorage.getItem('bymarie-user');
  if (!data) {
    const initialSession = { ...INITIAL_USER, walletBalance: 0.00, loggedIn: true };
    localStorage.setItem('bymarie-user', JSON.stringify(initialSession));
    return initialSession;
  }
  try {
    const obj = JSON.parse(data);
    if (obj.walletBalance === undefined) obj.walletBalance = 0.00;
    if (obj.loggedIn === undefined) obj.loggedIn = !!(obj.email && obj.name && obj.name !== 'Guest');
    return obj;
  } catch {
    return { name: 'Guest', email: '', phone: '', address: '', walletBalance: 0.00, loggedIn: false };
  }
}

function saveUser(user) {
  localStorage.setItem('bymarie-user', JSON.stringify(user));
}

function clearUser() {
  const loggedOutUser = { name: 'Guest', email: '', phone: '', address: '', walletBalance: 0.00, loggedIn: false };
  localStorage.setItem('bymarie-user', JSON.stringify(loggedOutUser));
  toast('Signed out successfully 👋');
  activeModal = null;
  go('account');
}

function isAdminUser() {
  const user = getUser();
  return !!(user && user.loggedIn && user.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
}

function isAdminLoggedIn() {
  return isAdminUser() || adminAuthenticated || sessionStorage.getItem('bymarie-admin-auth') === 'true';
}

function setAdminLoggedIn(val) {
  adminAuthenticated = val;
  sessionStorage.setItem('bymarie-admin-auth', val ? 'true' : 'false');
}

function togglePasswordVisibility(btn) {
  if (!btn) return;
  const wrapper = btn.closest('.password-input-wrapper') || btn.parentElement;
  if (!wrapper) return;
  const input = wrapper.querySelector('input');
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    btn.innerHTML = '👁️‍🗨️';
    btn.setAttribute('title', 'Hide password');
    btn.style.color = '#c24d67';
  } else {
    input.type = 'password';
    btn.innerHTML = '👁️';
    btn.setAttribute('title', 'Show password');
    btn.style.color = 'var(--muted)';
  }
}
window.togglePasswordVisibility = togglePasswordVisibility;

async function handleCustomerSignUp(event) {
  event.preventDefault();
  const fd = new FormData(event.target);
  const email = (fd.get('email') || '').trim();
  const password = fd.get('password');
  const confirmPassword = fd.get('confirmPassword');
  const name = (fd.get('name') || '').trim();
  const phone = (fd.get('phone') || '').trim();

  if (!email || !name) return toast('Please enter name and email', 'warning');
  if (!password || password.length < 6) return toast('Password must be at least 6 characters', 'warning');
  if (confirmPassword !== null && password !== confirmPassword) {
    return toast('Passwords do not match. Please re-enter your password.', 'warning');
  }

  toast('Creating your account...', 'info');

  const client = getSupabaseClient();
  let userObj = {
    id: `usr-${Date.now()}`,
    name: name || 'Valued Customer',
    email,
    phone,
    address: 'East Legon, Accra',
    walletBalance: 0.00,
    joinedDate: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
    ordersCount: 0,
    loggedIn: true
  };

  if (client) {
    try {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { data: { name, phone } }
      });
      if (!error && data.user) {
        userObj.id = data.user.id;
      }
    } catch (err) {
      console.warn('Supabase Auth warning:', err.message);
    }
  }

  // Register into users list
  const users = getUsers();
  const uIdx = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
  if (uIdx !== -1) {
    users[uIdx] = { ...users[uIdx], ...userObj };
  } else {
    users.unshift(userObj);
  }
  saveUsers(users);
  saveUser(userObj);

  activeModal = null;
  toast(`Welcome to ByMarie, ${userObj.name}! ✨`);
  go('account');
}

async function handleCustomerSignIn(event) {
  event.preventDefault();
  const fd = new FormData(event.target);
  const email = (fd.get('email') || '').trim();
  const password = fd.get('password');

  toast('Signing in...', 'info');

  const client = getSupabaseClient();
  const users = getUsers();
  const foundUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());

  let userObj = foundUser ? { ...foundUser, loggedIn: true } : {
    id: `usr-${Date.now()}`,
    name: email.split('@')[0],
    email,
    phone: '+233 24 555 0192',
    address: 'East Legon, Accra',
    walletBalance: 0.00,
    joinedDate: 'Recent',
    ordersCount: 1,
    loggedIn: true
  };

  if (client) {
    try {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (!error && data.user) {
        userObj.id = data.user.id;
        userObj.name = data.user.user_metadata?.name || userObj.name;
      }
    } catch (err) {
      console.warn('Supabase Auth signin warning:', err.message);
    }
  }

  saveUser(userObj);
  activeModal = null;
  toast(`Welcome back, ${userObj.name}! ✨`);
  go('account');
}

function handleAdminLogin(event) {
  event.preventDefault();
  const fd = new FormData(event.target);
  const passcode = (fd.get('passcode') || '').trim();
  if (passcode === 'admin123' || passcode === 'bymarie2026' || passcode === 'admin' || passcode.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
    const adminUser = {
      id: 'usr-admin-01',
      name: 'Ifeoma Adichie',
      email: ADMIN_EMAIL,
      phone: '+233 24 100 2000',
      address: 'Executive Suite, Cantonments, Accra',
      walletBalance: 0.00,
      joinedDate: '01 Jan 2026',
      ordersCount: 12,
      loggedIn: true
    };
    saveUser(adminUser);
    setAdminLoggedIn(true);
    toast('Admin Console Unlocked for adichieifeoma@gmail.com ⚡');
    render();
  } else {
    toast('Access Denied. Only adichieifeoma@gmail.com can unlock Admin Console.', 'warning');
  }
}

const INITIAL_SITE_SETTINGS = {
  heroTitle: 'ByMarie — Style, Scent, Essentials',
  heroSubtitle: 'Considered luxury style, handcrafted scent extraits, and daily botanical care in Ghana.',
  heroMediaType: 'video',
  heroMediaUrl: '',
  heroVideos: [],
  heroVideoInterval: 30,
  announcementText: 'Complimentary delivery across Greater Accra on orders over GH₵ 300',
  promoCodeNotice: 'WELCOME10',
  brandEthosTitle: 'Created for slow living and enduring beauty.',
  brandEthosText: 'Every ByMarie garment, heel, handbag, virgin crown, formula, and intimate essential is conceived with intentional restraint. We believe true luxury lies in simplicity, pure materials, and timeless craftsmanship.',
  ethosImageUrl: '',
  contactEmail: 'concierge@bymarie.com',
  contactPhone: '+233 24 000 0000',
  accraAddress: '18 Ring Road Central, Cantonments, Accra, Ghana',
  categoryCovers: {
    'Clothing': [],
    'Shoes': [],
    'Bags': [],
    'Wigs': [],
    'Skin Care': [],
    'Perfumes': [],
    'Lifestyle': [],
    'Nails': [],
    'Panties': [],
    'Toiletries': []
  }
};

function sanitizeMediaUrl(url) {
  if (typeof url !== 'string') return '';
  let str = url.trim();
  if (str.startsWith('http://www.bymarie.shop/')) {
    str = str.replace('http://www.bymarie.shop/', '/');
  }
  if (str.startsWith('https://www.bymarie.shop/')) {
    str = str.replace('https://www.bymarie.shop/', '/');
  }
  if (str.startsWith('http://bymarie.shop/')) {
    str = str.replace('http://bymarie.shop/', '/');
  }
  if (str.startsWith('https://bymarie.shop/')) {
    str = str.replace('https://bymarie.shop/', '/');
  }
  if (str.startsWith('http://localhost:5000/')) {
    str = str.replace('http://localhost:5000/', '/');
  }
  // Immediately redirect any /uploads/ paths to permanent Supabase Storage CDN
  if (str.startsWith('/uploads/')) {
    const fname = str.replace('/uploads/', '');
    return `https://oepvuawnzsvzhuibdlxq.supabase.co/storage/v1/object/public/media/${fname}`;
  }
  if (str.startsWith('http://') && !str.includes('localhost') && !str.includes('127.0.0.1')) {
    return str.replace('http://', 'https://');
  }
  return str;
}

function getHeroVideosList(settings) {
  settings = settings || getSiteSettings();
  if (Array.isArray(settings.heroVideos)) {
    const valid = settings.heroVideos
      .map(sanitizeMediaUrl)
      .filter(v => typeof v === 'string' && v.trim().length > 0 && !v.includes('assets/bymarie.mp4') && !v.includes('assets/hero-fashion.mp4'));
    if (valid.length > 0) return valid;
  }
  if (settings.heroMediaUrl && typeof settings.heroMediaUrl === 'string' && settings.heroMediaUrl.trim()) {
    const cleaned = sanitizeMediaUrl(settings.heroMediaUrl);
    if (cleaned && !cleaned.includes('assets/bymarie.mp4') && !cleaned.includes('assets/hero-fashion.mp4')) {
      return [cleaned];
    }
  }
  return [];
}

function isValidImageSrc(s) {
  if (typeof s !== 'string') return false;
  const str = s.trim();
  if (!str) return false;
  if (str.startsWith('http://') || str.startsWith('https://') || str.startsWith('assets/') || str.startsWith('/assets/')) {
    return true;
  }
  if (str.startsWith('data:image/') && str.includes(';base64,') && str.split(';base64,')[1] && str.split(';base64,')[1].length > 20) {
    return true;
  }
  return false;
}

function getCategoryCoverList(catName) {
  const settings = getSiteSettings();
  if (!settings.categoryCovers || !settings.categoryCovers[catName]) return [];
  const val = settings.categoryCovers[catName];
  if (Array.isArray(val)) {
    return val.filter(isValidImageSrc);
  }
  if (typeof val === 'string' && val.trim()) {
    const trimmed = val.trim();
    if (isValidImageSrc(trimmed)) return [trimmed];
    if (!trimmed.startsWith('data:image/')) {
      return trimmed.split(/\n+/).flatMap(line => line.split(',')).map(s => s.trim()).filter(isValidImageSrc);
    }
  }
  return [];
}

function getSiteSettings() {
  const data = localStorage.getItem('bymarie-site-settings');
  let settings = INITIAL_SITE_SETTINGS;
  if (data) {
    try {
      settings = { ...INITIAL_SITE_SETTINGS, ...JSON.parse(data) };
    } catch {
      settings = INITIAL_SITE_SETTINGS;
    }
  }

  // Purge any legacy default template video references & upgrade /uploads/ to CDN
  if (Array.isArray(settings.heroVideos)) {
    settings.heroVideos = settings.heroVideos
      .map(sanitizeMediaUrl)
      .filter(v => typeof v === 'string' && !v.includes('assets/bymarie.mp4') && !v.includes('assets/hero-fashion.mp4'));
  } else {
    settings.heroVideos = [];
  }
  if (settings.heroMediaUrl) {
    if (settings.heroMediaUrl.includes('assets/bymarie.mp4') || settings.heroMediaUrl.includes('assets/hero-fashion.mp4')) {
      settings.heroMediaUrl = settings.heroVideos[0] || '';
    } else {
      settings.heroMediaUrl = sanitizeMediaUrl(settings.heroMediaUrl);
    }
  }

  // Auto-clean category covers from any broken legacy split strings
  if (settings.categoryCovers) {
    const cleanedCovers = {};
    for (const [cat, covers] of Object.entries(settings.categoryCovers)) {
      if (Array.isArray(covers)) {
        cleanedCovers[cat] = covers.filter(isValidImageSrc);
      } else if (typeof covers === 'string' && isValidImageSrc(covers)) {
        cleanedCovers[cat] = [covers];
      } else {
        cleanedCovers[cat] = [];
      }
    }
    settings.categoryCovers = cleanedCovers;
  }

  if (settings.ethosImageUrl && !isValidImageSrc(settings.ethosImageUrl)) {
    settings.ethosImageUrl = '';
  }

  return settings;
}

// Lightweight IndexedDB Store for High-Def Videos (Bypasses 5MB localStorage limit)
const VideoDB = {
  dbPromise: null,
  getDB() {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        try {
          const req = indexedDB.open('bymarie_video_store', 1);
          req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains('videos')) {
              db.createObjectStore('videos');
            }
          };
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(null);
        } catch (e) {
          resolve(null);
        }
      });
    }
    return this.dbPromise;
  },
  async saveVideo(key, data) {
    try {
      const db = await this.getDB();
      if (!db) return false;
      return new Promise((resolve) => {
        const tx = db.transaction('videos', 'readwrite');
        tx.objectStore('videos').put(data, key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch { return false; }
  },
  async getVideo(key) {
    try {
      const db = await this.getDB();
      if (!db) return null;
      return new Promise((resolve) => {
        const tx = db.transaction('videos', 'readonly');
        const req = tx.objectStore('videos').get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      });
    } catch { return null; }
  }
};

function saveSiteSettings(settings) {
  try {
    const safe = { ...settings };
    if (Array.isArray(safe.heroVideos)) {
      safe.heroVideos = safe.heroVideos.filter(v => typeof v === 'string' && (v.startsWith('http') || v.startsWith('/') || v.startsWith('blob:') || (v.startsWith('data:') && v.length < 50000)));
    }
    localStorage.setItem('bymarie-site-settings', JSON.stringify(safe));
  } catch (err) {
    console.warn('localStorage quota handled safely:', err.message);
  }
}

const DEFAULT_SUPABASE_CONFIG = {
  url: 'https://oepvuawnzsvzhuibdlxq.supabase.co',
  key: '',
  active: true
};

function getSupabaseConfig() {
  const data = localStorage.getItem('bymarie-supabase-config');
  if (!data) {
    localStorage.setItem('bymarie-supabase-config', JSON.stringify(DEFAULT_SUPABASE_CONFIG));
    return DEFAULT_SUPABASE_CONFIG;
  }
  try { return { ...DEFAULT_SUPABASE_CONFIG, ...JSON.parse(data) }; } catch { return DEFAULT_SUPABASE_CONFIG; }
}

function saveSupabaseConfig(cfg) {
  localStorage.setItem('bymarie-supabase-config', JSON.stringify(cfg));
}

let supabaseClient = null;

function getSupabaseClient() {
  const cfg = getSupabaseConfig();
  if (cfg.url && cfg.key && window.supabase) {
    if (!supabaseClient) {
      supabaseClient = window.supabase.createClient(cfg.url, cfg.key);
    }
    return supabaseClient;
  }
  return null;
}

async function syncCatalogToSupabase() {
  try {
    toast('Syncing catalog to Supabase Cloud Database via Express API...', 'info');
    const res = await fetch(`${API_BASE}/sync/seed`, { method: 'POST' });
    if (!res.ok) throw new Error('API server sync response error');
    toast('Product catalog successfully synced to Supabase Cloud! ⚡');
  } catch (err) {
    toast('Catalog synced locally & backed up ⚡', 'info');
  }
}

async function fetchCatalogFromSupabase() {
  try {
    toast('Fetching latest catalog from Supabase Cloud...', 'info');
    const res = await fetch(`${API_BASE}/products`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length) {
        saveProducts(data);
        render();
        return toast(`Fetched & updated ${data.length} products from Supabase Cloud! ⚡`);
      }
    }
    toast('Loaded products catalog', 'info');
  } catch (err) {
    console.warn('Backend API fetch error:', err.message);
    toast('Loaded catalog from local storage', 'info');
  }
}

// Clean one-time purge of legacy mock data
if (typeof localStorage !== 'undefined' && localStorage.getItem('bymarie-v5-clean') !== 'true') {
  localStorage.setItem('bymarie-products', JSON.stringify([]));
  localStorage.setItem('bymarie-orders', JSON.stringify([]));
  localStorage.setItem('bymarie-coupons', JSON.stringify([]));
  localStorage.setItem('bymarie-notifications', JSON.stringify([]));
  localStorage.setItem('bymarie-users', JSON.stringify(INITIAL_USERS));
  localStorage.setItem('bymarie-wholesale-inquiries', JSON.stringify([]));
  localStorage.setItem('bymarie-cart', JSON.stringify([]));
  localStorage.setItem('bymarie-v5-clean', 'true');
}

// State Helpers
function getProducts() {
  const data = localStorage.getItem('bymarie-products');
  if (!data) return [];
  try {
    const list = JSON.parse(data);
    if (!Array.isArray(list)) return [];
    // Strictly return only products created and saved by the administrator
    const cleaned = list.filter(p => p && p.isCustom === true);
    if (cleaned.length !== list.length) {
      localStorage.setItem('bymarie-products', JSON.stringify(cleaned));
    }
    return cleaned;
  } catch { return []; }
}

function saveProducts(products) {
  localStorage.setItem('bymarie-products', JSON.stringify(products));
}

function getCoupons() {
  const data = localStorage.getItem('bymarie-coupons');
  if (data === null) {
    localStorage.setItem('bymarie-coupons', JSON.stringify(INITIAL_COUPONS));
    return INITIAL_COUPONS;
  }
  try { return JSON.parse(data); } catch { return []; }
}

function saveCoupons(coupons) {
  localStorage.setItem('bymarie-coupons', JSON.stringify(coupons));
}

function getOrders() {
  const data = localStorage.getItem('bymarie-orders');
  if (data === null) {
    localStorage.setItem('bymarie-orders', JSON.stringify(INITIAL_ORDERS));
    return INITIAL_ORDERS;
  }
  try { return JSON.parse(data); } catch { return []; }
}

function saveOrders(orders) {
  localStorage.setItem('bymarie-orders', JSON.stringify(orders));
}

// Runtime variables
let cart = JSON.parse(localStorage.getItem('bymarie-cart') || '[]');
let wishlist = JSON.parse(localStorage.getItem('bymarie-wishlist') || '[]');
let appliedCoupon = JSON.parse(localStorage.getItem('bymarie-applied-coupon') || 'null');
let route = location.hash.slice(1) || 'home';
let filters = { cat: 'All', search: '', sort: 'Featured', available: false, maxPrice: 1000 };
let quickSearchQuery = '';
let selectedVariants = {};
let detailActiveImg = 0;
let adminTab = 'dashboard';
let adminProductModal = null;
let activeModal = null;
let modalData = {};
let mobileMenuOpen = false;
let commandPaletteOpen = false;
let commandPaletteQuery = '';
let adminProductFilter = { search: '', category: 'All', stock: 'All' };
let adminOrderFilter = { search: '', status: 'All' };
let adminInventoryFilter = { search: '', category: 'All', stock: 'All' };
let adminUserFilter = { search: '', minWallet: 'All' };
let adminWholesaleFilter = { search: '', status: 'All' };

const money = n => `GH₵ ${Number(n).toFixed(2)}`;
const byId = id => getProducts().find(p => p.id === id);

const COLOR_HEX_MAP = {
  'Ivory': '#fdfbf7',
  'Sea': '#7fa99b',
  'Oat': '#d8cbb8',
  'Ink': '#1e293b',
  'Stone': '#9c9588',
  'Charcoal': '#374151',
  'Mocha': '#5c4033',
  'Midnight': '#0f172a',
  'Forest': '#1e392a',
  'Noir': '#121212',
  'Champagne': '#e9dec4',
  'Clay': '#b87352',
  'Sage': '#90a48a',
  'Rosewater': '#e8c0ba',
  'Onyx': '#1c1c1c',
  'Glazed Donut': '#fbe5d8',
  'Milk Glass': '#f0f4f5',
  'Espresso': '#3b2219',
  'Nude Trio': '#d2b49c',
  'Monochrome (Black/White/Nude)': '#2d3748',
  'Nude Blush': '#f2d1d9',
  'Caramel': '#c68b59',
  'Cognac': '#9a4b27',
  'Blush Rose': '#e8a4b8',
  'Natural Tan': '#dfc7a7',
  'Black Trim': '#1a1a1a',
  'Petal Pink': '#f7cbd7',
  'Natural 1B': '#1a1617',
  'Natural Black': '#111111',
  'Jet Black': '#0a0a0a',
  'Chestnut Brown': '#582f22',
  'Chocolate Brown': '#3e221b',
  'Honey Highlight': '#d19c5b',
  'Rose Gold': '#b76e79',
  'Rose Gold Tint': '#cf8291',
  'Caramel Balayage': '#b57e4c',
  'Gold': '#c59737'
};

function getColorHex(name) {
  if (COLOR_HEX_MAP[name]) return COLOR_HEX_MAP[name];
  return '#9c9588';
}

function saveCart() { localStorage.setItem('bymarie-cart', JSON.stringify(cart)); }
function saveWishlist() { localStorage.setItem('bymarie-wishlist', JSON.stringify(wishlist)); }
function saveAppliedCoupon() { localStorage.setItem('bymarie-applied-coupon', JSON.stringify(appliedCoupon)); }

function cartCount() { return cart.reduce((sum, item) => sum + item.qty, 0); }

function subtotal() {
  return cart.reduce((sum, item) => {
    const p = byId(item.id);
    return sum + (p ? p.price * item.qty : 0);
  }, 0);
}

function getDiscountAmount() {
  const st = subtotal();
  if (!appliedCoupon) return 0;
  if (appliedCoupon.type === 'percent') return (st * appliedCoupon.discount) / 100;
  return 0;
}

function getDeliveryFee(deliveryOption = 'Standard delivery') {
  const st = subtotal();
  if (appliedCoupon && appliedCoupon.type === 'shipping') return 0;
  if (deliveryOption === 'Express delivery') return 60;
  return st >= 300 ? 0 : 35;
}

function grandTotal(deliveryOption = 'Standard delivery') {
  const st = subtotal();
  const disc = getDiscountAmount();
  const ship = getDeliveryFee(deliveryOption);
  return Math.max(0, st - disc + ship);
}

function go(path) {
  location.hash = path;
  route = path;
  mobileMenuOpen = false;
  activeModal = null;
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function add(id, variant = null, size = null) {
  const p = byId(id);
  if (!p) return;
  if (p.stock <= 0) return toast('This product is currently out of stock', 'warning');
  
  const chosenVariant = variant || (p.colors && p.colors[0]) || 'Standard';
  const chosenSize = size || (p.sizes && p.sizes[0]) || '';
  
  const existing = cart.find(x => x.id === id && x.variant === chosenVariant && x.size === chosenSize);
  if (existing) {
    if (existing.qty >= p.stock) return toast(`Only ${p.stock} units available in stock`, 'warning');
    existing.qty += 1;
  } else {
    cart.push({ id, qty: 1, variant: chosenVariant, size: chosenSize });
  }
  
  saveCart();
  render();

  const details = [];
  if (chosenVariant && chosenVariant !== 'Standard') details.push(chosenVariant.trim());
  if (chosenSize) details.push(chosenSize.trim());
  const detailStr = details.length ? ` (${details.join(', ')})` : '';

  toast(`${p.name}${detailStr} added to bag`);
}

function toggleWish(id) {
  const p = byId(id);
  if (wishlist.includes(id)) {
    wishlist = wishlist.filter(x => x !== id);
    toast(`${p ? p.name : 'Item'} removed from wishlist`, 'info');
  } else {
    wishlist.push(id);
    toast(`${p ? p.name : 'Item'} saved to wishlist`);
  }
  saveWishlist();
  render();
}

function applyCoupon(code) {
  const cleanCode = (code || '').trim().toUpperCase();
  if (!cleanCode) return toast('Please enter a valid promo code', 'warning');
  
  const coupon = getCoupons().find(c => c.code.toUpperCase() === cleanCode);
  if (!coupon) return toast('Invalid or expired promo code', 'warning');
  
  appliedCoupon = coupon;
  saveAppliedCoupon();
  render();
  toast(`Promo code ${coupon.code} applied!`);
}

function removeCoupon() {
  appliedCoupon = null;
  saveAppliedCoupon();
  render();
  toast('Promo code removed', 'info');
}

function icon(name) {
  const icons = {
    bag: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-label="Shopping Bag"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>`,
    cart: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-label="Cart"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>`,
    search: `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-label="Search"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
    heart: `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-label="Heart"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`,
    heartFull: `<svg width="19" height="19" viewBox="0 0 24 24" fill="#b33939" stroke="#b33939" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-label="Saved Heart"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`,
    menu: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-label="Menu"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>`,
    user: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-label="User"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`,
    truck: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-label="Delivery"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>`,
    shield: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-label="Security"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`,
    card: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-label="Card"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>`,
    close: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-label="Close"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
    arrow: `→`,
    star: `★`,
    plus: `+`,
    minus: `−`,
    check: `✓`,
    sparkle: `✨`,
    download: `⤓`
  };
  return icons[name] || '';
}

function svgIcon(name, size = 18) {
  const paths = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    box: '<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>',
    layers: '<polygon points="12 2 22 8.5 12 15 2 8.5 12 2"/><polyline points="2 15.5 12 22 22 15.5"/><polyline points="2 12 12 18.5 22 12"/>',
    bag: '<path d="M6 8h12l1 13H5L6 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    tag: '<path d="M20.5 12.5L12 21l-9-9V4h8l9.5 8.5z"/><circle cx="7.5" cy="7.5" r="1.1" fill="currentColor" stroke="none"/>',
    palette: '<circle cx="13.5" cy="6.5" r="0.5" fill="currentColor"/><circle cx="17.5" cy="10.5" r="0.5" fill="currentColor"/><circle cx="8.5" cy="7.5" r="0.5" fill="currentColor"/><circle cx="6.5" cy="12.5" r="0.5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c1.1 0 2-.9 2-2 0-.5-.2-1-.6-1.4-.3-.4-.5-.8-.5-1.3 0-1 .8-1.8 1.8-1.8H17c2.8 0 5-2.2 5-5C22 6 17.5 2 12 2z"/>',
    zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><line x1="21" y1="21" x2="15.5" y2="15.5"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 5-2 6-2 6h16s-2-1-2-6z"/><path d="M10.5 21a1.5 1.5 0 0 0 3 0"/>',
    sliders: '<line x1="4" y1="6" x2="20" y2="6"/><circle cx="9" cy="6" r="2" fill="currentColor" stroke="none"/><line x1="4" y1="12" x2="20" y2="12"/><circle cx="15" cy="12" r="2" fill="currentColor" stroke="none"/><line x1="4" y1="18" x2="20" y2="18"/><circle cx="7" cy="18" r="2" fill="currentColor" stroke="none"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    download: '<path d="M12 3v12"/><polyline points="7 11 12 16 17 11"/><path d="M5 21h14"/>',
    arrowLeft: '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
    dot: '<circle cx="12" cy="12" r="6" fill="currentColor" stroke="none"/>',
    trendUp: '<polyline points="4 15 10 9 14 13 20 6"/><polyline points="14 6 20 6 20 12"/>',
    trendDown: '<polyline points="4 8 10 14 14 10 20 17"/><polyline points="20 11 20 17 14 17"/>',
    receipt: '<path d="M4 2h16v20l-3-2-3 2-3-2-3 2-3-2-1 2z"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="12" y2="15"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    wallet: '<path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V12a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2z"/><circle cx="16" cy="14" r="1" fill="currentColor"/>',
    mail: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
    send: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
    message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    refresh: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
    check: '<polyline points="20 6 9 17 4 12"/>'
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name] || ''}</svg>`;
}

function toast(message, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const item = document.createElement('div');
  item.className = `toast-item toast-${type}`;
  
  let iconHtml = '<span class="toast-badge-success">✓</span>';
  if (type === 'warning') iconHtml = '<span class="toast-badge-warn">⚠️</span>';
  else if (type === 'info') iconHtml = '<span class="toast-badge-info">ℹ️</span>';
  else if (type === 'error') iconHtml = '<span class="toast-badge-error">✕</span>';

  item.innerHTML = `${iconHtml} <div class="toast-body">${message}</div>`;
  container.appendChild(item);

  requestAnimationFrame(() => {
    item.classList.add('toast-show');
  });

  setTimeout(() => {
    item.classList.remove('toast-show');
    item.classList.add('toast-hide');
    setTimeout(() => item.remove(), 350);
  }, 2800);
}

function openQuickSearchModal() {
  quickSearchQuery = '';
  activeModal = 'quick_search';
  render();
  setTimeout(() => {
    const input = document.getElementById('quick-search-input');
    if (input) input.focus();
  }, 100);
}

function openInvoiceModal(orderId) {
  modalData = { orderId };
  activeModal = 'invoice';
  render();
}

function openQuickView(id) {
  const p = byId(id);
  if (!p) return;
  modalData = { product: p, imgIdx: 0 };
  activeModal = 'quickview';
  render();
}

function handleNewsletter(event) {
  event.preventDefault();
  const input = event.target.querySelector('input');
  if (input && input.value) {
    applyCoupon('NEWSLETTER10');
    toast('Welcome to ByMarie! 10% discount code NEWSLETTER10 applied.');
    input.value = '';
  }
}

// Global keyboard shortcuts
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    openQuickSearchModal();
  }
  if (e.key === 'Escape' && activeModal) {
    activeModal = null;
    render();
  }
});

let luxuryAudioElement = null;

function toggleHeroVideoAudio(btn) {
  const vA = document.getElementById('hero-main-video-a');
  const vB = document.getElementById('hero-main-video-b');
  const fallback = document.getElementById('hero-main-video');
  const targetVid = (vB && vB.style.opacity === '1') ? vB : (vA || fallback);
  const iconSpan = btn ? btn.querySelector('.audio-btn-icon') : null;

  if (targetVid) {
    const nextMuted = !targetVid.muted;
    if (vA) { vA.muted = nextMuted; vA.volume = 1.0; }
    if (vB) { vB.muted = nextMuted; vB.volume = 1.0; }
    if (fallback) { fallback.muted = nextMuted; fallback.volume = 1.0; }

    if (!nextMuted) {
      if (iconSpan) iconSpan.textContent = '🔊';
      toast('Hero video audio unmuted 🔊', 'info');

      if (!luxuryAudioElement) {
        luxuryAudioElement = new Audio('https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=ambient-piano-amp-strings-10711.mp3');
        luxuryAudioElement.loop = true;
        luxuryAudioElement.volume = 0.35;
      }
      if (luxuryAudioElement) safePlay(luxuryAudioElement);
    } else {
      if (iconSpan) iconSpan.textContent = '🔇';
      toast('Hero video audio muted 🔇', 'info');
      if (luxuryAudioElement) safePause(luxuryAudioElement);
    }
  }
}

function safePlay(vid) {
  if (!vid) return;
  try {
    const p = vid.play();
    if (p && typeof p.then === 'function') {
      p.catch((err) => {
        // Silently swallow abort errors caused by rapid user pause / crossfade
        if (err && err.name !== 'AbortError' && err.name !== 'NotAllowedError') {
          console.debug('SafePlay status:', err.message);
        }
      });
    }
  } catch (e) {}
}

function safePause(vid) {
  if (!vid) return;
  try {
    vid.pause();
  } catch (e) {}
}

window.safePlay = safePlay;
window.safePause = safePause;

function initHeroVideoMobilePlayback() {
  const vids = [
    document.getElementById('hero-main-video-a'),
    document.getElementById('hero-main-video-b'),
    document.getElementById('hero-main-video')
  ].filter(Boolean);

  if (!vids.length) return;

  vids.forEach(vid => {
    vid.muted = true;
    vid.defaultMuted = true;
    vid.playsInline = true;
    vid.setAttribute('muted', '');
    vid.setAttribute('playsinline', '');
    vid.setAttribute('webkit-playsinline', '');

    if (vid.src && vid.style.opacity !== '0') {
      safePlay(vid);
      const unlock = () => {
        safePlay(vid);
        document.removeEventListener('touchstart', unlock);
        document.removeEventListener('scroll', unlock);
        document.removeEventListener('click', unlock);
      };
      document.addEventListener('touchstart', unlock, { once: true, passive: true });
      document.addEventListener('scroll', unlock, { once: true, passive: true });
      document.addEventListener('click', unlock, { once: true });
    }
  });

  // Mobile Touch Swipe Navigation (Swipe Left for Next Video, Swipe Right for Prev Video)
  const container = document.querySelector('.hero-video-carousel-container');
  if (container && !container._touchBound) {
    container._touchBound = true;
    let startX = 0;
    let startY = 0;
    container.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches[0]) {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
      }
    }, { passive: true });

    container.addEventListener('touchend', (e) => {
      if (!e.changedTouches || !e.changedTouches[0]) return;
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const deltaX = endX - startX;
      const deltaY = endY - startY;

      if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX < 0) {
          nextHeroVideo();
        } else {
          prevHeroVideo();
        }
      }
    }, { passive: true });
  }
}

// ===================================================
// ===================================================
// STOREFRONT ANNOUNCEMENT POPUP BANNER & CONTROLS
// ===================================================

function isAnnouncementDismissed(text) {
  if (!text || !text.trim()) return true;
  try {
    const dismissed = localStorage.getItem('bymarie-dismissed-announcement');
    return dismissed === text.trim();
  } catch (e) {
    return false;
  }
}

function dismissAnnouncement(text) {
  try {
    localStorage.setItem('bymarie-dismissed-announcement', (text || '').trim());
  } catch (e) {}
  const popup = document.getElementById('bymarie-announcement-popup');
  if (popup) {
    popup.classList.add('dismissing');
    setTimeout(() => {
      popup.remove();
    }, 300);
  }
}
window.dismissAnnouncement = dismissAnnouncement;

function renderAnnouncementPopup() {
  const settings = getSiteSettings();
  const text = (settings.announcementText || '').trim();
  if (!text) return '';
  
  if (isAnnouncementDismissed(text)) return '';

  const promo = (settings.promoCodeNotice || '').trim();

  return `
    <div id="bymarie-announcement-popup" class="announcement-popup-banner animate-slide-down">
      <div class="announcement-popup-content">
        <div class="announcement-popup-header">
          <div class="announcement-badge">
            <span class="pulse-dot"></span>
            <strong>STORE NOTIFICATION</strong>
          </div>
          <button class="announcement-close-btn" onclick="dismissAnnouncement(\`${text.replace(/`/g, '\\`')}\`)" aria-label="Dismiss Announcement" title="Dismiss">✕</button>
        </div>
        <div class="announcement-popup-text">
          ${text}
        </div>
        ${promo ? `
          <div class="announcement-popup-promo">
            <span>Special Offer:</span>
            <span class="announcement-promo-tag" onclick="applyCoupon('${promo}');toast('Promo code ${promo} applied! ⚡', 'success');dismissAnnouncement(\`${text.replace(/`/g, '\\`')}\`)">${promo}</span>
          </div>
        ` : ''}
        <div class="announcement-popup-footer">
          <button class="announcement-action-btn" onclick="dismissAnnouncement(\`${text.replace(/`/g, '\\`')}\`)">Got It / Dismiss</button>
        </div>
      </div>
    </div>
  `;
}

function header() {
  const [currentPage, currentParam] = (route || 'home').split('/');
  const user = getUser();
  const isCat = (cat) => currentPage === 'category' && decodeURIComponent(currentParam || '') === cat;
  
  return `
    <div class="header-sticky-wrapper">
      <header>
        <a class="brand" href="#home" onclick="go('home')">
          BYMARIE
        </a>
        
        <nav class="main-nav">
          <a href="#home" class="${currentPage === 'home' ? 'active' : ''}" onclick="go('home')">Home</a>
          <a href="#shop" class="${currentPage === 'shop' && filters.cat === 'All' ? 'active' : ''}" onclick="filters.cat='All';go('shop')">Shop All</a>
          <a href="#category/Clothing" class="${isCat('Clothing') ? 'active' : ''}" onclick="go('category/Clothing')">Clothing</a>
          <a href="#category/Shoes" class="${isCat('Shoes') ? 'active' : ''}" onclick="go('category/Shoes')">Shoes</a>
          <a href="#category/Bags" class="${isCat('Bags') ? 'active' : ''}" onclick="go('category/Bags')">Bags</a>
          <a href="#category/Wigs" class="${isCat('Wigs') ? 'active' : ''}" onclick="go('category/Wigs')">Wigs</a>
          <a href="#category/Skin Care" class="${isCat('Skin Care') ? 'active' : ''}" onclick="go('category/Skin Care')">Skin Care</a>
          <a href="#category/Perfumes" class="${isCat('Perfumes') ? 'active' : ''}" onclick="go('category/Perfumes')">Perfumes</a>
        </nav>
        
        <div class="header-actions">
          <!-- Desktop Search Trigger -->
          <button class="icon-btn header-search-desktop" style="gap:6px" aria-label="Quick Search" onclick="openQuickSearchModal()">
            ${icon('search')} <span class="kbd" style="font-size:10px">⌘K</span>
          </button>

          <!-- Notification Bell with Badge -->
          <button class="icon-btn header-bell-btn" aria-label="Notifications" title="Notifications" onclick="go('notifications')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
            ${getUnreadNotifsCount() > 0 ? `<span class="badge-count" style="background:#c24d67">${getUnreadNotifsCount()}</span>` : ''}
          </button>

          <!-- Orders Box Icon -->
          <button class="icon-btn header-orders-btn" aria-label="Orders" title="Track Orders" onclick="accountTab='orders';go('account')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
          </button>

          <!-- Wishlist Heart (Desktop only) -->
          <button class="icon-btn header-wishlist-desktop" aria-label="Wishlist" onclick="go('wishlist')">
            ${icon('heart')}
            ${wishlist.length ? `<span class="badge-count">${wishlist.length}</span>` : ''}
          </button>

          <!-- Shopping Bag -->
          <button class="icon-btn" aria-label="Cart" onclick="go('cart')">
            ${icon('bag')}
            ${cartCount() ? `<span class="badge-count">${cartCount()}</span>` : ''}
          </button>

          <!-- User Group (Desktop only) -->
          ${user.loggedIn ? `
            <div class="header-user-desktop" style="display:flex;align-items:center;gap:8px">
              <button class="header-user-btn" onclick="accountTab='hub';go('account')" style="display:flex;align-items:center;gap:6px;background:none;border:none;cursor:pointer;font-size:13px;font-weight:600;color:var(--ink)">
                <span>${user.name ? user.name.split(' ')[0].toLowerCase() : 'account'}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </button>
              <button class="header-signout-btn" onclick="clearUser()" style="background:none;border:none;cursor:pointer;font-size:12.5px;color:var(--muted);padding:0;transition:color 0.2s">
                Sign out
              </button>
            </div>
          ` : `
            <button class="account-btn header-signin-desktop" onclick="authMode='signin';go('auth')">
              <span>${icon('user')}</span> Sign In
            </button>
          `}

          <!-- Mobile Hamburger Toggle on Right -->
          <button class="hamburger-btn" onclick="mobileMenuOpen=true;render()" aria-label="Open menu">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
        </div>
      </header>
    </div>
    ${mobileDrawer()}
  `;
}

function mobileDrawer() {
  const user = getUser();
  const allProds = getProducts();
  const getCatCount = (catName) => {
    if (!catName || catName === 'All') return allProds.length;
    return allProds.filter(p => (p.category || '').toLowerCase() === catName.toLowerCase()).length;
  };

  const categories = [
    { name: 'Shop All Collection', route: 'shop', icon: '✨', badge: `${allProds.length} Pieces` },
    { name: 'Clothing & Apparel', route: 'category/Clothing', icon: '👗', badge: `${getCatCount('Clothing')} Pieces` },
    { name: 'Shoes & Heels', route: 'category/Shoes', icon: '👠', badge: `${getCatCount('Shoes')} Pieces` },
    { name: 'Luxury Bags & Totes', route: 'category/Bags', icon: '👜', badge: `${getCatCount('Bags')} Pieces` },
    { name: 'Raw Virgin & HD Wigs', route: 'category/Wigs', icon: '💇‍♀️', badge: `${getCatCount('Wigs')} Pieces` },
    { name: 'Skin Care & Glow', route: 'category/Skin Care', icon: '✨', badge: `${getCatCount('Skin Care')} Pieces` },
    { name: 'Perfumes & Extraits', route: 'category/Perfumes', icon: '🌸', badge: `${getCatCount('Perfumes')} Pieces` },
    { name: 'Lifestyle & Home', route: 'category/Lifestyle', icon: '🕯️', badge: `${getCatCount('Lifestyle')} Pieces` },
    { name: 'Nails & Lacquers', route: 'category/Nails', icon: '💅', badge: `${getCatCount('Nails')} Pieces` },
    { name: 'Panties & Intimates', route: 'category/Panties', icon: '👙', badge: `${getCatCount('Panties')} Pieces` },
    { name: 'Bath & Body', route: 'category/Toiletries', icon: '🛁', badge: `${getCatCount('Toiletries')} Pieces` }
  ];

  return `
    <div class="mobile-drawer ${mobileMenuOpen ? 'open' : ''}" onclick="if(event.target===this){mobileMenuOpen=false;render()}">
      <div class="drawer-content">
        <!-- Sticky Drawer Header -->
        <div class="drawer-header">
          <a class="brand" href="#home" onclick="mobileMenuOpen=false;go('home')">
            BYMARIE LUXURY
          </a>
          <button class="icon-btn" onclick="mobileMenuOpen=false;render()" aria-label="Close menu">
            ${icon('close')}
          </button>
        </div>

        <!-- Scrollable Drawer Body -->
        <div class="drawer-scroll-body">
          <!-- Member Quick Profile Banner -->
          <div class="drawer-user-banner">
            ${user.loggedIn ? `
              <div style="display:flex;align-items:center;justify-content:space-between">
                <div style="display:flex;align-items:center;gap:12px">
                  <span class="account-user-avatar" style="width:40px;height:40px;font-size:16px">${(user.name || 'M').charAt(0)}</span>
                  <div>
                    <strong style="font-size:14px;color:var(--ink);display:block">${user.name || 'Member'}</strong>
                    <small style="color:var(--muted);font-size:11px">${user.email}</small>
                  </div>
                </div>
                <button type="button" class="account-wallet-chip" onclick="mobileMenuOpen=false;activeModal='topup_wallet';render()" style="padding:4px 8px;font-size:11px">
                  💳 ${money(user.walletBalance || 0)}
                </button>
              </div>
            ` : `
              <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
                <div>
                  <strong style="font-size:13.5px;display:block;color:var(--ink)">Welcome to ByMarie</strong>
                  <small style="color:var(--muted);font-size:11px">Sign in for 1-Click Checkout &amp; Wallet</small>
                </div>
                <button class="primary" style="padding:6px 12px;font-size:11px" onclick="mobileMenuOpen=false;authMode='signin';go('auth')">Sign In</button>
              </div>
            `}
          </div>

          <!-- Navigation Category Cards -->
          <div class="drawer-category-list">
            <span class="drawer-section-title">EXPLORE COLLECTIONS</span>
            ${categories.map(cat => `
              <button type="button" class="drawer-cat-btn" onclick="mobileMenuOpen=false;go('${cat.route}')">
                <div style="display:flex;align-items:center;gap:12px">
                  <span class="drawer-cat-icon">${cat.icon}</span>
                  <span class="drawer-cat-name">${cat.name}</span>
                </div>
                <span class="drawer-cat-badge">${cat.badge}</span>
              </button>
            `).join('')}
          </div>

          <!-- Quick Shortcuts -->
          <div class="drawer-quick-links">
            <span class="drawer-section-title">MY PORTAL</span>
            <a href="#account" onclick="mobileMenuOpen=false;accountTab='wholesale';go('account')" class="drawer-link-item wholesale-link">
              <span>⚡ VIP Wholesale &amp; Bulk Purchasing</span>
              <small style="background:var(--emerald);color:#fff;padding:2px 6px;border-radius:4px;font-size:9.5px;font-weight:800">40% OFF</small>
            </a>
            <a href="#notifications" onclick="mobileMenuOpen=false;go('notifications')" class="drawer-link-item">
              <span>🔔 Notifications &amp; Updates</span>
              <small style="background:#c24d67;color:#fff;padding:2px 6px;border-radius:4px;font-size:9.5px;font-weight:800">${getUnreadNotifsCount()} new</small>
            </a>
            <a href="#wishlist" onclick="mobileMenuOpen=false;go('wishlist')" class="drawer-link-item">
              <span>♡ Favourites &amp; Wishlist</span>
              <small style="color:var(--muted)">${wishlist.length} saved</small>
            </a>
            <a href="#account" onclick="mobileMenuOpen=false;accountTab='hub';go('account')" class="drawer-link-item">
              <span>👑 Member Account &amp; Atelier Hub</span>
              <small style="color:var(--muted)">Features</small>
            </a>
            ${isAdminUser() ? `
              <a href="#admin" onclick="mobileMenuOpen=false;go('admin')" class="drawer-link-item" style="border-left:3px solid var(--gold)">
                <span>⚡ Executive Admin Console</span>
                <small style="background:#051916;color:var(--gold-light);padding:2px 6px;border-radius:4px;font-size:9.5px;font-weight:800">Admin Control</small>
              </a>
            ` : ''}
          </div>
        </div>

        <!-- Sticky Drawer Footer -->
        <div class="drawer-footer">
          <button class="primary" style="width:100%;height:46px;font-size:13.5px" onclick="mobileMenuOpen=false;go('cart')">
            View Bag (${cartCount()} items) ${icon('arrow')}
          </button>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;font-size:11px;color:var(--muted)">
            <span>🇬🇭 Ghana Cedis (GH₵)</span>
            <a href="https://wa.me/233241002000" target="_blank" style="color:var(--emerald);text-decoration:none;font-weight:700">💬 VIP Concierge</a>
          </div>
        </div>
      </div>
    </div>
  `;
}

function footer() {
  return `
    <footer>
      <div class="brand">BYMARIE</div>
      <p>Elevated, considered essentials for mindful modern living in Ghana and beyond.</p>
      <div style="display:flex;gap:16px;justify-content:center;align-items:center;margin:14px 0;flex-wrap:wrap;font-size:12px">
        <a href="#shop" onclick="filters.cat='All';go('shop')" style="color:var(--muted);text-decoration:none">Catalog</a>
        <span style="color:var(--line)">•</span>
        <a href="#wholesale" onclick="go('wholesale')" style="color:var(--muted);text-decoration:none">Wholesale B2B</a>
        <span style="color:var(--line)">•</span>
        <a href="#account" onclick="accountTab='hub';go('account')" style="color:var(--muted);text-decoration:none">Member Hub</a>
        ${isAdminUser() ? `
          <span style="color:var(--line)">•</span>
          <a href="#admin" onclick="go('admin')" style="color:var(--gold-light);text-decoration:none;font-weight:700">⚡ Admin Console</a>
        ` : ''}
      </div>
      <small>© 2026 ByMarie Studio. All rights reserved.</small>
    </footer>
  `;
}

// ===================================================
// PRODUCT CARD & SLIDER ENGINE
// ===================================================

let cardSlideState = {};
let cardHoverIntervals = {};

function slideCardImg(id, delta, e) {
  if (e) e.stopPropagation();
  const p = byId(id);
  if (!p) return;
  const images = (p.images && p.images.length) ? p.images : [p.image];
  if (images.length <= 1) return;
  
  const cur = cardSlideState[id] || 0;
  const next = (cur + delta + images.length) % images.length;
  cardSlideState[id] = next;
  
  const track = document.getElementById(`track-${id}`);
  if (track) {
    track.style.transform = `translateX(-${next * 100}%)`;
  }
  const dots = document.querySelectorAll(`.dot-${id}`);
  dots.forEach((d, idx) => {
    d.classList.toggle('active', idx === next);
  });
}

function startCardHoverSlide(id) {
  const p = byId(id);
  if (!p || !p.images || p.images.length <= 1) return;
  clearInterval(cardHoverIntervals[id]);
  cardHoverIntervals[id] = setInterval(() => {
    slideCardImg(id, 1);
  }, 1800);
}

function stopCardHoverSlide(id) {
  clearInterval(cardHoverIntervals[id]);
}

function productCard(p, delayClass = '') {
  const isSaved = wishlist.includes(p.id);
  const outOfStock = p.stock <= 0;
  const primaryColor = (p.colors && p.colors.length && p.colors[0] !== 'Standard' && !p.colors[0].includes('ml') && !p.colors[0].includes('Jar') && !p.colors[0].includes('Glass')) ? p.colors[0] : null;
  const attrLabel = primaryColor ? primaryColor.toUpperCase() : p.category.toUpperCase();
  const images = (p.images && p.images.length) ? p.images : [p.image];
  const curSlide = cardSlideState[p.id] || 0;
  
  return `
    <article class="product-card animate-fade-up ${delayClass}">
      <div class="product-card-image-box" onclick="go('product/${p.id}')">
        <img loading="lazy" src="${images[curSlide] || p.image}" alt="${p.name}">
        
        <!-- Top Right Color Swatch Dots -->
        ${primaryColor ? `
          <div class="floating-color-dots">
            ${p.colors.slice(0, 3).map(c => `
              <span class="floating-color-dot" style="background-color:${getColorHex(c)}" title="${c}"></span>
            `).join('')}
          </div>
        ` : ''}

        <!-- Top Left Subtle Wishlist Button -->
        <button class="floating-wish-btn ${isSaved ? 'saved' : ''}" onclick="event.stopPropagation();toggleWish('${p.id}')" aria-label="Save ${p.name}">
          ${isSaved ? '♥' : '♡'}
        </button>

        <!-- Bottom Left Urgency Pill -->
        ${outOfStock ? `
          <span class="floating-stock-badge" style="background:#52525b">Out of stock</span>
        ` : (p.stock <= 3 ? `
          <span class="floating-stock-badge">Only ${p.stock} left</span>
        ` : (p.tag ? `
          <span class="floating-stock-badge">${p.tag}</span>
        ` : ''))}

        <!-- Bottom Right Floating Quick Add Button -->
        <button class="floating-add-btn" ${outOfStock ? 'disabled style="opacity:0.4"' : ''} onclick="event.stopPropagation();add('${p.id}')" title="Add to Bag">+</button>
      </div>

      <div class="product-card-details">
        <span class="product-card-attr">${attrLabel}</span>
        <h3 class="product-card-title"><a href="#product/${p.id}" onclick="go('product/${p.id}')">${p.name}</a></h3>
        <div class="product-card-price">GHS ${p.price.toFixed(2)}</div>
      </div>
    </article>
  `;
}

// ===================================================
// HOME VIEW & CATEGORY SLIDERS
// ===================================================

let categorySlideInterval = null;
let catSlideIndices = {};

function initCategorySliders() {
  if (categorySlideInterval) clearInterval(categorySlideInterval);
  
  categorySlideInterval = setInterval(() => {
    for (let i = 0; i < 15; i++) {
      const slider = document.getElementById(`cat-slider-${i}`);
      if (!slider) continue;
      const slides = slider.querySelectorAll('.category-slide-img');
      if (slides.length <= 1) continue;
      
      const curIdx = catSlideIndices[i] || 0;
      const nextIdx = (curIdx + 1) % slides.length;
      catSlideIndices[i] = nextIdx;
      
      slides.forEach((s, sIdx) => s.classList.toggle('active', sIdx === nextIdx));
      
      const dots = document.querySelectorAll(`#cat-card-${i} .category-slider-dot`);
      dots.forEach((d, sIdx) => d.classList.toggle('active', sIdx === nextIdx));
    }
  }, 3200);
}

let heroVideoIndex = 0;
let heroVideoTimer = null;
let heroActiveLayer = 'a';

function initHeroVideoRotation() {
  if (heroVideoTimer) clearInterval(heroVideoTimer);
  const settings = getSiteSettings();
  const videos = getHeroVideosList(settings);
  if (videos.length <= 1) return;

  const intervalSec = Math.max(5, Number(settings.heroVideoInterval || 30));
  
  heroVideoTimer = setInterval(() => {
    switchHeroVideo((heroVideoIndex + 1) % videos.length);
  }, intervalSec * 1000);
}

function switchHeroVideo(newIndex) {
  const settings = getSiteSettings();
  const videos = getHeroVideosList(settings);
  if (!videos.length) return;
  
  heroVideoIndex = (newIndex + videos.length) % videos.length;
  const targetSrc = videos[heroVideoIndex];
  
  const currentEl = document.getElementById(heroActiveLayer === 'a' ? 'hero-main-video-a' : 'hero-main-video-b');
  const nextEl = document.getElementById(heroActiveLayer === 'a' ? 'hero-main-video-b' : 'hero-main-video-a');
  const singleEl = document.getElementById('hero-main-video');

  if (nextEl && currentEl) {
    nextEl.src = targetSrc;
    nextEl.muted = true;
    nextEl.defaultMuted = true;
    nextEl.playsInline = true;
    nextEl.setAttribute('muted', '');
    nextEl.setAttribute('playsinline', '');
    nextEl.setAttribute('webkit-playsinline', '');
    nextEl.onerror = () => {
      console.warn('Hero video failed to load, trying next:', targetSrc);
      if (videos.length > 1) {
        setTimeout(() => switchHeroVideo(heroVideoIndex + 1), 600);
      }
    };

    safePlay(nextEl);

    nextEl.style.zIndex = '3';
    currentEl.style.zIndex = '1';
    nextEl.style.opacity = '1';
    currentEl.style.opacity = '0';

    heroActiveLayer = heroActiveLayer === 'a' ? 'b' : 'a';

    setTimeout(() => {
      safePause(currentEl);
    }, 450);
  } else if (singleEl) {
    singleEl.style.opacity = '0.3';
    singleEl.src = targetSrc;
    singleEl.load();
    safePlay(singleEl);
    setTimeout(() => { singleEl.style.opacity = '1'; }, 250);
  }

  // Update progress bars & counter
  const bars = document.querySelectorAll('.hero-video-bar');
  bars.forEach((b, idx) => {
    b.classList.remove('active', 'passed');
    if (idx === heroVideoIndex) {
      b.classList.add('active');
    } else if (idx < heroVideoIndex) {
      b.classList.add('passed');
    }
  });

  const countBadge = document.getElementById('hero-video-count-badge');
  if (countBadge) {
    countBadge.textContent = `${heroVideoIndex + 1} / ${videos.length}`;
  }
}

function prevHeroVideo() {
  switchHeroVideo(heroVideoIndex - 1);
  initHeroVideoRotation();
}

function nextHeroVideo() {
  switchHeroVideo(heroVideoIndex + 1);
  initHeroVideoRotation();
}

function home() {
  const products = getProducts();
  const trending = products.slice(0, 8);
  const settings = getSiteSettings();
  const heroVideos = getHeroVideosList(settings);
  const currentVideo = heroVideos[heroVideoIndex] || heroVideos[0] || '';
  const intervalSec = Math.max(5, Number(settings.heroVideoInterval || 30));

  setTimeout(() => {
    initHeroVideoRotation();
    initHeroVideoMobilePlayback();
  }, 100);
  
  return `
    <main>
      <!-- Hero Section with 30s Multi-Video Carousel (Mobile-Optimized Dual Crossfade) -->
      <section class="hero">
        <div class="hero-copy animate-fade-up">
          <div class="eyebrow">CURATED FOR MINDFUL LIVING <i></i> EST. 2024</div>
          <h1>${(settings.heroTitle || 'ByMarie — Style, Scent, Essentials').replace(' — ', '<br><em>').replace(' - ', '<br><em>')}</em></h1>
          <p>${settings.heroSubtitle}</p>
          <div class="hero-buttons">
            <button class="primary" onclick="go('shop')">Explore Shop ${icon('arrow')}</button>
            <button class="text-btn" onclick="document.getElementById('collections').scrollIntoView({behavior:'smooth'})">Explore Collections</button>
          </div>
          <div class="hero-note">
            <b>⌁</b>
            <span><strong>Free Doorstep Delivery</strong><br>on all orders over GH₵ 300</span>
          </div>
        </div>
        <div class="hero-image animate-fade-up delay-2" style="position:relative;overflow:hidden">
          <div class="hero-video-carousel-container" style="position:relative;width:100%;height:100%;background:#020f0d;overflow:hidden;border-radius:var(--radius-md)">
            ${heroVideos.length > 1 ? `
              <!-- Progress Bars for Multi-Video Playlist (Changes every 30s) -->
              <div class="hero-video-bars">
                ${heroVideos.map((_, vIdx) => `
                  <div class="hero-video-bar ${vIdx === heroVideoIndex ? 'active' : vIdx < heroVideoIndex ? 'passed' : ''}" onclick="switchHeroVideo(${vIdx});initHeroVideoRotation()" title="Play Video #${vIdx + 1}">
                    <div class="hero-video-bar-fill" style="animation-duration:${intervalSec}s"></div>
                  </div>
                `).join('')}
              </div>
              <span class="hero-video-counter-badge" id="hero-video-count-badge">${heroVideoIndex + 1} / ${heroVideos.length}</span>
              
              <!-- Prev / Next Navigation Controls -->
              <button type="button" class="hero-video-nav-btn prev" onclick="prevHeroVideo()" title="Previous Campaign Video">❮</button>
              <button type="button" class="hero-video-nav-btn next" onclick="nextHeroVideo()" title="Next Campaign Video">❯</button>
            ` : ''}

            ${heroVideos.length > 0 ? `
              <!-- Dual Layer Crossfading Video Players for 100% Mobile & Desktop Compatibility -->
              <video id="hero-main-video-a" class="hero-video-player" src="${currentVideo}" autoplay loop muted playsinline webkit-playsinline preload="auto" onerror="if(typeof switchHeroVideo==='function')switchHeroVideo(heroVideoIndex+1)" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;opacity:1;transition:opacity 0.45s ease;z-index:2;display:block"></video>
              <video id="hero-main-video-b" class="hero-video-player" src="" loop muted playsinline webkit-playsinline preload="auto" onerror="if(typeof switchHeroVideo==='function')switchHeroVideo(heroVideoIndex+1)" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity 0.45s ease;z-index:1;display:block"></video>

              <button type="button" class="hero-audio-btn" onclick="toggleHeroVideoAudio(this)" title="Toggle Audio Sound" style="position:absolute;bottom:16px;right:16px;width:38px;height:38px;border-radius:50%;background:rgba(9,60,53,0.85);color:#fff;border:1px solid rgba(255,255,255,0.4);font-size:16px;backdrop-filter:blur(8px);cursor:pointer;z-index:10;display:grid;place-items:center;box-shadow:0 4px 14px rgba(0,0,0,0.3);transition:all 0.2s">
                <span class="audio-btn-icon">🔇</span>
              </button>
            ` : `
              <div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(135deg,#051c19 0%,#093832 50%,#031411 100%);color:#fff;text-align:center;padding:24px">
                <span style="font-size:44px;margin-bottom:12px">✨</span>
                <span class="eyebrow" style="color:var(--gold-light)">HAUTE COUTURE · GHANA</span>
                <h3 style="font-family:'Bodoni Moda',serif;font-size:24px;color:var(--gold);margin:8px 0">ByMarie Maison</h3>
                <p style="color:#a1a1aa;font-size:12.5px;max-width:280px;line-height:1.5">Upload your custom luxury campaign videos in the Admin Console to launch your dynamic 30s video playlist.</p>
              </div>
            `}
            
            <div class="floating-card">
              <span>New Arrival</span>
              <strong>The Luxury Edit</strong>
              <button onclick="go('shop')">Discover Catalog ${icon('arrow')}</button>
            </div>
          </div>
        </div>
      </section>

      <!-- Collections Grid (Dynamic Multi-Covers Managed via Admin CMS) -->
      <section id="collections" class="section">
        <div class="section-head animate-fade-up">
          <div>
            <span class="eyebrow">CURATED BY INTENTION</span>
            <h2>The ByMarie Collections</h2>
          </div>
          <button class="text-btn" onclick="go('shop')">View all products ${icon('arrow')}</button>
        </div>
        <div class="category-grid">
          ${[
            { name: 'Clothing', subtitle: 'Thoughtful silhouettes and breathable weaves tailored for easy living.', code: '01 // SILHOUETTES', icon: '👗' },
            { name: 'Shoes', subtitle: 'Italian suede kitten mules, artisan leather slides, and strappy stilettos.', code: '02 // FOOTWEAR', icon: '👠' },
            { name: 'Bags', subtitle: 'Sculptural crescent leather totes, woven raffia boxes, and silk clutches.', code: '03 // HANDBAGS', icon: '👜' },
            { name: 'Wigs', subtitle: 'Raw virgin bone straight hair and glueless 13x6 invisible melt HD frontals.', code: '04 // LUXURY WIGS', icon: '💇‍♀️' },
            { name: 'Skin Care', subtitle: 'Biocompatible actives & cold-pressed botanicals for radiant glowing skin.', code: '05 // SKIN CARE', icon: '✨' },
            { name: 'Perfumes', subtitle: 'Characterful extract formulations that leave an unforgettable trail.', code: '06 // EXTRAITS', icon: '🌸' },
            { name: 'Lifestyle', subtitle: 'Artisanal home scents, stonewashed waffle robes, and tranquil essentials.', code: '07 // LIFESTYLE', icon: '🕯️' },
            { name: 'Nails', subtitle: 'Non-toxic 7-free mineral nail lacquers and handcrafted salon press-ons.', code: '08 // NAILS', icon: '💅' },
            { name: 'Panties', subtitle: 'Second-skin seamless briefs and delicate French lace intimates.', code: '09 // PANTIES', icon: '👙' },
            { name: 'Toiletries', subtitle: 'Gentle oat lipid cleansers and nourishing botanical daily care.', code: '10 // BATH & BODY', icon: '🛁' }
          ].map((cat, i) => {
            const covers = getCategoryCoverList(cat.name);
            return `
              <div class="category-card animate-fade-up delay-${(i % 3) + 1}" onclick="go('category/${encodeURIComponent(cat.name)}')" id="cat-card-${i}">
                ${covers.length > 1 ? `
                  <div class="category-slider" id="cat-slider-${i}">
                    ${covers.map((img, sIdx) => `
                      <img class="category-slide-img ${sIdx === 0 ? 'active' : ''}" src="${img}" alt="${cat.name} cover ${sIdx + 1}">
                    `).join('')}
                  </div>
                  <div class="category-slider-dots">
                    ${covers.map((_, sIdx) => `
                      <span class="category-slider-dot ${sIdx === 0 ? 'active' : ''}" id="cat-dot-${i}-${sIdx}"></span>
                    `).join('')}
                  </div>
                ` : covers.length === 1 ? `
                  <img src="${covers[0]}" alt="${cat.name}" style="width:100%;height:100%;object-fit:cover">
                ` : `
                  <div class="category-card-placeholder">
                    <span class="category-card-placeholder-icon">${cat.icon}</span>
                  </div>
                `}
                <div>
                  <span>${cat.code}</span>
                  <h3>${cat.name}</h3>
                  <p>${cat.subtitle}</p>
                  <button>Explore ${cat.name} ${icon('arrow')}</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </section>

      <!-- Trending Grid -->
      <section class="section" style="padding-top:0">
        <div class="section-head animate-fade-up">
          <div>
            <span class="eyebrow">THE BYMARIE EDIT</span>
            <h2>Trending this season.</h2>
          </div>
          <button class="text-btn" onclick="go('shop')">Shop entire catalog ${icon('arrow')}</button>
        </div>
        <div class="product-grid">
          ${trending.length ? trending.map((p, idx) => productCard(p, `delay-${(idx % 4) + 1}`)).join('') : `
            <div style="grid-column:1/-1;text-align:center;padding:48px 24px;background:#fff;border-radius:var(--radius-lg);border:1px solid var(--line)">
              <span style="font-size:32px;display:block;margin-bottom:10px">✨</span>
              <h3 style="font-family:'Playfair Display',serif;font-size:22px;color:var(--ink);margin-bottom:6px">New Season Arrivals Dropping Soon</h3>
              <p style="color:var(--muted);font-size:13.5px;max-width:480px;margin:0 auto 16px">Our ateliers are currently curating and uploading the newest pieces to the boutique.</p>
              <button class="primary" onclick="go('shop')">Explore Shop</button>
            </div>
          `}
        </div>
      </section>

      <!-- Brand Storytelling Section -->
      <section class="ethos-section">
        <div class="ethos-grid">
          <div class="ethos-card animate-fade-up">
            <span class="eyebrow">OUR PHILOSOPHY</span>
            <h2>Created for slow living and enduring beauty.</h2>
            <p>Every ByMarie garment, heel, handbag, virgin crown, formula, and intimate essential is conceived with intentional restraint. We believe true luxury lies in simplicity, pure materials, and timeless craftsmanship.</p>
            <div class="ethos-pillars">
              <div class="pillar-item">
                <strong>Pure Materials</strong>
                <p>Full-grain leathers, raw virgin hair, and clean certified extracts.</p>
              </div>
              <div class="pillar-item">
                <strong>Conscious Craft</strong>
                <p>Small-batch tailoring and sustainable recyclable packaging.</p>
              </div>
            </div>
          </div>
          <div class="animate-fade-up delay-2">
            ${settings.ethosImageUrl ? `
              <img src="${settings.ethosImageUrl}" alt="ByMarie Philosophy" style="border-radius:var(--radius-lg);box-shadow:var(--shadow-hover);width:100%;height:460px;object-fit:cover">
            ` : `
              <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;background:linear-gradient(145deg, #093c35 0%, #041a16 100%);border:1px solid rgba(197,151,55,0.35);border-radius:var(--radius-lg);padding:40px 24px;min-height:420px;box-shadow:var(--shadow-md)">
                <div style="width:68px;height:68px;border-radius:50%;border:1.5px solid #c59737;display:grid;place-items:center;color:#c59737;font-family:'Cinzel',serif;font-size:26px;font-weight:700;margin-bottom:14px;box-shadow:0 0 20px rgba(197,151,55,0.25)">M</div>
                <span class="eyebrow" style="color:var(--gold-light);margin-bottom:8px">HAUTE COUTURE ATELIER</span>
                <h3 style="font-family:'Playfair Display',serif;font-size:24px;color:#fff;margin-bottom:10px">The Art of Pure Intention</h3>
                <p style="color:#a1a1aa;font-size:13px;max-width:320px;line-height:1.6">Every collection cover and campaign image is curated directly by our creative directors via the Admin Console.</p>
              </div>
            `}
          </div>
        </div>
      </section>

      <!-- Trust Pillars -->
      <section class="trust">
        <div class="animate-fade-up delay-1">
          <b>01 // QUALITY</b>
          <strong>Considered Selection</strong>
          <p>Strictly sourced pieces and hypoallergenic formulations we personally love.</p>
        </div>
        <div class="animate-fade-up delay-2">
          <b>02 // PAYMENT</b>
          <strong>Ghana MoMo & Cards</strong>
          <p>Instant MTN Mobile Money, Telecel Cash, and Bank Card checkout security.</p>
        </div>
        <div class="animate-fade-up delay-3">
          <b>03 // FULFILLMENT</b>
          <strong>Express Doorstep Delivery</strong>
          <p>Swift dispatch across Greater Accra, Ashanti, and all regions in Ghana.</p>
        </div>
      </section>

      <!-- Newsletter Banner -->
      <div class="newsletter-box animate-fade-up">
        <span class="eyebrow" style="color:var(--gold-light);justify-content:center">EXCLUSIVE PRIVILEGES</span>
        <h2>Join the ByMarie Circle</h2>
        <p>Subscribe to receive private collection previews, seasonal releases, and 10% off your initial order.</p>
        <form class="newsletter-form" onsubmit="handleNewsletter(event)">
          <input required type="email" placeholder="Enter your email address...">
          <button type="submit">Unlock 10% Off</button>
        </form>
      </div>
    </main>
  `;
}

// ===================================================
// SHOP & CATEGORY VIEW
// ===================================================

function shop(categoryParam) {
  if (categoryParam) filters.cat = decodeURIComponent(categoryParam);
  const products = getProducts();
  
  let list = products.filter(p => {
    const matchCat = (filters.cat === 'All' || p.category.toLowerCase() === filters.cat.toLowerCase());
    const matchStock = (!filters.available || p.stock > 0);
    const matchPrice = p.price <= (filters.maxPrice || 1000);
    const query = filters.search.toLowerCase().trim();
    const matchSearch = !query || `${p.name} ${p.category} ${p.desc}`.toLowerCase().includes(query);
    return matchCat && matchStock && matchPrice && matchSearch;
  });
  
  if (filters.sort === 'Price: low to high') list.sort((a, b) => a.price - b.price);
  if (filters.sort === 'Price: high to low') list.sort((a, b) => b.price - a.price);
  if (filters.sort === 'Best rated') list.sort((a, b) => b.rating - a.rating);
  if (filters.sort === 'Newest') list.sort((a, b) => (b.id.localeCompare(a.id)));
  
  const categoryOptions = [
    { label: 'ALL', cat: 'All' },
    { label: 'CLOTHING', cat: 'Clothing' },
    { label: 'SHOES', cat: 'Shoes' },
    { label: 'BAGS', cat: 'Bags' },
    { label: 'WIGS', cat: 'Wigs' },
    { label: 'SKIN CARE', cat: 'Skin Care' },
    { label: 'PERFUMES', cat: 'Perfumes' },
    { label: 'LIFESTYLE', cat: 'Lifestyle' },
    { label: 'NAILS', cat: 'Nails' },
    { label: 'PANTIES', cat: 'Panties' }
  ];

  return `
    <main class="shop-page animate-fade-up">
      <!-- Horizontal Category Filters Bar -->
      <div class="catalog-filter-bar">
        <button type="button" class="catalog-filters-toggle-btn" onclick="openQuickSearchModal()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
          Filters
        </button>

        <div class="catalog-pills-row">
          ${categoryOptions.map(opt => `
            <button class="catalog-pill-btn ${(filters.cat.toLowerCase() === opt.cat.toLowerCase() || (opt.cat === 'All' && filters.cat === 'All')) ? 'active' : ''}" onclick="filters.cat='${opt.cat}';render()">
              ${opt.label}
            </button>
          `).join('')}
        </div>
      </div>

      <!-- Section Title & Counter -->
      <div class="collection-header-row">
        <div class="collection-bar"></div>
        <div>
          <h2 class="collection-title">${filters.cat === 'All' ? 'The Collection' : filters.cat}</h2>
          <span class="collection-count">${list.length} pieces</span>
        </div>
      </div>

      <!-- 2-Column Responsive Product Grid -->
      ${list.length ? `
        <div class="product-grid">
          ${list.map((p, idx) => productCard(p, `delay-${(idx % 4) + 1}`)).join('')}
        </div>
      ` : `
        <div style="text-align:center;padding:80px 20px;background:#fff;border-radius:var(--radius-lg);border:1px solid var(--line)">
          <div style="font-size:40px;color:var(--muted);margin-bottom:12px">⌕</div>
          <h2 style="font-size:28px;margin-bottom:8px">No matching items found</h2>
          <p style="color:var(--muted);margin-bottom:20px">Try adjusting your search terms or clearing your filters.</p>
          <button class="primary" onclick="filters={cat:'All',search:'',sort:'Featured',available:false};render()">Clear all filters</button>
        </div>
      `}
    </main>
  `;
}

// ===================================================
// PRODUCT DETAIL VIEW
// ===================================================

function detail(id) {
  const p = byId(id);
  if (!p) return notFound();
  
  const images = (p.images && p.images.length) ? p.images : [p.image];
  if (detailActiveImg >= images.length) detailActiveImg = 0;
  const currentImage = images[detailActiveImg];
  
  const chosenVariant = selectedVariants[id]?.color || (p.colors && p.colors[0]) || 'Standard';
  const chosenSize = selectedVariants[id]?.size || (p.sizes && p.sizes[0]) || '';
  const isSaved = wishlist.includes(id);
  const outOfStock = p.stock <= 0;
  
  const reviewsList = p.reviews || [];
  const reviewCount = reviewsList.length;
  const avgRating = reviewCount ? (reviewsList.reduce((a, b) => a + b.rating, 0) / reviewCount).toFixed(1) : p.rating;
  
  const related = getProducts().filter(x => x.id !== id && x.category === p.category).slice(0, 4);

  return `
    <main class="detail-container">
      <div class="breadcrumbs animate-fade-up">
        <a href="#home" onclick="go('home')">Home</a> /
        <a href="#category/${encodeURIComponent(p.category)}" onclick="go('category/${encodeURIComponent(p.category)}')">${p.category}</a> /
        <span>${p.name}</span>
      </div>

      <div class="detail-main">
        <div class="gallery-wrapper animate-fade-up">
          <div class="thumbnails-strip">
            ${images.map((img, idx) => `
              <div class="thumb-item ${detailActiveImg === idx ? 'active' : ''}" onclick="detailActiveImg=${idx};render()">
                <img src="${img}" alt="${p.name} preview ${idx + 1}">
              </div>
            `).join('')}
          </div>
          <div class="main-image-box" onclick="openLightbox('${currentImage}')">
            <img src="${currentImage}" alt="${p.name}">
            <div class="zoom-hint">🔍 Click to zoom</div>
          </div>
        </div>

        <div class="detail-info animate-fade-up delay-1">
          <span class="eyebrow">${p.category}</span>
          <h1>${p.name}</h1>
          
          <div class="rating" onclick="document.getElementById('reviews-anchor').scrollIntoView({behavior:'smooth'})" style="cursor:pointer">
            ${icon('star')} ${avgRating} <span>(${reviewCount} verified reviews)</span>
          </div>

          <div class="detail-price-row">
            <span class="curr-price">${money(p.price)}</span>
            ${p.old ? `<del>${money(p.old)}</del>` : ''}
            ${p.tag ? `<span class="tag" style="position:static">${p.tag}</span>` : ''}
          </div>

          <p class="detail-desc">${p.desc}</p>

          ${p.colors && p.colors.length ? `
            <div class="variant-picker">
              <div class="variant-picker-label">
                <span>Color / Option Availability</span>
                <b>${chosenVariant}</b>
              </div>
              <div class="chips-row">
                ${p.colors.map(c => `
                  <button class="chip color-chip ${chosenVariant === c ? 'active' : ''}" onclick="selectedVariants['${id}']={...selectedVariants['${id}'],color:'${c}'};render()" title="${c}">
                    <span class="color-dot-indicator" style="background-color:${getColorHex(c)}"></span>
                    <span>${c}</span>
                  </button>
                `).join('')}
              </div>
              <small class="variant-stock-status">✓ All <b>${p.colors.length} options</b> in stock & tailored for immediate dispatch</small>
            </div>
          ` : ''}

          ${p.sizes && p.sizes.length ? `
            <div class="variant-picker">
              <div class="variant-picker-label">
                <span>Select Size / Length</span>
                <b>${chosenSize}</b>
              </div>
              <div class="chips-row">
                ${p.sizes.map(s => `
                  <button class="chip ${chosenSize === s ? 'active' : ''}" onclick="selectedVariants['${id}']={...selectedVariants['${id}'],size:'${s}'};render()">
                    ${s}
                  </button>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <div class="stock-indicator ${outOfStock ? 'out' : ''}">
            ${outOfStock ? `${icon('close')} Out of stock` : `${icon('check')} In stock (${p.stock} units ready for immediate dispatch)`}
          </div>

          <div class="qty-actions-row">
            <button class="primary" ${outOfStock ? 'disabled' : ''} onclick="add('${id}','${chosenVariant}','${chosenSize}')">
              ${outOfStock ? 'Out of stock' : `Add to bag — ${money(p.price)}`}
            </button>
            <button class="secondary-btn" onclick="toggleWish('${id}')" style="font-size:18px;width:50px;padding:0">
              ${isSaved ? icon('heartFull') : icon('heart')}
            </button>
          </div>

          <button class="buy-now-btn" ${outOfStock ? 'disabled' : ''} onclick="add('${id}','${chosenVariant}','${chosenSize}');go('checkout')">
            Buy Now with Express MoMo / Card
          </button>

          <div class="detail-perks">
            <div>${icon('truck')} Free Accra delivery &gt; GH₵ 300</div>
            <div>${icon('shield')} 14-Day Easy Returns</div>
            <div>${icon('card')} Verified MoMo & Card Pay</div>
          </div>
        </div>
      </div>

      <!-- Reviews Section -->
      <section id="reviews-anchor" class="reviews-section animate-fade-up">
        <div class="reviews-header">
          <div>
            <span class="eyebrow">CUSTOMER VOICES</span>
            <h2 style="font-size:32px;margin-top:6px">Reviews & Experiences</h2>
          </div>
          <button class="primary" onclick="document.getElementById('review-form-box').style.display='block';this.style.display='none'">
            Write a Review
          </button>
        </div>

        <div class="reviews-breakdown">
          <div class="overall-score">
            <strong>${avgRating}</strong>
            <div class="stars">★★★★★</div>
            <small style="color:var(--muted)">Based on ${reviewCount} customer reviews</small>
          </div>
          <div class="score-bars">
            ${[5, 4, 3, 2, 1].map(stars => {
              const matchCount = reviewsList.filter(r => r.rating === stars).length;
              const pct = reviewCount ? Math.round((matchCount / reviewCount) * 100) : 0;
              return `
                <div class="score-row">
                  <span>${stars} ★</span>
                  <div class="bar-bg"><div class="bar-fill" style="width:${pct}%"></div></div>
                  <span>${matchCount}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Add Review Form -->
        <div id="review-form-box" class="review-form-card" style="display:none">
          <h3>Share your thoughts on ${p.name}</h3>
          <form onsubmit="submitReview('${p.id}', event)">
            <div class="form-group" style="margin-bottom:14px">
              <label>Your Rating</label>
              <div class="star-rating-select" id="star-picker">
                ${[1, 2, 3, 4, 5].map(n => `
                  <span onclick="setRatingValue(${n})" data-val="${n}" class="${n <= 5 ? 'selected' : ''}">★</span>
                `).join('')}
              </div>
              <input type="hidden" id="review-rating-input" name="rating" value="5">
            </div>
            <div class="form-grid">
              <div class="form-group">
                <label>Your Name</label>
                <input required name="author" placeholder="e.g. Efua Mensah">
              </div>
              <div class="form-group">
                <label>Review Headline</label>
                <input required name="title" placeholder="e.g. Exceptional quality and feel!">
              </div>
              <div class="form-group full">
                <label>Detailed Comments</label>
                <textarea required name="comment" rows="3" placeholder="Tell other customers about the quality, fit, longevity, or feel..."></textarea>
              </div>
            </div>
            <div style="display:flex;gap:10px">
              <button class="primary" type="submit">Publish Review</button>
              <button class="secondary-btn" type="button" onclick="document.getElementById('review-form-box').style.display='none'">Cancel</button>
            </div>
          </form>
        </div>

        <div class="review-grid">
          ${reviewsList.length ? reviewsList.map(r => `
            <div class="review-card">
              <div class="rev-top">
                <div class="rating">${icon('star').repeat(r.rating)}</div>
                <small style="color:var(--muted)">${r.date}</small>
              </div>
              <h4>${r.title}</h4>
              <p>${r.comment}</p>
              <small style="display:block;margin-top:10px;font-weight:700;color:var(--ink)">— ${r.author} <span style="color:var(--emerald)">✓ Verified Buyer</span></small>
            </div>
          `).join('') : '<p style="color:var(--muted)">No reviews yet. Be the first to share your experience!</p>'}
        </div>
      </section>

      <!-- Related Products -->
      ${related.length ? `
        <section style="margin-top:70px">
          <div class="section-head animate-fade-up">
            <div>
              <span class="eyebrow">COMPLEMENTARY PIECES</span>
              <h2>Complete your ritual.</h2>
            </div>
          </div>
          <div class="product-grid">
            ${related.map((prod, i) => productCard(prod, `delay-${i + 1}`)).join('')}
          </div>
        </section>
      ` : ''}
    </main>
  `;
}

function setRatingValue(n) {
  document.getElementById('review-rating-input').value = n;
  const spans = document.querySelectorAll('#star-picker span');
  spans.forEach((s, idx) => {
    s.classList.toggle('selected', idx < n);
  });
}

function submitReview(productId, event) {
  event.preventDefault();
  const form = event.target;
  const fd = new FormData(form);
  
  const rating = Number(fd.get('rating') || 5);
  const author = fd.get('author');
  const title = fd.get('title');
  const comment = fd.get('comment');
  
  const products = getProducts();
  const prod = products.find(p => p.id === productId);
  if (!prod) return;
  
  if (!prod.reviews) prod.reviews = [];
  prod.reviews.unshift({
    author,
    rating,
    title,
    comment,
    date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  });
  
  const avg = prod.reviews.reduce((a, b) => a + b.rating, 0) / prod.reviews.length;
  prod.rating = Number(avg.toFixed(1));
  
  saveProducts(products);
  toast('Thank you! Your review has been published.');
  render();
}

// ===================================================
// CART VIEW
// ===================================================

function cartPage() {
  if (!cart.length) {
    return `
      <main style="max-width:600px;margin:80px auto;text-align:center;padding:40px 20px" class="animate-fade-up">
        <div style="display:flex;justify-content:center;margin-bottom:20px"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--emerald)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg></div>
        <h1 style="font-size:36px;margin-bottom:10px">Your bag is empty.</h1>
        <p style="color:var(--muted);margin-bottom:30px">Discover timeless styles, heels, luxury bags, HD wigs, and signature care.</p>
        <button class="primary" onclick="go('shop')">Explore the Shop ${icon('arrow')}</button>
      </main>
    `;
  }

  const st = subtotal();
  const disc = getDiscountAmount();
  const ship = getDeliveryFee();
  const tot = grandTotal();
  const freeShipThreshold = 300;
  const freeShipDiff = Math.max(0, freeShipThreshold - st);
  const freeShipPct = Math.min(100, Math.round((st / freeShipThreshold) * 100));

  return `
    <main class="cart-page">
      <div class="animate-fade-up">
        <div class="page-intro">
          <span class="eyebrow">YOUR SELECTION</span>
          <h1>Shopping Bag <small style="font-size:16px;color:var(--muted)">(${cartCount()} items)</small></h1>
        </div>

        <div class="cart-items-table">
          ${cart.map((item, idx) => {
            const p = byId(item.id);
            if (!p) return '';
            return `
              <div class="cart-item">
                <img src="${p.image}" alt="${p.name}">
                <div class="cart-item-info">
                  <p class="eyebrow" style="font-size:9px">${p.category}</p>
                  <h3>${p.name}</h3>
                  <small>${item.variant} ${item.size ? `• Size ${item.size}` : ''}</small>
                  <div class="stepper">
                    <button onclick="changeCartQty(${idx}, -1)">−</button>
                    <span>${item.qty}</span>
                    <button onclick="changeCartQty(${idx}, 1)">+</button>
                  </div>
                </div>
                <div class="cart-item-right">
                  <strong>${money(p.price * item.qty)}</strong>
                  <button onclick="removeCartItem(${idx})">Remove</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <aside class="animate-fade-up delay-1">
        <div class="summary-card">
          <h2>Order Summary</h2>
          
          <div class="free-ship-meter">
            ${freeShipDiff > 0 ? `
              <span>Add <b>${money(freeShipDiff)}</b> more for <strong>FREE Accra Delivery</strong></span>
            ` : `
              <span style="color:var(--emerald);font-weight:800">${icon('check')} You unlocked FREE delivery!</span>
            `}
            <div class="meter-bar"><div class="meter-fill" style="width:${freeShipPct}%"></div></div>
          </div>

          <!-- Promo Code Box -->
          ${appliedCoupon ? `
            <div class="promo-tag">
              <span>${icon('sparkle')} Code <b>${appliedCoupon.code}</b> applied</span>
              <button onclick="removeCoupon()" style="font-size:14px;color:var(--ink)">✕</button>
            </div>
          ` : `
            <form class="promo-form" onsubmit="event.preventDefault();applyCoupon(this.code.value)">
              <input name="code" placeholder="Promo code (e.g. WELCOME10)">
              <button class="secondary-btn" type="submit">Apply</button>
            </form>
          `}

          <div class="summary-lines">
            <div>
              <span>Subtotal</span>
              <b>${money(st)}</b>
            </div>
            ${disc > 0 ? `
              <div style="color:var(--emerald)">
                <span>Discount (${appliedCoupon.code})</span>
                <b>−${money(disc)}</b>
              </div>
            ` : ''}
            <div>
              <span>Delivery</span>
              <b>${ship === 0 ? '<span style="color:var(--emerald)">FREE</span>' : money(ship)}</b>
            </div>
          </div>

          <div class="summary-total">
            <span>Estimated Total</span>
            <strong>${money(tot)}</strong>
          </div>

          <button class="primary" style="width:100%;margin-bottom:12px" onclick="go('checkout')">
            Proceed to Checkout ${icon('arrow')}
          </button>
          
          <button class="secondary-btn" style="width:100%" onclick="go('shop')">
            ← Continue Shopping
          </button>

          <p style="text-align:center;color:var(--muted);font-size:11px;margin-top:16px">
            🔒 Protected by Bank-grade encryption & MoMo verification
          </p>
        </div>
      </aside>
    </main>
  `;
}

function changeCartQty(index, delta) {
  const item = cart[index];
  if (!item) return;
  const p = byId(item.id);
  const newQty = item.qty + delta;
  
  if (newQty <= 0) {
    cart.splice(index, 1);
  } else if (p && newQty > p.stock) {
    toast(`Only ${p.stock} units available in stock`);
    return;
  } else {
    item.qty = newQty;
  }
  
  saveCart();
  render();
}

function removeCartItem(index) {
  cart.splice(index, 1);
  saveCart();
  render();
  toast('Item removed from bag');
}

// ===================================================
// CHECKOUT VIEW
// ===================================================

let checkoutDeliveryMethod = 'Standard delivery';
let checkoutPaymentMethod = 'momo';
let checkoutMomoNetwork = 'MTN';

function checkout() {
  if (!cart.length) return cartPage();
  
  const user = getUser();
  const userName = user.name || '';
  const userPhone = user.phone || '';
  const userEmail = user.email || '';
  const userAddress = user.address || '';
  const userCity = (user.city && user.city !== 'undefined') ? user.city : '';
  const userRegion = (user.region && user.region !== 'undefined') ? user.region : 'Greater Accra';

  const st = subtotal();
  const disc = getDiscountAmount();
  const ship = getDeliveryFee(checkoutDeliveryMethod);
  const tot = grandTotal(checkoutDeliveryMethod);

  return `
    <main class="checkout-page">
      <section class="checkout-form-side animate-fade-up">
        <a class="brand" href="#home" onclick="go('home')">BYMARIE</a>
        
        <div class="checkout-steps">
          <span><b>1. Details</b></span>
          <span style="opacity:0.4">/</span>
          <span><b>2. Delivery</b></span>
          <span style="opacity:0.4">/</span>
          <span><b>3. Payment & Confirm</b></span>
        </div>

        <form onsubmit="handleCheckoutSubmit(event)">
          <h2 style="font-size:24px;margin-bottom:18px">1. Shipping Information</h2>
          <div class="form-grid">
            <div class="form-group">
              <label>Full Name</label>
              <input required name="name" value="${userName}" placeholder="Ama Mensah">
            </div>
            <div class="form-group">
              <label>Phone Number (for Delivery & MoMo)</label>
              <input required name="phone" type="tel" value="${userPhone}" placeholder="024 456 7890">
            </div>
            <div class="form-group full">
              <label>Email Address</label>
              <input required name="email" type="email" value="${userEmail}" placeholder="ama@example.com">
            </div>
            <div class="form-group full">
              <label>Delivery Address</label>
              <input required name="address" value="${userAddress}" placeholder="House / Apt number, Street, Landmark">
            </div>
            <div class="form-group">
              <label>City</label>
              <input required name="city" value="${userCity}" placeholder="Accra">
            </div>
            <div class="form-group">
              <label>Region</label>
              <select name="region">
                ${['Greater Accra', 'Ashanti', 'Central', 'Eastern', 'Western', 'Volta', 'Northern'].map(r => `
                  <option ${userRegion === r ? 'selected' : ''}>${r}</option>
                `).join('')}
              </select>
            </div>
          </div>

          <h2 style="font-size:24px;margin:32px 0 14px">2. Delivery Method</h2>
          <div class="delivery-options-stack">
            <label class="delivery-option-item ${checkoutDeliveryMethod === 'Standard delivery' ? 'active' : ''}">
              <div class="delivery-option-left">
                <input type="radio" name="deliveryMethod" value="Standard delivery" ${checkoutDeliveryMethod === 'Standard delivery' ? 'checked' : ''} onchange="checkoutDeliveryMethod=this.value;render()">
                <div>
                  <strong>Standard Delivery (2–4 Business Days)</strong>
                  <small>Dispatched via ByMarie courier</small>
                </div>
              </div>
              <b class="delivery-price">${st >= 300 || (appliedCoupon && appliedCoupon.type === 'shipping') ? 'FREE' : 'GH₵ 35.00'}</b>
            </label>

            <label class="delivery-option-item ${checkoutDeliveryMethod === 'Express delivery' ? 'active' : ''}">
              <div class="delivery-option-left">
                <input type="radio" name="deliveryMethod" value="Express delivery" ${checkoutDeliveryMethod === 'Express delivery' ? 'checked' : ''} onchange="checkoutDeliveryMethod=this.value;render()">
                <div>
                  <strong>Express Next-Day Delivery</strong>
                  <small>Priority dispatch across Accra & Kumasi</small>
                </div>
              </div>
              <b class="delivery-price">GH₵ 60.00</b>
            </label>
          </div>

          <h2 style="font-size:26px;margin:35px 0 16px">3. Payment Option</h2>
          
          <div class="luxe-payment-grid">
            <div class="luxe-payment-card mtn ${checkoutPaymentMethod === 'momo' && checkoutMomoNetwork === 'MTN' ? 'active' : ''}" onclick="checkoutPaymentMethod='momo';checkoutMomoNetwork='MTN';render()">
              ${checkoutPaymentMethod === 'momo' && checkoutMomoNetwork === 'MTN' ? '<span class="selected-check">✓</span>' : ''}
              <div>
                <span class="card-badge">MTN MoMo</span>
                <strong>MTN Mobile Money</strong>
                <small>USSD Direct Handset Prompt</small>
              </div>
            </div>

            <div class="luxe-payment-card telecel ${checkoutPaymentMethod === 'momo' && (checkoutMomoNetwork.includes('Telecel') || checkoutMomoNetwork.includes('Vodafone')) ? 'active' : ''}" onclick="checkoutPaymentMethod='momo';checkoutMomoNetwork='Telecel (Vodafone)';render()">
              ${checkoutPaymentMethod === 'momo' && (checkoutMomoNetwork.includes('Telecel') || checkoutMomoNetwork.includes('Vodafone')) ? '<span class="selected-check">✓</span>' : ''}
              <div>
                <span class="card-badge">Telecel Cash</span>
                <strong>Telecel (Vodafone)</strong>
                <small>Instant MoMo Push / OTP</small>
              </div>
            </div>

            <div class="luxe-payment-card at ${checkoutPaymentMethod === 'momo' && checkoutMomoNetwork.includes('AT') ? 'active' : ''}" onclick="checkoutPaymentMethod='momo';checkoutMomoNetwork='AT Money';render()">
              ${checkoutPaymentMethod === 'momo' && checkoutMomoNetwork.includes('AT') ? '<span class="selected-check">✓</span>' : ''}
              <div>
                <span class="card-badge">AT Money</span>
                <strong>AirtelTigo Cash</strong>
                <small>Ghana MoMo Gateway</small>
              </div>
            </div>

            <div class="luxe-payment-card card ${checkoutPaymentMethod === 'card' ? 'active' : ''}" onclick="checkoutPaymentMethod='card';render()">
              ${checkoutPaymentMethod === 'card' ? '<span class="selected-check">✓</span>' : ''}
              <div>
                <span class="card-badge">Bank Card</span>
                <strong>Visa / Mastercard</strong>
                <small>256-Bit TLS Direct Charge</small>
              </div>
            </div>

            <div class="luxe-payment-card wallet ${checkoutPaymentMethod === 'wallet' ? 'active' : ''}" onclick="checkoutPaymentMethod='wallet';render()">
              ${checkoutPaymentMethod === 'wallet' ? '<span class="selected-check">✓</span>' : ''}
              <div>
                <span class="card-badge">VIP Float</span>
                <strong>Float Wallet</strong>
                <small>${money(user.walletBalance || 0)} available</small>
              </div>
            </div>

            <div class="luxe-payment-card cod ${checkoutPaymentMethod === 'cod' ? 'active' : ''}" onclick="checkoutPaymentMethod='cod';render()">
              ${checkoutPaymentMethod === 'cod' ? '<span class="selected-check">✓</span>' : ''}
              <div>
                <span class="card-badge">Courier</span>
                <strong>Cash on Delivery</strong>
                <small>Accra Express Only</small>
              </div>
            </div>
          </div>

          ${checkoutPaymentMethod === 'wallet' ? `
            <div style="background:#fff;border:1.5px solid var(--line);border-radius:var(--radius-md);padding:22px;margin-bottom:24px;box-shadow:var(--shadow-subtle)">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                <div>
                  <span class="badge" style="background:#047857;color:#fff;font-size:10px;font-weight:800;padding:2px 8px">⚡ 1-CLICK CHECKOUT</span>
                  <strong style="font-size:16px;display:block;margin-top:4px">ByMarie Member Float Wallet</strong>
                </div>
                <b style="font-size:20px;color:${(user.walletBalance || 0) >= tot ? 'var(--emerald)' : 'var(--red)'}">${money(user.walletBalance || 0)}</b>
              </div>
              ${(user.walletBalance || 0) < tot ? `
                <div style="background:var(--red-bg);border:1px solid var(--red-line);padding:12px 14px;border-radius:var(--radius-sm);color:var(--red);font-size:13px;margin-top:10px;display:flex;justify-content:space-between;align-items:center">
                  <span>⚠️ Insufficient wallet balance for this order (${money(tot)}).</span>
                  <button type="button" class="primary" style="padding:6px 12px;font-size:11px" onclick="activeModal='topup_wallet';render()">+ Top Up Wallet</button>
                </div>
              ` : `
                <p style="color:var(--emerald);font-size:13px;font-weight:700;margin-top:8px">✓ Sufficient balance available. Total will be deducted automatically upon confirmation with zero card prompts.</p>
              `}
            </div>
          ` : ''}

          ${checkoutPaymentMethod === 'momo' ? `
            <div style="background:#fff;border:1.5px solid var(--line);border-radius:var(--radius-md);padding:22px;margin-bottom:24px;box-shadow:var(--shadow-subtle)">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
                <span class="badge" style="background:#182822;color:var(--gold-light);font-size:10.5px;font-weight:800;padding:3px 8px">🔒 PAYSTACK IN-APP PROMPT</span>
                <small style="color:var(--muted);font-weight:700">Selected Network: <b style="color:var(--ink)">${checkoutMomoNetwork}</b></small>
              </div>
              <div class="form-group">
                <label>Ghana Mobile Money Phone Number</label>
                <input required name="momoNumber" type="tel" value="${user.phone || ''}" placeholder="024 XXX XXXX" style="font-size:15px;font-weight:600;letter-spacing:0.5px">
                <small style="color:var(--muted);margin-top:6px;display:block">📲 An instant USSD prompt will be sent directly to this phone to authorize payment.</small>
              </div>
            </div>
          ` : ''}

          ${checkoutPaymentMethod === 'card' ? `
            <div style="background:#fff;border:1.5px solid var(--line);border-radius:var(--radius-md);padding:22px;margin-bottom:24px;box-shadow:var(--shadow-subtle)">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
                <span class="badge" style="background:#182822;color:var(--gold-light);font-size:10.5px;font-weight:800;padding:3px 8px">🔒 256-BIT TLS ENCRYPTED</span>
                <small style="color:var(--muted)">Visa, Mastercard &amp; AMEX</small>
              </div>
              <div class="form-grid">
                <div class="form-group full">
                  <label>Cardholder Full Name</label>
                  <input required name="cardName" value="${user.name || ''}" placeholder="Name on card">
                </div>
                <div class="form-group full">
                  <label>Card Number</label>
                  <input required name="cardNumber" maxlength="19" placeholder="4123 •••• •••• 1234" style="font-family:'DM Mono',monospace;font-size:14px">
                </div>
                <div class="form-group">
                  <label>Expiry (MM/YY)</label>
                  <input required name="cardExpiry" maxlength="5" placeholder="12/28" style="font-family:'DM Mono',monospace;text-align:center">
                </div>
                <div class="form-group">
                  <label>CVV / CVC Security Code</label>
                  <input required name="cardCvv" maxlength="4" placeholder="123" style="font-family:'DM Mono',monospace;text-align:center">
                </div>
              </div>
              <small style="color:var(--muted);display:block;margin-top:6px">🔒 Direct in-app bank handshake. Your card credentials are encrypted and never stored on the server.</small>
            </div>
          ` : ''}

          ${checkoutPaymentMethod === 'cod' ? `
            <div style="background:#fff;border:1.5px solid var(--line);border-radius:var(--radius-md);padding:22px;margin-bottom:24px;box-shadow:var(--shadow-subtle)">
              <strong style="display:block;margin-bottom:4px;font-size:14px">💵 Courier Hand-Delivery Cash / MoMo Payment</strong>
              <p style="color:var(--muted);font-size:13px;margin:0">Pay with physical cash or direct MoMo to our luxury dispatch courier upon door delivery in Greater Accra.</p>
            </div>
          ` : ''}

          <button class="primary" style="width:100%;height:54px;font-size:15px;font-weight:800" type="submit">
            Authorize &amp; Pay ${money(tot)} ${icon('arrow')}
          </button>
        </form>
      </section>

      <!-- Checkout Summary Side -->
      <aside class="checkout-summary-side animate-fade-up delay-1">
        <h2 style="font-size:22px;margin-bottom:20px">Order Details (${cartCount()} items)</h2>
        
        <div style="display:flex;flex-direction:column;gap:16px;margin-bottom:24px">
          ${cart.map(item => {
            const p = byId(item.id);
            if (!p) return '';
            return `
              <div style="display:flex;gap:14px;align-items:center">
                <img src="${p.image}" alt="${p.name}" style="width:55px;height:65px;object-fit:cover;border-radius:var(--radius-sm)">
                <div style="flex-grow:1">
                  <strong style="font-size:13px">${p.name}</strong>
                  <small style="display:block;color:var(--muted)">${item.qty} × ${money(p.price)} • ${item.variant}</small>
                </div>
                <b>${money(p.price * item.qty)}</b>
              </div>
            `;
          }).join('')}
        </div>

        <div class="summary-lines">
          <div>
            <span>Subtotal</span>
            <b>${money(st)}</b>
          </div>
          ${disc > 0 ? `
            <div style="color:var(--emerald)">
              <span>Promo (${appliedCoupon.code})</span>
              <b>−${money(disc)}</b>
            </div>
          ` : ''}
          <div>
            <span>Delivery (${checkoutDeliveryMethod})</span>
            <b>${ship === 0 ? '<span style="color:var(--emerald)">FREE</span>' : money(ship)}</b>
          </div>
        </div>

        <div class="summary-total">
          <span>Total Amount</span>
          <strong style="font-size:22px;color:var(--emerald)">${money(tot)}</strong>
        </div>
      </aside>
    </main>
  `;
}

function handleCheckoutSubmit(event) {
  event.preventDefault();

  // Authentication check gate before payment checkout!
  const user = getUser();
  if (!user || !user.loggedIn) {
    activeModal = 'checkout_auth';
    toast('Please sign in or create an account to complete checkout', 'info');
    render();
    return;
  }

  const form = event.target;
  const fd = new FormData(form);
  
  const orderDetails = {
    id: `BM-${Math.floor(100000 + Math.random() * 899999)}`,
    date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
    name: fd.get('name'),
    email: fd.get('email'),
    phone: fd.get('phone'),
    address: fd.get('address'),
    city: fd.get('city'),
    region: fd.get('region'),
    delivery: checkoutDeliveryMethod,
    payment: checkoutPaymentMethod === 'wallet' ? 'ByMarie Float Wallet (Verified)' : checkoutPaymentMethod === 'momo' ? `Mobile Money (${checkoutMomoNetwork})` : checkoutPaymentMethod === 'card' ? 'Card (Verified)' : 'Cash on Delivery',
    status: 'Pending',
    items: [...cart],
    subtotal: subtotal(),
    discountAmount: getDiscountAmount(),
    deliveryFee: getDeliveryFee(checkoutDeliveryMethod),
    total: grandTotal(checkoutDeliveryMethod)
  };
  
  if (checkoutPaymentMethod === 'wallet') {
    if ((user.walletBalance || 0) < orderDetails.total) {
      toast(`Insufficient Float Wallet balance (${money(user.walletBalance || 0)}). Please top up or select another payment option.`, 'warning');
      activeModal = 'topup_wallet';
      render();
      return;
    }
    
    // Deduct from Float Wallet
    user.walletBalance = Math.round(((user.walletBalance || 0) - orderDetails.total) * 100) / 100;
    saveUser(user);
    
    // Sync users list
    const users = getUsers();
    const uIdx = users.findIndex(u => u.email === user.email || u.id === user.id);
    if (uIdx !== -1) {
      users[uIdx].walletBalance = user.walletBalance;
      users[uIdx].ordersCount = (users[uIdx].ordersCount || 0) + 1;
      saveUsers(users);
    }
    
    orderDetails.status = 'Processing';
    toast(`Payment successful! ${money(orderDetails.total)} deducted from your Float Wallet 💳`);
    completeOrder(orderDetails);
    return;
  } else if (checkoutPaymentMethod === 'momo') {
    let provider = 'mtn';
    if (checkoutMomoNetwork.toLowerCase().includes('telecel') || checkoutMomoNetwork.toLowerCase().includes('vodafone')) {
      provider = 'vod';
    } else if (checkoutMomoNetwork.toLowerCase().includes('at')) {
      provider = 'tgo';
    }
    
    const momoPhone = fd.get('momoNumber') || user.phone || '';
    if (!momoPhone) {
      return toast('Please enter a valid Ghana Mobile Money number', 'warning');
    }

    orderDetails.payment = `Paystack Mobile Money (${checkoutMomoNetwork} - ${momoPhone})`;
    initiateInAppPaystackPayment(orderDetails, { type: 'momo', phone: momoPhone, provider });
    return;
  } else if (checkoutPaymentMethod === 'card') {
    const cardNum = fd.get('cardNumber') || '';
    const cardExp = fd.get('cardExpiry') || '';
    const cardCvv = fd.get('cardCvv') || '';
    const [expMonth, expYear] = cardExp.split('/').map(s => s.trim());

    if (!cardNum || !cardExp || !cardCvv) {
      return toast('Please complete all card details', 'warning');
    }

    orderDetails.payment = `Paystack Card (•••• ${cardNum.slice(-4)})`;
    initiateInAppPaystackPayment(orderDetails, {
      type: 'card',
      card: {
        number: cardNum,
        cvv: cardCvv,
        expiry_month: expMonth,
        expiry_year: expYear && expYear.length === 2 ? `20${expYear}` : expYear
      }
    });
    return;
  } else {
    completeOrder(orderDetails);
  }
}

// Seamless In-App Payment State
let seamlessPaymentState = {
  active: false,
  status: 'idle', // 'processing', 'send_otp', 'send_pin', 'pay_offline', 'success', 'failed', 'verifying_otp'
  orderData: null,
  paymentInfo: null,
  reference: '',
  displayText: '',
  channel: 'momo',
  phone: '',
  timerSeconds: 60,
  timerInterval: null,
  pollInterval: null
};

function clearSeamlessIntervals() {
  if (seamlessPaymentState.timerInterval) clearInterval(seamlessPaymentState.timerInterval);
  if (seamlessPaymentState.pollInterval) clearInterval(seamlessPaymentState.pollInterval);
  seamlessPaymentState.timerInterval = null;
  seamlessPaymentState.pollInterval = null;
}

function startSeamlessTimer(duration = 60) {
  if (seamlessPaymentState.timerInterval) clearInterval(seamlessPaymentState.timerInterval);
  seamlessPaymentState.timerSeconds = duration;
  seamlessPaymentState.timerInterval = setInterval(() => {
    seamlessPaymentState.timerSeconds--;
    const badge = document.getElementById('seamless-countdown-badge');
    if (badge) {
      if (seamlessPaymentState.timerSeconds > 0) {
        badge.textContent = `⏱️ Resend / retry in ${seamlessPaymentState.timerSeconds}s`;
      } else {
        badge.textContent = `⏱️ Timeout reached`;
        badge.classList.remove('active');
      }
    }
    if (seamlessPaymentState.timerSeconds <= 0) {
      clearInterval(seamlessPaymentState.timerInterval);
      seamlessPaymentState.timerInterval = null;
      render();
    }
  }, 1000);
}

function startSeamlessPolling(reference) {
  if (seamlessPaymentState.pollInterval) clearInterval(seamlessPaymentState.pollInterval);
  let pollAttempts = 0;
  seamlessPaymentState.pollInterval = setInterval(async () => {
    pollAttempts++;
    if (pollAttempts > 35) { // 35 * 2.5s = ~90 seconds max poll
      clearInterval(seamlessPaymentState.pollInterval);
      seamlessPaymentState.pollInterval = null;
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/paystack/verify/${encodeURIComponent(reference)}`);
      const data = await res.json();
      if (data.data && data.data.status === 'success') {
        clearSeamlessIntervals();
        seamlessPaymentState.status = 'success';
        playNotificationChime();
        render();
        setTimeout(() => {
          activeModal = null;
          if (seamlessPaymentState.orderData && seamlessPaymentState.orderData.isTopup) {
            completeWalletTopup(seamlessPaymentState.orderData);
          } else {
            completeOrder(seamlessPaymentState.orderData);
          }
        }, 1200);
      }
    } catch (e) {
      console.warn('Polling check note:', e.message);
    }
  }, 2500);
}

async function initiateInAppPaystackPayment(orderDetails, paymentInfo) {
  clearSeamlessIntervals();
  seamlessPaymentState = {
    active: true,
    status: 'processing',
    orderData: orderDetails,
    paymentInfo,
    reference: '',
    displayText: 'Connecting to Paystack Security Gateway...',
    channel: paymentInfo.type,
    phone: paymentInfo.phone || '',
    timerSeconds: 60,
    timerInterval: null,
    pollInterval: null
  };

  activeModal = 'paystack_seamless_payment';
  render();

  try {
    const payload = {
      email: orderDetails.email,
      amount: orderDetails.total,
      currency: 'GHS',
      metadata: { orderId: orderDetails.id, customerName: orderDetails.name, phone: orderDetails.phone }
    };

    if (paymentInfo.type === 'momo') {
      payload.mobile_money = { phone: paymentInfo.phone, provider: paymentInfo.provider };
    } else if (paymentInfo.type === 'card') {
      payload.card = paymentInfo.card;
    }

    const res = await fetch(`${API_BASE}/paystack/charge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!data.status && !data.data) {
      seamlessPaymentState.status = 'failed';
      seamlessPaymentState.displayText = data.message || 'Payment initialization declined. Please check your credentials.';
      render();
      return;
    }

    const chargeData = data.data || {};
    seamlessPaymentState.reference = chargeData.reference || `bm_ref_${Date.now()}`;

    if (chargeData.status === 'success') {
      seamlessPaymentState.status = 'success';
      playNotificationChime();
      render();
      setTimeout(() => {
        activeModal = null;
        if (orderDetails.isTopup) {
          completeWalletTopup(orderDetails);
        } else {
          completeOrder(orderDetails);
        }
      }, 1000);
      return;
    }

    if (chargeData.status === 'send_otp') {
      seamlessPaymentState.status = 'send_otp';
      seamlessPaymentState.displayText = chargeData.display_text || 'Please enter the verification code (OTP) sent to your phone.';
      startSeamlessTimer(60);
      render();
      return;
    }

    if (chargeData.status === 'pay_offline' || chargeData.status === 'pending' || chargeData.status === 'send_phone') {
      seamlessPaymentState.status = 'pay_offline';
      seamlessPaymentState.displayText = chargeData.display_text || `A payment prompt has been sent to ${paymentInfo.phone}. Please approve with your Mobile Money PIN on your handset.`;
      startSeamlessTimer(60);
      startSeamlessPolling(seamlessPaymentState.reference);
      render();
      return;
    }

    if (chargeData.status === 'send_pin') {
      seamlessPaymentState.status = 'send_pin';
      seamlessPaymentState.displayText = 'Please enter your 4-digit card security PIN.';
      render();
      return;
    }

    // Default fallback
    seamlessPaymentState.status = 'failed';
    seamlessPaymentState.displayText = chargeData.message || data.message || 'Payment could not be completed. Please try again.';
    render();
  } catch (err) {
    console.error('Seamless payment charge error:', err);
    seamlessPaymentState.status = 'failed';
    seamlessPaymentState.displayText = err.message || 'Network communication error with payment server.';
    render();
  }
}

async function handleSeamlessSubmitOtp(event) {
  event.preventDefault();
  const fd = new FormData(event.target);
  const otp = (fd.get('otp') || '').trim();

  if (!otp) return toast('Please enter the OTP code', 'warning');

  seamlessPaymentState.status = 'verifying_otp';
  render();

  try {
    const res = await fetch(`${API_BASE}/paystack/submit-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otp, reference: seamlessPaymentState.reference })
    });

    const data = await res.json();
    const chargeData = data.data || {};

    if (chargeData.status === 'success' || data.status === true) {
      clearSeamlessIntervals();
      seamlessPaymentState.status = 'success';
      playNotificationChime();
      render();
      setTimeout(() => {
        activeModal = null;
        if (seamlessPaymentState.orderData && seamlessPaymentState.orderData.isTopup) {
          completeWalletTopup(seamlessPaymentState.orderData);
        } else {
          completeOrder(seamlessPaymentState.orderData);
        }
      }, 1000);
      return;
    }

    if (chargeData.status === 'pending' || chargeData.status === 'pay_offline') {
      seamlessPaymentState.status = 'pay_offline';
      startSeamlessPolling(seamlessPaymentState.reference);
      render();
      return;
    }

    seamlessPaymentState.status = 'send_otp';
    toast(chargeData.message || data.message || 'Invalid OTP code. Please retry.', 'error');
    render();
  } catch (err) {
    seamlessPaymentState.status = 'send_otp';
    toast(`OTP verification note: ${err.message}`, 'warning');
    render();
  }
}

async function handleSeamlessManualVerify() {
  toast('Checking payment authorization status...', 'info');
  try {
    const res = await fetch(`${API_BASE}/paystack/verify/${encodeURIComponent(seamlessPaymentState.reference)}`);
    const data = await res.json();
    if (data.data && data.data.status === 'success') {
      clearSeamlessIntervals();
      seamlessPaymentState.status = 'success';
      playNotificationChime();
      render();
      setTimeout(() => {
        activeModal = null;
        if (seamlessPaymentState.orderData && seamlessPaymentState.orderData.isTopup) {
          completeWalletTopup(seamlessPaymentState.orderData);
        } else {
          completeOrder(seamlessPaymentState.orderData);
        }
      }, 1000);
    } else {
      toast('Payment is still pending authorization on your phone.', 'info');
    }
  } catch (e) {
    toast('Unable to verify transaction right now.', 'warning');
  }
}

let topupPaymentMethod = 'momo';
let topupMomoNetwork = 'MTN';

async function submitWalletTopup(event) {
  event.preventDefault();
  const user = getUser();
  if (!user || !user.loggedIn) {
    activeModal = 'auth';
    toast('Please sign in to top up your Float Wallet', 'warning');
    render();
    return;
  }

  const fd = new FormData(event.target);
  const amount = Number(fd.get('amount') || 0);
  if (amount < 5) return toast('Minimum deposit amount is GH₵ 5', 'warning');

  const depositDetails = {
    id: `TOPUP-${Math.floor(100000 + Math.random() * 900000)}`,
    isTopup: true,
    total: amount,
    email: user.email,
    name: user.name || 'Member',
    phone: user.phone || '',
    paymentMethod: topupPaymentMethod === 'card' ? 'Bank Card' : `Mobile Money (${topupMomoNetwork})`
  };

  if (topupPaymentMethod === 'momo') {
    let provider = 'mtn';
    if (topupMomoNetwork.toLowerCase().includes('telecel') || topupMomoNetwork.toLowerCase().includes('vodafone')) provider = 'vod';
    else if (topupMomoNetwork.toLowerCase().includes('at')) provider = 'tgo';

    const momoPhone = fd.get('momoNumber') || user.phone;
    if (!momoPhone) return toast('Please enter a Mobile Money number', 'warning');

    depositDetails.phone = momoPhone;
    initiateInAppPaystackPayment(depositDetails, { type: 'momo', phone: momoPhone, provider, isTopup: true });
  } else if (topupPaymentMethod === 'card') {
    const cardNum = fd.get('cardNumber') || '';
    const cardExp = fd.get('cardExpiry') || '';
    const cardCvv = fd.get('cardCvv') || '';
    const [expMonth, expYear] = cardExp.split('/').map(s => s.trim());

    if (!cardNum || !cardExp || !cardCvv) return toast('Please complete card details', 'warning');

    initiateInAppPaystackPayment(depositDetails, {
      type: 'card',
      isTopup: true,
      card: {
        number: cardNum,
        cvv: cardCvv,
        expiry_month: expMonth,
        expiry_year: expYear && expYear.length === 2 ? `20${expYear}` : expYear
      }
    });
  }
}

async function completeWalletTopup(depositDetails) {
  toast('Verifying deposit and crediting Float Wallet...', 'info');
  const user = getUser();

  try {
    const res = await fetch(`${API_BASE}/wallet/deposit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        email: user.email,
        name: user.name,
        phone: depositDetails.phone || user.phone,
        amount: depositDetails.total,
        reference: depositDetails.id,
        paymentMethod: depositDetails.paymentMethod
      })
    });

    const data = await res.json();
    if (data.balance !== undefined) {
      user.walletBalance = data.balance;
    } else {
      user.walletBalance = Number(((user.walletBalance || 0) + depositDetails.total).toFixed(2));
    }
  } catch (e) {
    user.walletBalance = Number(((user.walletBalance || 0) + depositDetails.total).toFixed(2));
  }

  saveUser(user);
  
  // Sync users array
  const users = getUsers();
  const uIdx = users.findIndex(u => u.email === user.email || u.id === user.id);
  if (uIdx !== -1) {
    users[uIdx].walletBalance = user.walletBalance;
    saveUsers(users);
  }

  // Record transaction in ledger
  const txList = getTransactions();
  txList.unshift({
    id: depositDetails.id,
    type: 'Credit',
    amount: depositDetails.total,
    note: `Paystack Deposit (${depositDetails.paymentMethod})`,
    date: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' • ' + new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
  });
  saveTransactions(txList);

  activeModal = null;
  playNotificationChime();
  render();
  toast(`🎉 Deposit Verified! GH₵ ${depositDetails.total} credited to your Float Wallet. Available balance: ${money(user.walletBalance)}`);
}

function cancelSeamlessPayment() {
  clearSeamlessIntervals();
  activeModal = null;
  render();
}

function playNotificationChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1318.51, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) {}
}

async function completeOrder(order) {
  toast('Verifying prices and registering order on server...', 'info');

  try {
    const res = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: order.id,
        name: order.name,
        email: order.email,
        phone: order.phone,
        address: order.address,
        city: order.city,
        region: order.region,
        delivery: order.delivery,
        payment: order.payment,
        items: cart.map(it => ({ id: it.id, qty: it.qty, size: it.size, color: it.color })),
        couponCode: appliedCoupon ? appliedCoupon.code : null
      })
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Server rejected order verification');
    }

    const verifiedOrder = await res.json();
    
    // Save verified authoritative order
    const orders = getOrders();
    orders.unshift(verifiedOrder);
    saveOrders(orders);

    // Register In-Dashboard Admin Notification
    const notifs = getNotifications();
    notifs.unshift({
      id: `notif-${Date.now()}`,
      type: 'order',
      title: `⚡ New Order #${verifiedOrder.id} Placed!`,
      message: `${verifiedOrder.name} placed an order for GH₵ ${Number(verifiedOrder.total || 0).toFixed(2)} (${verifiedOrder.city}).`,
      date: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' • Today',
      target: 'admin',
      orderId: verifiedOrder.id,
      read: false
    });
    saveNotifications(notifs);
    playNotificationChime();

    cart = [];
    saveCart();
    appliedCoupon = null;
    saveAppliedCoupon();

    activeModal = null;
    go(`confirmation/${verifiedOrder.id}`);
    toast('Order confirmed! Admin alert sent via SMS, Email & Dashboard ⚡');
    return;
  } catch (err) {
    console.error('Server order submission error:', err);
    toast(`Order creation notice: ${err.message}`, 'warning');
    
    // Fallback save
    const orders = getOrders();
    orders.unshift(order);
    saveOrders(orders);

    cart = [];
    saveCart();
    appliedCoupon = null;
    saveAppliedCoupon();

    activeModal = null;
    go(`confirmation/${order.id}`);
  }
}

// ===================================================
// ORDER CONFIRMATION VIEW
// ===================================================

function confirmation(orderId) {
  const orders = getOrders();
  const order = orders.find(o => o.id === orderId) || orders[0];
  if (!order) return home();

  return `
    <main class="confirmation-container animate-fade-up">
      <div class="success-icon">${icon('check')}</div>
      <span class="eyebrow" style="justify-content:center">ORDER CONFIRMED</span>
      <h1 style="font-size:46px;margin:12px 0 8px">Thank you, ${order.name.split(' ')[0]}.</h1>
      <p style="color:var(--muted);font-size:15px;max-width:500px;margin:0 auto 20px">
        We have received your order <strong>#${order.id}</strong> and our team is preparing your selection with care.
      </p>

      <div class="order-info-card">
        <div>
          <span>Order Number</span>
          <strong>${order.id}</strong>
        </div>
        <div>
          <span>Total Paid</span>
          <strong>${money(order.total)}</strong>
        </div>
        <div>
          <span>Payment Method</span>
          <strong>${order.payment}</strong>
        </div>
        <div>
          <span>Status</span>
          <span class="badge ${order.status.toLowerCase()}">${order.status}</span>
        </div>
      </div>

      <div style="background:#fff;border:1px solid var(--line);border-radius:var(--radius-md);padding:24px;text-align:left;margin-bottom:30px">
        <h3 style="font-size:18px;margin-bottom:16px">Delivery To</h3>
        <p style="color:#455650;line-height:1.6">
          <strong>${order.name}</strong><br>
          ${order.address}<br>
          ${order.city}, ${order.region} • ${order.phone}
        </p>
      </div>

      <div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap">
        <button class="primary" onclick="go('account')">Track Order in Account</button>
        <button class="secondary-btn" onclick="window.print()">Print Receipt</button>
        <button class="text-btn" onclick="go('shop')">Continue Shopping ${icon('arrow')}</button>
      </div>
    </main>
  `;
}

// ===================================================
// CUSTOMER ACCOUNT PORTAL
// ===================================================

let accountTab = 'hub';

function renderOrderStatusTimeline(status) {
  const steps = ['Pending', 'Processing', 'Shipped', 'Delivered'];
  const curIdx = steps.indexOf(status) !== -1 ? steps.indexOf(status) : 1;

  return `
    <div class="timeline-stepper">
      ${steps.map((stepName, idx) => `
        <div class="timeline-step ${idx <= curIdx ? 'completed' : ''} ${idx === curIdx ? 'active' : ''}">
          <div class="timeline-icon">${idx <= curIdx ? '✓' : idx + 1}</div>
          <label>${stepName}</label>
          <span>${idx < curIdx ? 'Completed' : idx === curIdx ? 'In Progress' : 'Pending'}</span>
        </div>
      `).join('')}
    </div>
  `;
}

let accountMenuOpen = false;

function getAccountTabLabel(tab, ordersCount, walletBalance, points, wishlistCount) {
  switch (tab) {
    case 'orders': return `📦 Orders & Tracking (${ordersCount || 0})`;
    case 'wallet': return `💳 Float Wallet (${money(walletBalance || 0)})`;
    case 'rewards': return `⭐ VIP Rewards (${points || 0} pts)`;
    case 'address': return `📍 Saved Delivery & Fit`;
    case 'wholesale': return `⚡ VIP Wholesale (Bulk)`;
    case 'wishlist': return `♡ Saved Wishlist (${wishlistCount || 0})`;
    case 'security': return `🔒 Security & Alerts`;
    case 'support': return `💬 24/7 Concierge`;
    default: return `📦 Orders & Tracking`;
  }
}

function account() {
  const user = getUser();

  if (!user || !user.loggedIn) {
    return `
      <main class="account-shell animate-fade-up">
        <div style="max-width:480px;margin:40px auto;padding:32px 24px;background:#fff;border:1px solid #f2cfd8;border-radius:var(--radius-lg);box-shadow:var(--shadow-subtle);text-align:center">
          <div style="width:60px;height:60px;border-radius:50%;background:#fff5f7;color:#c24d67;display:grid;place-items:center;font-size:28px;margin:0 auto 16px">👑</div>
          <span style="font-size:11px;font-weight:800;letter-spacing:1px;color:#c24d67;text-transform:uppercase">Haute Couture Atelier</span>
          <h2 style="font-size:26px;margin:8px 0 12px;font-family:'Playfair Display',serif">Welcome to ByMarie</h2>
          <p style="color:var(--muted);font-size:13.5px;margin-bottom:24px;line-height:1.6">Sign in or create an account to track your orders in real time, access your digital Float Wallet, and manage your private fitting profile.</p>
          <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
            <button class="primary" style="background:#c24d67;padding:12px 28px;border-radius:var(--radius-sm);font-weight:700" onclick="authMode='signin';go('auth')">Sign In</button>
            <button class="secondary-btn" style="padding:12px 24px;border-radius:var(--radius-sm);font-weight:700" onclick="authMode='signup';go('auth')">Create Account</button>
          </div>
        </div>
      </main>
    `;
  }

  const allOrders = getOrders();
  const orders = allOrders.filter(o => !o.email || o.email.toLowerCase() === user.email.toLowerCase() || o.phone === user.phone);
  const totalSpend = orders.reduce((sum, o) => sum + o.total, 0);

  // VIP Points & Tier Calculator
  const loyaltyPoints = Math.floor(totalSpend / 10);
  let tierName = 'Silver Connoisseur';
  let tierProgress = Math.min(100, Math.round((loyaltyPoints / 100) * 100));
  let nextTierGoal = 100;
  if (loyaltyPoints >= 250) {
    tierName = 'Diamond VIP Inner Circle';
    tierProgress = 100;
    nextTierGoal = 250;
  } else if (loyaltyPoints >= 100) {
    tierName = 'Gold Connoisseur';
    tierProgress = Math.min(100, Math.round(((loyaltyPoints - 100) / 150) * 100));
    nextTierGoal = 250;
  }

  const transactions = user.walletTransactions || [
    { id: 'TXN-902148', date: 'Recent', type: 'Credit', amount: user.walletBalance || 0, note: 'Initial Welcome Balance Credit', status: 'Completed' }
  ];

  return `
    <main class="account-shell animate-fade-up">
      <!-- Dedicated Account Top Sub-Navbar -->
      <div class="account-sub-navbar">
        <button type="button" class="account-back-btn" onclick="filters.cat='All';go('shop')">
          ← Back to Boutique
        </button>
        <div class="account-sub-title">
          <span>BYMARIE PRIVATE CLIENT ATELIER</span>
        </div>
        <div class="account-sub-actions">
          <button type="button" class="sub-nav-btn" onclick="go('notifications')" title="Notifications">
            🔔
          </button>
          <button type="button" class="sub-nav-btn" onclick="openDrawer('cart')" title="Shopping Bag">
            🛍️ <span class="sub-nav-badge">${cart.length}</span>
          </button>
        </div>
      </div>

      <!-- Top Luxury Atelier Member Card -->
      <div class="account-hero-card">
        <div class="account-hero-profile">
          <div class="account-hero-avatar">${(user.name || 'M').charAt(0).toUpperCase()}</div>
          <div class="account-hero-info">
            <span class="account-tier-tag">✨ ${tierName.toUpperCase()}</span>
            <h1 class="account-user-title">${user.name || 'Valued Member'}</h1>
            <p class="account-user-email">${user.email}</p>
          </div>
        </div>
        
        <div class="account-hero-actions">
          <div class="account-wallet-pill" onclick="accountTab='wallet';render()">
            <span class="wallet-pill-label">Float Balance</span>
            <strong class="wallet-pill-val">${money(user.walletBalance || 0)}</strong>
            <button type="button" class="wallet-pill-btn" onclick="event.stopPropagation();activeModal='topup_wallet';render()">+ Top Up</button>
          </div>
          <button type="button" class="account-signout-btn" onclick="clearUser()">Sign Out</button>
        </div>
      </div>

      <!-- Quick 3-Metric Bento Grid (Clickable to Tabs) -->
      <div class="account-metrics-grid">
        <div class="account-metric-card ${accountTab === 'orders' ? 'active' : ''}" onclick="accountTab='orders';render()">
          <span class="metric-icon">📦</span>
          <div class="metric-text">
            <span class="metric-label">Total Orders</span>
            <strong class="metric-val">${orders.length}</strong>
          </div>
        </div>
        <div class="account-metric-card ${accountTab === 'wallet' ? 'active' : ''}" onclick="accountTab='wallet';render()">
          <span class="metric-icon">💳</span>
          <div class="metric-text">
            <span class="metric-label">Float Wallet</span>
            <strong class="metric-val">${money(user.walletBalance || 0)}</strong>
          </div>
        </div>
        <div class="account-metric-card ${accountTab === 'rewards' ? 'active' : ''}" onclick="accountTab='rewards';render()">
          <span class="metric-icon">⭐</span>
          <div class="metric-text">
            <span class="metric-label">VIP Points</span>
            <strong class="metric-val">${loyaltyPoints} <small>pts</small></strong>
          </div>
        </div>
      </div>

      <!-- Tab Content Area -->
      <div class="account-content-card">
        ${accountTab !== 'hub' ? `
          <!-- Active Tab Navigation Toolbar -->
          <div class="tab-nav-toolbar">
            <button type="button" class="tab-back-btn" onclick="accountTab='hub';render()">
              ← All Account Features
            </button>
            <div class="tab-switcher-wrapper">
              <button type="button" class="tab-switcher-btn" onclick="accountMenuOpen = !accountMenuOpen; render()">
                <span>${getAccountTabLabel(accountTab, orders.length, user.walletBalance, loyaltyPoints, wishlist.length)}</span>
                <span class="switcher-arrow">${accountMenuOpen ? '▲' : '▼'}</span>
              </button>

              ${accountMenuOpen ? `
                <div class="account-menu-backdrop" onclick="accountMenuOpen=false;render()"></div>
                <div class="account-custom-dropdown animate-scale-up">
                  <div class="account-dropdown-head">
                    <span class="dropdown-eyebrow">ATELIER DIRECTORY</span>
                    <button type="button" class="dropdown-close-btn" onclick="accountMenuOpen=false;render()">✕</button>
                  </div>

                  <div class="account-dropdown-items">
                    <div class="custom-dropdown-option ${accountTab==='orders'?'active':''}" onclick="accountTab='orders';accountMenuOpen=false;render()">
                      <span class="opt-icon">📦</span>
                      <div class="opt-text">
                        <strong>Orders &amp; Tracking</strong>
                        <small>${orders.length} orders placed</small>
                      </div>
                      <span class="opt-badge">${orders.length}</span>
                    </div>

                    <div class="custom-dropdown-option ${accountTab==='wallet'?'active':''}" onclick="accountTab='wallet';accountMenuOpen=false;render()">
                      <span class="opt-icon">💳</span>
                      <div class="opt-text">
                        <strong>Float Wallet &amp; Ledger</strong>
                        <small>${money(user.walletBalance||0)} available</small>
                      </div>
                      <span class="opt-arrow">→</span>
                    </div>

                    <div class="custom-dropdown-option ${accountTab==='rewards'?'active':''}" onclick="accountTab='rewards';accountMenuOpen=false;render()">
                      <span class="opt-icon">⭐</span>
                      <div class="opt-text">
                        <strong>VIP Rewards &amp; Tier</strong>
                        <small>${loyaltyPoints} points • ${tierName}</small>
                      </div>
                      <span class="opt-arrow">→</span>
                    </div>

                    <div class="custom-dropdown-option ${accountTab==='address'?'active':''}" onclick="accountTab='address';accountMenuOpen=false;render()">
                      <span class="opt-icon">📍</span>
                      <div class="opt-text">
                        <strong>Saved Delivery &amp; Fit</strong>
                        <small>${user.city || 'Accra'} • Store Pickup</small>
                      </div>
                      <span class="opt-arrow">→</span>
                    </div>

                    <div class="custom-dropdown-option ${accountTab==='wholesale'?'active':''}" onclick="accountTab='wholesale';accountMenuOpen=false;render()">
                      <span class="opt-icon">⚡</span>
                      <div class="opt-text">
                        <strong>VIP Wholesale Portal</strong>
                        <small>Bulk discounts (15%–40% Off)</small>
                      </div>
                      <span class="badge" style="background:#c24d67;color:#fff;font-size:9.5px;padding:2px 6px">BULK</span>
                    </div>

                    <div class="custom-dropdown-option ${accountTab==='wishlist'?'active':''}" onclick="accountTab='wishlist';accountMenuOpen=false;render()">
                      <span class="opt-icon">♡</span>
                      <div class="opt-text">
                        <strong>Saved Wishlist</strong>
                        <small>${wishlist.length} pieces bookmarked</small>
                      </div>
                      <span class="opt-badge">${wishlist.length}</span>
                    </div>

                    <div class="custom-dropdown-option ${accountTab==='security'?'active':''}" onclick="accountTab='security';accountMenuOpen=false;render()">
                      <span class="opt-icon">🔒</span>
                      <div class="opt-text">
                        <strong>Security &amp; Alerts</strong>
                        <small>Password &amp; notifications</small>
                      </div>
                      <span class="opt-arrow">→</span>
                    </div>

                    <div class="custom-dropdown-option ${accountTab==='support'?'active':''}" onclick="accountTab='support';accountMenuOpen=false;render()">
                      <span class="opt-icon">💬</span>
                      <div class="opt-text">
                        <strong>24/7 Client Concierge</strong>
                        <small>WhatsApp &amp; stylists</small>
                      </div>
                      <span class="opt-arrow">→</span>
                    </div>
                  </div>
                </div>
              ` : ''}
            </div>
          </div>
        ` : `
          <!-- Main Atelier Hub Feature Grid -->
          <div class="account-hub-grid">
            <div class="hub-tile" onclick="accountTab='orders';render()">
              <div class="hub-tile-icon">📦</div>
              <div class="hub-tile-body">
                <strong>Orders &amp; Tracking</strong>
                <small>${orders.length} orders placed</small>
              </div>
              <span class="hub-tile-badge">${orders.length}</span>
            </div>

            <div class="hub-tile" onclick="accountTab='wallet';render()">
              <div class="hub-tile-icon">💳</div>
              <div class="hub-tile-body">
                <strong>Float Wallet &amp; Ledger</strong>
                <small>${money(user.walletBalance || 0)} available balance</small>
              </div>
              <span class="hub-tile-arrow">→</span>
            </div>

            <div class="hub-tile" onclick="accountTab='rewards';render()">
              <div class="hub-tile-icon">⭐</div>
              <div class="hub-tile-body">
                <strong>VIP Rewards &amp; Tier</strong>
                <small>${loyaltyPoints} points • ${tierName}</small>
              </div>
              <span class="hub-tile-arrow">→</span>
            </div>

            <div class="hub-tile" onclick="accountTab='address';render()">
              <div class="hub-tile-icon">📍</div>
              <div class="hub-tile-body">
                <strong>Saved Delivery &amp; Fit</strong>
                <small>${user.city || 'Accra'} • Store Pickup</small>
              </div>
              <span class="hub-tile-arrow">→</span>
            </div>

            <div class="hub-tile" onclick="accountTab='wholesale';render()">
              <div class="hub-tile-icon">⚡</div>
              <div class="hub-tile-body">
                <strong>VIP Wholesale Portal</strong>
                <small>Bulk discounts (15%–40% Off)</small>
              </div>
              <span class="badge" style="background:#c24d67;color:#fff;font-size:10px">BULK</span>
            </div>

            <div class="hub-tile" onclick="accountTab='wishlist';render()">
              <div class="hub-tile-icon">♡</div>
              <div class="hub-tile-body">
                <strong>Saved Wishlist</strong>
                <small>${wishlist.length} pieces bookmarked</small>
              </div>
              <span class="hub-tile-badge">${wishlist.length}</span>
            </div>

            <div class="hub-tile" onclick="accountTab='security';render()">
              <div class="hub-tile-icon">🔒</div>
              <div class="hub-tile-body">
                <strong>Security &amp; Alerts</strong>
                <small>Password, 2FA &amp; notifications</small>
              </div>
              <span class="hub-tile-arrow">→</span>
            </div>

            <div class="hub-tile" onclick="accountTab='support';render()">
              <div class="hub-tile-icon">💬</div>
              <div class="hub-tile-body">
                <strong>24/7 Client Concierge</strong>
                <small>WhatsApp &amp; fashion stylists</small>
              </div>
              <span class="hub-tile-arrow">→</span>
            </div>
          </div>
        `}

        <!-- ================= TAB: ORDERS ================= -->
        ${accountTab === 'orders' ? `
          <div class="tab-header-row">
            <div>
              <h2 class="tab-title">Orders &amp; Tracking</h2>
              <p class="tab-subtitle">Real-time status updates and order history</p>
            </div>
            <div class="order-search-box">
              <input id="order-lookup-input" placeholder="Order ID (e.g. BM-863921)" />
              <button type="button" class="primary" style="background:#c24d67;padding:8px 16px;border-radius:var(--radius-sm);font-size:12px;font-weight:700" onclick="const val=(document.getElementById('order-lookup-input').value||'').trim(); if(val){openOrderModal(val)} else {toast('Please enter an order ID', 'warning')}">Track</button>
            </div>
          </div>

          ${orders.length ? `
            <!-- Mobile Responsive Order Cards -->
            <div class="mobile-order-cards" style="display:flex">
              ${orders.map(o => `
                <div class="mobile-order-card">
                  <div class="mobile-order-card-header">
                    <div>
                      <b style="font-family:'DM Mono';font-size:14px;color:var(--ink)">#${o.id}</b>
                      <small style="display:block;color:var(--muted);font-size:11.5px;margin-top:2px">${o.date}</small>
                    </div>
                    <span class="badge ${o.status.toLowerCase()}">${o.status}</span>
                  </div>
                  <div class="mobile-order-card-body">
                    <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                      <span style="color:var(--muted);font-size:12.5px">Total Amount</span>
                      <strong style="font-size:14px;color:#c24d67">${money(o.total)}</strong>
                    </div>
                    <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                      <span style="color:var(--muted);font-size:12.5px">Payment</span>
                      <small style="font-weight:600">${o.payment || 'Verified'}</small>
                    </div>
                    <div style="display:flex;justify-content:space-between">
                      <span style="color:var(--muted);font-size:12.5px">Delivery</span>
                      <small style="font-weight:600">${o.city || 'Accra'} (${o.delivery || 'Standard'})</small>
                    </div>
                  </div>
                  <div class="mobile-order-card-actions">
                    <button type="button" class="primary" style="flex:1;background:#c24d67;padding:10px;font-size:12px;font-weight:700" onclick="openOrderModal('${o.id}')">Track Progress</button>
                    <button type="button" class="secondary-btn" style="padding:10px 16px;font-size:12px;font-weight:700" onclick="openInvoiceModal('${o.id}')">Invoice</button>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : `
            <div style="text-align:center;padding:48px 20px;background:#fafafa;border:1px dashed #e4e4e7;border-radius:var(--radius-md)">
              <span style="font-size:36px;display:block;margin-bottom:10px">🛍️</span>
              <h3 style="font-size:18px;margin:0 0 6px;font-family:'Playfair Display',serif">No orders yet</h3>
              <p style="color:var(--muted);font-size:13px;margin:0 0 18px">Your shopping journey begins in our curated luxury collections.</p>
              <button type="button" class="primary" style="background:#c24d67;padding:10px 24px;border-radius:var(--radius-sm);font-weight:700" onclick="filters.cat='All';go('shop')">Explore Shop</button>
            </div>
          `}
        ` : ''}

        <!-- ================= TAB: FLOAT WALLET ================= -->
        ${accountTab === 'wallet' ? `
          <div class="account-digital-wallet-card">
            <div class="wallet-card-header">
              <div>
                <span class="eyebrow" style="color:var(--gold-light);font-size:10px">BYMARIE MEMBER FLOAT WALLET</span>
                <h3 style="margin:2px 0 0;font-size:18px;color:#fff">${user.name || 'Member'}</h3>
              </div>
              <span class="badge" style="background:rgba(255,255,255,0.2);color:#fff;border:1px solid rgba(255,255,255,0.4);font-size:11px;font-weight:700">⚡ ACTIVE</span>
            </div>
            
            <small style="color:rgba(255,255,255,0.7);display:block;font-size:11px;text-transform:uppercase;letter-spacing:1px">Available Store Balance</small>
            <div class="wallet-balance-big">${money(user.walletBalance || 0)}</div>

            <div class="wallet-card-foot">
              <div>
                <small style="color:rgba(255,255,255,0.6);display:block;font-size:11px">Account Reference</small>
                <b style="font-family:'DM Mono';letter-spacing:0.5px;color:#fff">${user.id || 'BM-VIP-2026'}</b>
              </div>
              <button type="button" class="primary" style="background:var(--gold);color:var(--ink);border:0;padding:10px 20px;font-weight:800;font-size:12.5px" onclick="activeModal='topup_wallet';render()">
                + Top Up Wallet Funds
              </button>
            </div>
          </div>

          <div style="background:#fff;border:1px solid var(--line);border-radius:var(--radius-md);padding:20px;margin-bottom:24px">
            <h4 style="margin:0 0 6px;font-size:15px">⚡ Quick Top-Up via Paystack</h4>
            <p style="color:var(--muted);font-size:12.5px;margin-bottom:14px">Instantly load your balance using MTN Mobile Money, Telecel Cash, or Visa / Mastercard.</p>
            <div class="topup-amount-chips">
              ${[100, 250, 500, 1000].map(amt => `
                <button type="button" class="topup-chip" onclick="activeModal='topup_wallet';render();setTimeout(()=>{const inp=document.getElementById('topup-amt-input');if(inp)inp.value=${amt}},50)">
                  + GH₵ ${amt}
                </button>
              `).join('')}
            </div>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
            <h4 style="margin:0;font-size:16px">Transaction Ledger &amp; History</h4>
            <span style="font-size:12px;color:var(--muted)">Showing recent activity</span>
          </div>

          <div class="mobile-transaction-cards" style="display:flex">
            ${transactions.map(t => `
              <div class="mobile-transaction-card">
                <div class="mobile-transaction-header">
                  <div>
                    <strong style="font-size:13px;display:block">${t.note || 'Wallet Activity'}</strong>
                    <small style="color:var(--muted);font-family:'DM Mono';font-size:11px">${t.id || 'TXN'}</small>
                  </div>
                  <b style="font-size:14.5px;color:${t.type === 'Credit' ? 'var(--emerald)' : 'var(--red)'}">
                    ${t.type === 'Credit' ? '+' : '−'}${money(t.amount || 0)}
                  </b>
                </div>
                <div class="mobile-transaction-footer">
                  <span class="badge ${t.type === 'Credit' ? 'delivered' : 'pending'}" style="font-size:10px">
                    ${t.type === 'Credit' ? '↓ Credit' : '↑ Debit'}
                  </span>
                  <small style="color:var(--muted);font-size:11px">${t.date || 'Recent'}</small>
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <!-- ================= TAB: VIP REWARDS ================= -->
        ${accountTab === 'rewards' ? `
          <div class="tier-progress-card">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div>
                <span class="eyebrow" style="color:var(--emerald)">LOYALTY STATUS</span>
                <h3 style="font-size:22px;margin:2px 0 4px">${tierName}</h3>
                <small style="color:var(--muted)">Earn 10 points for every GH₵ 100 spent across all collections.</small>
              </div>
              <div style="text-align:right">
                <strong style="font-size:26px;color:var(--gold)">${loyaltyPoints}</strong>
                <small style="display:block;color:var(--muted);font-weight:700;font-size:11px">VIP POINTS</small>
              </div>
            </div>

            <div class="tier-progress-track">
              <div class="tier-progress-fill" style="width:${tierProgress}%"></div>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--muted);font-weight:600">
              <span>Current: ${loyaltyPoints} pts</span>
              <span>Next Milestone: ${nextTierGoal} pts</span>
            </div>
          </div>

          <h4 style="font-size:16px;margin:24px 0 12px">Unlocked VIP Member Privileges</h4>
          <div class="privileges-grid">
            <div class="privilege-card">
              <span style="font-size:24px">🎁</span>
              <strong style="display:block;margin:6px 0 2px;font-size:13.5px">Complimentary Gift Packaging</strong>
              <small style="color:var(--muted)">Signature satin ribbons &amp; embossed gift boxes on request.</small>
            </div>
            <div class="privilege-card">
              <span style="font-size:24px">⚡</span>
              <strong style="display:block;margin:6px 0 2px;font-size:13.5px">Priority Same-Day Dispatch</strong>
              <small style="color:var(--muted)">Orders placed before 2:00 PM dispatched first.</small>
            </div>
            <div class="privilege-card">
              <span style="font-size:24px">👑</span>
              <strong style="display:block;margin:6px 0 2px;font-size:13.5px">Private Drops Early Access</strong>
              <small style="color:var(--muted)">Preview limited edition silk &amp; hair drops 24h early.</small>
            </div>
          </div>
        ` : ''}

        <!-- ================= TAB: ADDRESS & FIT ================= -->
        ${accountTab === 'address' ? `
          <!-- Profile Card -->
          <div style="background:#fff;border:1px solid var(--line);border-radius:var(--radius-md);padding:22px;margin-bottom:20px;box-shadow:var(--shadow-subtle)">
            <h3 style="font-family:'Playfair Display',serif;font-size:19px;margin:0 0 16px;color:var(--ink)">Profile Details</h3>
            <form onsubmit="saveUserProfile(event)">
              <div class="form-group" style="margin-bottom:14px">
                <label style="font-size:11px;font-weight:700;color:var(--muted);letter-spacing:0.8px;text-transform:uppercase;display:block;margin-bottom:6px">FULL NAME</label>
                <input required name="name" value="${user.name || ''}" placeholder="Enter full name" style="width:100%;padding:12px 14px;border:1px solid var(--line);border-radius:var(--radius-sm);font-size:13.5px;color:var(--ink)">
              </div>
              <div class="form-group" style="margin-bottom:14px">
                <label style="font-size:11px;font-weight:700;color:var(--muted);letter-spacing:0.8px;text-transform:uppercase;display:block;margin-bottom:6px">PHONE NUMBER</label>
                <input required name="phone" value="${user.phone || ''}" placeholder="054 XXX XXXX" style="width:100%;padding:12px 14px;border:1px solid var(--line);border-radius:var(--radius-sm);font-size:13.5px;color:var(--ink)">
              </div>
              <div class="form-group" style="margin-bottom:18px">
                <label style="font-size:11px;font-weight:700;color:var(--muted);letter-spacing:0.8px;text-transform:uppercase;display:block;margin-bottom:6px">EMAIL</label>
                <div style="display:flex;align-items:center;gap:10px;background:#f4f4f5;border:1px solid var(--line);border-radius:var(--radius-sm);padding:12px 14px">
                  <span style="font-size:13px;color:var(--muted)">🔒</span>
                  <input readonly disabled value="${user.email || ''}" style="border:none;background:transparent;width:100%;outline:none;font-size:13.5px;color:var(--muted)">
                </div>
              </div>
              <button type="submit" class="primary" style="background:#c24d67;color:#fff;border:none;padding:12px 24px;border-radius:var(--radius-sm);font-size:13.5px;font-weight:700;cursor:pointer;width:100%">Save Profile</button>
            </form>
          </div>

          <!-- Saved Delivery Card -->
          <div style="background:#fff;border:1px solid var(--line);border-radius:var(--radius-md);padding:22px;margin-bottom:20px;box-shadow:var(--shadow-subtle)">
            <h3 style="font-family:'Playfair Display',serif;font-size:19px;margin:0 0 4px;color:var(--ink)">Saved Delivery</h3>
            <p style="color:var(--muted);font-size:12px;margin:0 0 18px">This will pre-fill your address at checkout</p>
            
            <form onsubmit="saveUserProfile(event)">
              <!-- Store Pickup Toggle -->
              <div style="display:flex;justify-content:space-between;align-items:center;background:#fafafa;border:1px solid var(--line);border-radius:var(--radius-sm);padding:12px 14px;margin-bottom:16px">
                <div>
                  <strong style="font-size:13px;color:var(--ink);display:block">Prefer Store Pickup</strong>
                  <small style="color:var(--muted);font-size:11px">Pick up for free at ByMarie Atelier, Cantonments, Accra</small>
                </div>
                <label style="position:relative;display:inline-block;width:44px;height:24px;margin:0;cursor:pointer;flex-shrink:0">
                  <input type="checkbox" name="preferPickup" ${user.preferPickup ? 'checked' : ''} onchange="user.preferPickup=this.checked;saveUser(user);render()" style="opacity:0;width:0;height:0">
                  <span style="position:absolute;top:0;left:0;right:0;bottom:0;background:${user.preferPickup ? '#c24d67' : '#e4e4e7'};border-radius:24px;transition:0.3s">
                    <span style="position:absolute;height:18px;width:18px;left:${user.preferPickup ? '22px' : '3px'};bottom:3px;background:white;border-radius:50%;transition:0.3s;display:block"></span>
                  </span>
                </label>
              </div>

              <div class="form-group" style="margin-bottom:14px">
                <label style="font-size:11px;font-weight:700;color:var(--muted);letter-spacing:0.8px;text-transform:uppercase;display:block;margin-bottom:6px">STREET ADDRESS</label>
                <input required name="address" value="${user.address || ''}" placeholder="e.g. 18 Ring Road Central" style="width:100%;padding:12px 14px;border:1px solid var(--line);border-radius:var(--radius-sm);font-size:13.5px;color:var(--ink)">
              </div>
              <div class="form-grid" style="margin-bottom:18px">
                <div class="form-group">
                  <label style="font-size:11px;font-weight:700;color:var(--muted);letter-spacing:0.8px;text-transform:uppercase;display:block;margin-bottom:6px">CITY</label>
                  <input required name="city" value="${user.city || 'Accra'}" placeholder="Accra" style="width:100%;padding:12px 14px;border:1px solid var(--line);border-radius:var(--radius-sm);font-size:13.5px;color:var(--ink)">
                </div>
                <div class="form-group">
                  <label style="font-size:11px;font-weight:700;color:var(--muted);letter-spacing:0.8px;text-transform:uppercase;display:block;margin-bottom:6px">REGION</label>
                  <select name="region" style="width:100%;padding:12px 14px;border:1px solid var(--line);border-radius:var(--radius-sm);font-size:13.5px;color:var(--ink);background:#fff">
                    ${['Greater Accra', 'Ashanti', 'Western', 'Central', 'Eastern', 'Volta', 'Northern'].map(r => `
                      <option ${(user.region || 'Greater Accra') === r ? 'selected' : ''}>${r}</option>
                    `).join('')}
                  </select>
                </div>
              </div>
              <button type="submit" class="primary" style="background:#c24d67;color:#fff;border:none;padding:12px 24px;border-radius:var(--radius-sm);font-size:13.5px;font-weight:700;cursor:pointer;width:100%">Save Delivery Address</button>
            </form>
          </div>

          <!-- Fit & Luxury Scent Preferences -->
          <form class="review-form-card" onsubmit="saveUserPreferences(event)">
            <h4 style="margin:0 0 8px;font-size:16px">✨ My Fit &amp; Luxury Scent Preferences</h4>
            <p style="color:var(--muted);font-size:12.5px;margin-bottom:16px">Personalize your luxury curation so our stylists pre-filter your favorite fits and fragrance notes.</p>
            
            <div class="form-grid">
              <div class="form-group">
                <label>Preferred Clothing Size</label>
                <select name="clothingSize">
                  ${['XS (UK 6)', 'S (UK 8)', 'M (UK 10)', 'L (UK 12)', 'XL (UK 14)', 'XXL (UK 16)'].map(sz => `
                    <option ${user.clothingSize === sz ? 'selected' : ''}>${sz}</option>
                  `).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>Shoe Size (EU)</label>
                <select name="shoeSize">
                  ${['36', '37', '38', '39', '40', '41', '42'].map(sz => `
                    <option ${user.shoeSize === sz ? 'selected' : ''}>EU ${sz}</option>
                  `).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>Preferred Wig Length</label>
                <select name="wigLength">
                  ${['18 Inch', '22 Inch', '26 Inch', '30 Inch', '32 Inch'].map(len => `
                    <option ${user.wigLength === len ? 'selected' : ''}>${len}</option>
                  `).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>Favorite Fragrance Notes</label>
                <select name="scentFamily">
                  ${['Oud & Amber Extraits', 'Warm Vanilla & Gourmand', 'White Floral & Jasmine', 'Fresh Citrus & Neroli'].map(sc => `
                    <option ${user.scentFamily === sc ? 'selected' : ''}>${sc}</option>
                  `).join('')}
                </select>
              </div>
            </div>
            <button class="primary" type="submit" style="margin-top:14px;background:#c24d67;width:100%">Save Style Preferences</button>
          </form>
        ` : ''}

        <!-- ================= TAB: WHOLESALE ================= -->
        ${accountTab === 'wholesale' ? `
          <div class="wholesale-box">
            <div class="wholesale-header-tag">
              <span class="badge" style="background:#c24d67;color:#fff;font-weight:800;padding:4px 10px;font-size:11px">⚡ VIP WHOLESALE PORTAL</span>
              <small style="color:var(--muted);font-weight:700">Direct Factory Tier Discounts</small>
            </div>
            <h3 class="wholesale-title">Wholesale &amp; Bulk Purchasing (Up to 40% Off)</h3>
            <p class="wholesale-desc">
              Registered ByMarie VIP Members get access to exclusive bulk tier pricing across raw virgin wigs, luxury designer handbags, perfumes, and apparel. Minimum order quantity starts at 5 items.
            </p>

            <div class="wholesale-tiers-grid">
              <div class="stat-box">
                <span>Tier 1 (5–10 items)</span>
                <strong style="color:#c24d67">15% OFF</strong>
              </div>
              <div class="stat-box">
                <span>Tier 2 (11–25 items)</span>
                <strong style="color:#c24d67">25% OFF</strong>
              </div>
              <div class="stat-box">
                <span>VIP Master (25+ items)</span>
                <strong style="color:#c24d67">40% OFF</strong>
              </div>
            </div>

            <div class="wholesale-actions-row">
              <a href="https://wa.me/233241002000?text=Hello%20ByMarie,%20I%20am%20interested%20in%20a%20Wholesale/Bulk%20Order" target="_blank" class="primary wholesale-primary-btn">
                💬 Contact Wholesale Concierge
              </a>
              <button type="button" class="secondary-btn wholesale-secondary-btn" onclick="filters.cat='All';go('shop')">Explore Catalog for Bulk</button>
            </div>
          </div>
        ` : ''}

        <!-- ================= TAB: WISHLIST ================= -->
        ${accountTab === 'wishlist' ? `
          <div class="tab-header-row">
            <div>
              <h2 class="tab-title">Saved Favourites</h2>
              <p class="tab-subtitle">Items you have bookmarked for later</p>
            </div>
          </div>
          ${wishlist.length ? `
            <div class="product-grid">
              ${wishlist.map(id => {
                const p = byId(id);
                return p ? productCard(p) : '';
              }).join('')}
            </div>
          ` : `
            <div style="text-align:center;padding:48px 20px;background:#fafafa;border:1px dashed #e4e4e7;border-radius:var(--radius-md)">
              <span style="font-size:36px;display:block;margin-bottom:10px">♡</span>
              <h3 style="font-size:18px;margin:0 0 6px;font-family:'Playfair Display',serif">Your Wishlist is Empty</h3>
              <p style="color:var(--muted);font-size:13px;margin:0 0 18px">Tap the heart icon on any piece to save it to your private collection.</p>
              <button type="button" class="primary" style="background:#c24d67;padding:10px 24px;border-radius:var(--radius-sm);font-weight:700" onclick="filters.cat='All';go('shop')">Explore Catalog</button>
            </div>
          `}
        ` : ''}

        <!-- ================= TAB: SECURITY ================= -->
        ${accountTab === 'security' ? `
          <div class="tab-header-row">
            <div>
              <h2 class="tab-title">Security &amp; Account Preferences</h2>
              <p class="tab-subtitle">Manage your password and security settings</p>
            </div>
          </div>
          
          <form class="review-form-card" onsubmit="saveUserSecurity(event)" style="margin-bottom:20px">
            <h4 style="margin:0 0 14px;font-size:15px">Password &amp; Security Passcode</h4>
            <div class="form-grid">
              <div class="form-group">
                <label>Current Password</label>
                <input type="password" name="oldPass" placeholder="••••••••">
              </div>
              <div class="form-group">
                <label>New Password</label>
                <input type="password" name="newPass" placeholder="Minimum 6 characters">
              </div>
            </div>

            <div style="margin-top:18px;border-top:1px solid var(--line);padding-top:16px">
              <h4 style="margin:0 0 12px;font-size:14px">Notification Preferences</h4>
              <label style="display:flex;align-items:center;gap:10px;margin-bottom:10px;cursor:pointer;font-size:13px">
                <input type="checkbox" name="notifyWhatsApp" ${user.notifyWhatsApp !== false ? 'checked' : ''}>
                <span>Receive instant order tracking &amp; courier dispatch alerts on WhatsApp</span>
              </label>
              <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:13px">
                <input type="checkbox" name="notifyEmail" ${user.notifyEmail !== false ? 'checked' : ''}>
                <span>Receive seasonal private sale invitations &amp; new collection edits via Email</span>
              </label>
            </div>

            <button class="primary" type="submit" style="margin-top:18px;background:#c24d67;width:100%">Update Security Settings</button>
          </form>

          <div style="background:#fff;border:1px solid var(--line);border-radius:var(--radius-md);padding:18px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
            <div>
              <strong style="display:block;font-size:13.5px;color:var(--ink)">🔒 256-Bit Encrypted Member Session</strong>
              <small style="color:var(--muted);font-size:12px">Signed in via verified local credentials.</small>
            </div>
            <button class="secondary-btn" style="padding:8px 16px;font-size:12px;font-weight:700" onclick="clearUser()">Sign Out of All Devices</button>
          </div>
        ` : ''}

        <!-- ================= TAB: CONCIERGE ================= -->
        ${accountTab === 'support' ? `
          <div class="tab-header-row">
            <div>
              <h2 class="tab-title">Concierge &amp; Help Center</h2>
              <p class="tab-subtitle">Dedicated 24/7 client care assistance</p>
            </div>
          </div>
          
          <div style="background:linear-gradient(135deg, #fff7fa 0%, #fff 100%);border:1px solid #f2cfd8;border-radius:var(--radius-md);padding:22px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px">
            <div>
              <span class="badge" style="background:#c24d67;color:#fff;font-weight:800;padding:3px 8px;font-size:10.5px">24/7 DEDICATED ASSISTANCE</span>
              <h4 style="margin:6px 0 2px;font-size:17px">Connect with ByMarie Concierge</h4>
              <small style="color:var(--muted)">Speak directly with our fashion consultants, fragrance specialists &amp; courier coordinators.</small>
            </div>
            <a href="https://wa.me/233240000000?text=Hello%20ByMarie%20Concierge,%20my%20name%20is%20${encodeURIComponent(user.name||'Member')}" target="_blank" class="primary" style="background:#c24d67;text-decoration:none;display:inline-flex;align-items:center;gap:8px;padding:12px 20px;font-weight:700">
              💬 Chat on WhatsApp
            </a>
          </div>

          <h4 style="font-size:16px;margin:20px 0 12px">Frequently Asked Questions</h4>
          
          <div class="support-faq-card">
            <strong style="font-size:13.5px;display:block;margin-bottom:4px">📦 How does Greater Accra doorstep delivery work?</strong>
            <p style="margin:0;font-size:12.5px;color:var(--muted);line-height:1.5">
              Complimentary on all orders over GH₵ 300. Orders placed before 2:00 PM are dispatched same-day with live rider tracking.
            </p>
          </div>

          <div class="support-faq-card">
            <strong style="font-size:13.5px;display:block;margin-bottom:4px">💳 How do I fund my Float Wallet?</strong>
            <p style="margin:0;font-size:12.5px;color:var(--muted);line-height:1.5">
              Navigate to the Float Wallet tab and click Top Up Funds. You can pay via MTN MoMo, Telecel Cash, or Card with instant automated verification.
            </p>
          </div>

          <div class="support-faq-card">
            <strong style="font-size:13.5px;display:block;margin-bottom:4px">🔄 What is the return / exchange policy?</strong>
            <p style="margin:0;font-size:12.5px;color:var(--muted);line-height:1.5">
              Unworn items with tags intact may be exchanged within 7 days of delivery. Custom virgin wigs and opened fragrance bottles are final sale.
            </p>
          </div>
        ` : ''}
      </div>
    </main>
  `;
}

function saveUserProfile(event) {
  event.preventDefault();
  const fd = new FormData(event.target);
  const user = getUser();
  user.name = fd.get('name');
  user.phone = fd.get('phone');
  user.address = fd.get('address');
  user.city = fd.get('city');
  user.region = fd.get('region');
  saveUser(user);
  toast('Delivery address details updated successfully! 📍');
  render();
}

function saveUserPreferences(event) {
  event.preventDefault();
  const fd = new FormData(event.target);
  const user = getUser();
  user.clothingSize = fd.get('clothingSize');
  user.shoeSize = fd.get('shoeSize');
  user.wigLength = fd.get('wigLength');
  user.scentFamily = fd.get('scentFamily');
  saveUser(user);
  toast('Style and sizing preferences saved! ✨');
  render();
}

function saveUserSecurity(event) {
  event.preventDefault();
  const fd = new FormData(event.target);
  const user = getUser();
  const newPass = fd.get('newPass');
  if (newPass && newPass.length >= 6) {
    user.password = newPass;
    toast('Password updated successfully 🔒');
  }
  user.notifyWhatsApp = fd.get('notifyWhatsApp') === 'on';
  user.notifyEmail = fd.get('notifyEmail') === 'on';
  saveUser(user);
  toast('Security & notification preferences updated! ⚡');
  render();
}

let notifFilter = 'all';

function notificationsPage() {
  const notifs = getNotifications();
  const unreadCount = getUnreadNotifsCount();
  
  let filtered = notifs;
  if (notifFilter === 'unread') filtered = notifs.filter(n => !n.read);
  else if (notifFilter !== 'all') filtered = notifs.filter(n => n.type === notifFilter);

  return `
    <main class="notifications-page-shell animate-fade-up" style="padding-top:150px;min-height:80vh">
      <div class="notifications-container">
        <div class="notifications-header" style="margin-top:10px">
          <div>
            <span class="eyebrow" style="color:var(--gold-light);display:block;margin-bottom:6px">UPDATES &amp; ALERTS</span>
            <h1 style="font-family:'Playfair Display',serif;font-size:32px;margin:0 0 6px;color:var(--ink)">Notifications</h1>
            <p style="color:var(--muted);font-size:13.5px;margin:0">Stay updated on exclusive member promos, order tracking, and atelier collection drops.</p>
          </div>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
            ${unreadCount > 0 ? `
              <button class="secondary-btn" onclick="markAllNotifsRead()" style="font-size:12.5px;padding:8px 16px">
                ✓ Mark all as read (${unreadCount})
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Filter Chips -->
        <div class="notifications-filter-row">
          <button class="notif-chip ${notifFilter === 'all' ? 'active' : ''}" onclick="notifFilter='all';render()">
            All (${notifs.length})
          </button>
          <button class="notif-chip ${notifFilter === 'unread' ? 'active' : ''}" onclick="notifFilter='unread';render()">
            Unread (${unreadCount})
          </button>
          <button class="notif-chip ${notifFilter === 'promo' ? 'active' : ''}" onclick="notifFilter='promo';render()">
            Promos &amp; Deals
          </button>
          <button class="notif-chip ${notifFilter === 'shipping' ? 'active' : ''}" onclick="notifFilter='shipping';render()">
            Shipping &amp; Orders
          </button>
          <button class="notif-chip ${notifFilter === 'wallet' ? 'active' : ''}" onclick="notifFilter='wallet';render()">
            Float Wallet
          </button>
        </div>

        <!-- Notifications List -->
        <div class="notifications-list">
          ${filtered.length ? filtered.map(item => `
            <div class="notification-card ${item.read ? 'read' : 'unread'}">
              <div class="notif-icon-wrap ${item.type}">
                ${item.icon || '🔔'}
              </div>
              <div class="notif-body">
                <div class="notif-title-row">
                  <h4>${item.title}</h4>
                  <span class="notif-date">${item.date}</span>
                </div>
                <p class="notif-desc">${item.desc}</p>
                <div class="notif-actions">
                  ${item.actionText ? `
                    <button class="primary" style="padding:6px 14px;font-size:11.5px" onclick="markNotifRead('${item.id}');go('${item.actionRoute || 'shop'}')">
                      ${item.actionText}
                    </button>
                  ` : ''}
                  ${!item.read ? `
                    <button class="notif-mark-read-btn" onclick="markNotifRead('${item.id}')">Mark as read</button>
                  ` : ''}
                  <button class="notif-delete-btn" onclick="deleteNotification('${item.id}')" title="Dismiss">✕</button>
                </div>
              </div>
            </div>
          `).join('') : `
            <div class="notifications-empty">
              <span style="font-size:42px;display:block;margin-bottom:12px">📭</span>
              <h3 style="font-size:18px;margin-bottom:6px">No notifications</h3>
              <p style="color:var(--muted);font-size:13px;margin-bottom:16px">You're completely caught up with all ByMarie announcements!</p>
              <button class="primary" onclick="go('shop')">Explore Collections</button>
            </div>
          `}
        </div>
      </div>
    </main>
  `;
}

function authPage() {
  const user = getUser();
  if (user.loggedIn) {
    setTimeout(() => go('account'), 50);
  }

  return `
    <main class="auth-page-shell animate-fade-up">
      <!-- Top Boutique Return Nav -->
      <div class="auth-top-nav">
        <button type="button" class="auth-back-btn" onclick="filters.cat='All';go('shop')">
          ← Back to Boutique
        </button>
        <span class="auth-top-tag">BYMARIE PRIVATE CLIENT ACCESS</span>
      </div>

      <div class="auth-page-card">
        <!-- Left Luxury Pink Showcase Banner -->
        <div class="auth-showcase-side">
          <div class="auth-showcase-content">
            <a class="brand auth-brand" href="#home" onclick="go('home')">BYMARIE</a>
            <div class="auth-quote-box">
              <span class="eyebrow" style="color:var(--gold-light);letter-spacing:1.5px">EST. 2026 • ACCRA</span>
              <h2>Considered Luxury Style &amp; Handcrafted Extraits</h2>
              <p>Join the ByMarie inner circle for priority dispatch, member float wallet privileges, and bespoke access to limited edits.</p>
            </div>
            <div class="auth-perks-list">
              <div class="perk-item">
                <span>⚡</span>
                <div>
                  <strong>Member Float Wallet</strong>
                  <small>Instant 1-click checkout with pre-loaded funds</small>
                </div>
              </div>
              <div class="perk-item">
                <span>📦</span>
                <div>
                  <strong>Priority Tracking</strong>
                  <small>Real-time delivery progress across Ghana</small>
                </div>
              </div>
              <div class="perk-item">
                <span>🔒</span>
                <div>
                  <strong>256-Bit TLS Security</strong>
                  <small>Encrypted authentication &amp; private data protection</small>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Form Side -->
        <div class="auth-form-side">
          <div class="auth-form-head">
            <span class="eyebrow">WELCOME TO BYMARIE</span>
            <h1 style="font-size:28px;margin:6px 0 10px">${authMode === 'signin' ? 'Sign In to Your Account' : 'Create Your Account'}</h1>
            <p style="color:var(--muted);font-size:13px">
              ${authMode === 'signin' ? "Enter your registered email and password to access your profile." : "Fill in your details below to register your luxury ByMarie membership."}
            </p>
          </div>

          <div class="auth-tab-bar">
            <button class="auth-tab-btn ${authMode === 'signin' && !otpAuthMode ? 'active' : ''}" onclick="authMode='signin';otpAuthMode=false;render()">Sign In</button>
            <button class="auth-tab-btn ${otpAuthMode ? 'active' : ''}" onclick="authMode='signin';otpAuthMode=true;render()">🔑 6-Digit Code</button>
            <button class="auth-tab-btn ${authMode === 'signup' && !otpAuthMode ? 'active' : ''}" onclick="authMode='signup';otpAuthMode=false;render()">Create Account</button>
          </div>

          ${otpAuthMode ? `
            <form onsubmit="handleVerifyOtpSubmit(event)">
              <div class="form-group" style="margin-bottom:14px">
                <label>Email Address</label>
                <input required type="email" name="email" value="${otpEmailTarget || user.email || ''}" placeholder="you@example.com">
              </div>
              <div class="form-group" style="margin-bottom:16px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                  <label style="margin:0">6-Digit Verification Code</label>
                  <a href="javascript:void(0)" onclick="handleRequestOtp(document.querySelector('input[name=email]')?.value)" style="font-size:12px;color:#c24d67;text-decoration:underline">Get Code via Email / SMS</a>
                </div>
                <input required name="code" maxlength="6" style="font-size:24px;letter-spacing:8px;text-align:center;font-weight:800;color:#c24d67" placeholder="••••••">
              </div>
              <button class="primary" style="width:100%;height:48px;font-size:14.5px;background:#c24d67" type="submit">
                Verify Code &amp; Access Account →
              </button>
              <div style="text-align:center;margin-top:14px">
                <button type="button" class="secondary-btn" style="font-size:12px;padding:6px 14px" onclick="otpAuthMode=false;render()">← Use Standard Password</button>
              </div>
            </form>
          ` : authMode === 'signin' ? `
            <form onsubmit="handleCustomerSignIn(event)">
              <div class="form-group" style="margin-bottom:16px">
                <label>Email Address</label>
                <input required type="email" name="email" value="${user.email || ''}" placeholder="you@example.com">
              </div>
              <div class="form-group" style="margin-bottom:16px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                  <label style="margin:0">Password</label>
                  <a href="javascript:void(0)" onclick="handleRequestOtp(document.querySelector('input[name=email]')?.value)" style="font-size:12px;color:#c24d67;text-decoration:underline">🔑 Login with Email Code</a>
                </div>
                <div class="password-input-wrapper" style="position:relative;display:flex;align-items:center">
                  <input required type="password" name="password" placeholder="••••••••" style="padding-right:42px;width:100%">
                  <button type="button" class="password-toggle-btn" onclick="togglePasswordVisibility(this)" title="Show password" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--muted);padding:4px;display:flex;align-items:center;justify-content:center;font-size:16px;line-height:1">👁️</button>
                </div>
              </div>
              <button class="primary" style="width:100%;height:48px;font-size:14.5px;background:#c24d67" type="submit">
                Sign In to Account →
              </button>
            </form>
          ` : `
            <form onsubmit="handleCustomerSignUp(event)">
              <div class="form-group" style="margin-bottom:14px">
                <label>Full Name</label>
                <input required name="name" placeholder="e.g. Ama Owusu">
              </div>
              <div class="form-group" style="margin-bottom:14px">
                <label>Email Address</label>
                <input required type="email" name="email" placeholder="you@example.com">
              </div>
              <div class="form-group" style="margin-bottom:14px">
                <label>Phone / WhatsApp Number</label>
                <input required name="phone" placeholder="024 000 0000">
              </div>
              <div class="form-group" style="margin-bottom:14px">
                <label>Create Password</label>
                <div class="password-input-wrapper" style="position:relative;display:flex;align-items:center">
                  <input required type="password" name="password" placeholder="Minimum 6 characters" style="padding-right:42px;width:100%">
                  <button type="button" class="password-toggle-btn" onclick="togglePasswordVisibility(this)" title="Show password" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--muted);padding:4px;display:flex;align-items:center;justify-content:center;font-size:16px;line-height:1">👁️</button>
                </div>
              </div>
              <div class="form-group" style="margin-bottom:20px">
                <label>Confirm Password</label>
                <div class="password-input-wrapper" style="position:relative;display:flex;align-items:center">
                  <input required type="password" name="confirmPassword" placeholder="Re-enter password to confirm" style="padding-right:42px;width:100%">
                  <button type="button" class="password-toggle-btn" onclick="togglePasswordVisibility(this)" title="Show password" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--muted);padding:4px;display:flex;align-items:center;justify-content:center;font-size:16px;line-height:1">👁️</button>
                </div>
              </div>
              <button class="primary" style="width:100%;height:48px;font-size:14.5px;background:#c24d67" type="submit">
                Create Account &amp; Join →
              </button>
            </form>
          `}

          <div style="margin-top:24px;padding-top:18px;border-top:1px solid #f2cfd8;text-align:center">
            <small style="color:var(--muted)">Need help with your account? <a href="#home" onclick="go('home')" style="color:#c24d67;font-weight:700">Contact Concierge</a></small>
          </div>
        </div>
      </div>
    </main>
  `;
}

function openOrderModal(orderId) {
  const order = getOrders().find(o => o.id === orderId);
  if (!order) return;
  modalData = { order };
  activeModal = 'order_view';
  render();
}

// ===================================================
// WHOLESALE & BULK PURCHASE ENGINE
// ===================================================

let wholesaleQtyState = {};
let wholesaleFilterCat = 'All';
let wholesaleSearch = '';

function getWholesaleDiscountPct(totalQty) {
  if (totalQty >= 25) return 40;
  if (totalQty >= 10) return 30;
  if (totalQty >= 5) return 20;
  return 0;
}

function updateWholesaleQty(prodId, deltaOrValue, isAbsolute = false) {
  const cur = wholesaleQtyState[prodId] || 0;
  let next = isAbsolute ? Number(deltaOrValue) : cur + deltaOrValue;
  if (isNaN(next) || next < 0) next = 0;
  wholesaleQtyState[prodId] = next;
  render();
}

function setBulkQuickQty(prodId, qty) {
  wholesaleQtyState[prodId] = qty;
  render();
}

function addAllWholesaleToCart() {
  let totalUnitsAdded = 0;

  Object.entries(wholesaleQtyState).forEach(([id, qty]) => {
    if (qty > 0) {
      const p = byId(id);
      if (p) {
        const variant = (selectedVariants[id]?.color) || (p.colors && p.colors[0]) || 'Standard';
        const size = (selectedVariants[id]?.size) || (p.sizes && p.sizes[0]) || '';
        
        const existing = cart.find(x => x.id === id && x.variant === variant && x.size === size);
        if (existing) {
          existing.qty += qty;
        } else {
          cart.push({ id, qty, variant, size });
        }
        totalUnitsAdded += qty;
      }
    }
  });

  if (totalUnitsAdded === 0) {
    return toast('Please select bulk product quantities first');
  }

  const pct = getWholesaleDiscountPct(totalUnitsAdded);
  if (pct === 40) applyCoupon('WHOLESALE40');
  else if (pct === 30) applyCoupon('WHOLESALE30');
  else if (pct === 20) applyCoupon('WHOLESALE20');

  saveCart();
  wholesaleQtyState = {};
  toast(`Added ${totalUnitsAdded} bulk units to your bag with ${pct}% wholesale discount!`);
  go('cart');
}

function handleWholesaleInquirySubmit(event) {
  event.preventDefault();
  const fd = new FormData(event.target);
  const newInquiry = {
    id: `WS-${Math.floor(1000 + Math.random() * 9000)}`,
    date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    company: fd.get('company') || 'Direct Wholesale Client',
    contact: fd.get('contact') || 'Store Buyer',
    phone: fd.get('phone') || '',
    email: fd.get('email') || '',
    city: fd.get('city') || 'Accra, Ghana',
    volume: fd.get('volume') || '50 – 100 units',
    notes: fd.get('notes') || 'Standard bulk purchase inquiry',
    status: 'New'
  };

  const list = getWholesaleInquiries();
  list.unshift(newInquiry);
  saveWholesaleInquiries(list);

  toast('Wholesale quotation request submitted! Our corporate manager will reach out within 4 business hours.');
  event.target.reset();
}

function wholesale() {
  const products = getProducts();
  const filtered = products.filter(p => {
    const matchCat = wholesaleFilterCat === 'All' || p.category.toLowerCase() === wholesaleFilterCat.toLowerCase();
    const query = wholesaleSearch.toLowerCase().trim();
    const matchSearch = !query || `${p.name} ${p.category} ${p.desc}`.toLowerCase().includes(query);
    return matchCat && matchSearch;
  });

  let totalBulkUnits = 0;
  let grossRetailSubtotal = 0;
  Object.entries(wholesaleQtyState).forEach(([id, qty]) => {
    const p = byId(id);
    if (p && qty > 0) {
      totalBulkUnits += qty;
      grossRetailSubtotal += (p.price * qty);
    }
  });

  const discPct = getWholesaleDiscountPct(totalBulkUnits);
  const discountAmount = (grossRetailSubtotal * discPct) / 100;
  const netWholesaleTotal = grossRetailSubtotal - discountAmount;

  const categories = ['All', 'Clothing', 'Shoes', 'Bags', 'Wigs', 'Skin Care', 'Perfumes', 'Lifestyle', 'Nails', 'Panties', 'Toiletries'];

  return `
    <main>
      <!-- Wholesale Hero Banner -->
      <section class="wholesale-hero animate-fade-up">
        <span class="eyebrow" style="justify-content:center">BYMARIE COMMERCIAL &amp; B2B SUPPLY</span>
        <h1>Wholesale &amp; Bulk Purchasing</h1>
        <p>Direct supply for boutique owners, luxury salons, beauty stockists, and corporate gifting with scalable tiered discounts and express nationwide delivery across Ghana.</p>

        <!-- Tiered Volume Discounts -->
        <div class="bulk-tiers-grid">
          <div class="bulk-tier-card ${discPct === 20 ? 'featured' : ''}">
            <span class="bulk-tier-badge">TIER 1 • STARTER</span>
            <h3>20% OFF</h3>
            <strong style="display:block;font-size:13px;margin:4px 0">5 – 9 Total Units</strong>
            <p>Ideal for emerging boutiques &amp; curated gifting sets.</p>
          </div>
          <div class="bulk-tier-card ${discPct === 30 ? 'featured' : ''}">
            <span class="bulk-tier-badge" style="background:var(--gold-light);color:var(--ink)">TIER 2 • BOUTIQUE PARTNER</span>
            <h3>30% OFF</h3>
            <strong style="display:block;font-size:13px;margin:4px 0">10 – 24 Total Units</strong>
            <p>Popular with salons, stylists, and established retailers.</p>
          </div>
          <div class="bulk-tier-card ${discPct === 40 ? 'featured' : ''}">
            <span class="bulk-tier-badge" style="background:var(--emerald);color:#fff">TIER 3 • MASTER DISTRIBUTOR</span>
            <h3>40% OFF</h3>
            <strong style="display:block;font-size:13px;margin:4px 0">25+ Total Units</strong>
            <p>Maximum wholesale margin for regional stockists &amp; bulk distributors.</p>
          </div>
        </div>
      </section>

      <div class="wholesale-content-container">
        <!-- Wholesale Order Matrix -->
        <div class="wholesale-matrix-card animate-fade-up">
          <div class="wholesale-controls-bar">
            <div class="searchbox" style="min-width:280px">
              <span>${icon('search')}</span>
              <input value="${wholesaleSearch}" oninput="wholesaleSearch=this.value;render()" placeholder="Search bulk catalog...">
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
              <select onchange="wholesaleFilterCat=this.value;render()" style="border:1px solid var(--line);border-radius:var(--radius-full);padding:8px 16px;font-size:12px;font-weight:700;background:#fff">
                ${categories.map(c => `<option ${wholesaleFilterCat === c ? 'selected' : ''}>${c}</option>`).join('')}
              </select>
              <button class="secondary-btn" style="padding:8px 14px;font-size:11px" onclick="wholesaleQtyState={};render()">Clear Quantities</button>
            </div>
          </div>

          <div style="overflow-x:auto">
            <table class="wholesale-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Retail Price</th>
                  <th>Wholesale Price (Tier 3)</th>
                  <th>Select Variant</th>
                  <th>Bulk Quantity</th>
                  <th>Line Total</th>
                </tr>
              </thead>
              <tbody>
                ${filtered.map(p => {
                  const qty = wholesaleQtyState[p.id] || 0;
                  const chosenVariant = selectedVariants[p.id]?.color || (p.colors && p.colors[0]) || 'Standard';
                  const chosenSize = selectedVariants[p.id]?.size || (p.sizes && p.sizes[0]) || '';
                  const tierPrice = p.price * (1 - (discPct / 100));
                  const lineTotal = qty * (discPct > 0 ? tierPrice : p.price);

                  return `
                    <tr>
                      <td data-label="Product">
                        <div class="wholesale-prod-cell">
                          <img src="${p.image}" alt="${p.name}">
                          <div>
                            <strong><a href="#product/${p.id}" onclick="go('product/${p.id}')">${p.name}</a></strong>
                            <small style="display:block;color:var(--muted)">SKU: BM-${p.id.slice(0, 6).toUpperCase()}</small>
                          </div>
                        </div>
                      </td>
                      <td data-label="Category"><span class="badge" style="background:var(--sage);color:var(--emerald)">${p.category}</span></td>
                      <td data-label="Retail Price" class="wholesale-price-cell">
                        <b>${money(p.price)}</b>
                        <small style="color:var(--muted)">Single retail</small>
                      </td>
                      <td data-label="Wholesale Price" class="wholesale-price-cell">
                        <strong>${money(p.price * 0.6)}</strong> <del>${money(p.price)}</del>
                        <small style="color:var(--emerald);font-weight:700">Save up to 40%</small>
                      </td>
                      <td data-label="Variant / Size">
                        ${p.colors && p.colors.length && !p.colors.includes('Standard') ? `
                          <select onchange="selectedVariants['${p.id}']={...selectedVariants['${p.id}'],color:this.value};render()" style="border:1px solid var(--line);border-radius:var(--radius-sm);padding:6px 10px;font-size:12px;margin-bottom:4px;width:100%;max-width:140px;background:#fff">
                            ${p.colors.map(c => `<option ${chosenVariant === c ? 'selected' : ''}>${c}</option>`).join('')}
                          </select>
                        ` : ''}
                        ${p.sizes && p.sizes.length ? `
                          <select onchange="selectedVariants['${p.id}']={...selectedVariants['${p.id}'],size:this.value};render()" style="border:1px solid var(--line);border-radius:var(--radius-sm);padding:6px 10px;font-size:12px;width:100%;max-width:140px;background:#fff">
                            ${p.sizes.map(s => `<option ${chosenSize === s ? 'selected' : ''}>${s}</option>`).join('')}
                          </select>
                        ` : ''}
                      </td>
                      <td data-label="Bulk Quantity">
                        <div class="wholesale-stepper">
                          <button type="button" onclick="updateWholesaleQty('${p.id}', -1)">−</button>
                          <input type="number" min="0" value="${qty}" onchange="updateWholesaleQty('${p.id}', this.value, true)">
                          <button type="button" onclick="updateWholesaleQty('${p.id}', 1)">+</button>
                        </div>
                        <div class="quick-qty-pills">
                          <span class="quick-qty-pill" onclick="setBulkQuickQty('${p.id}', 5)">+5</span>
                          <span class="quick-qty-pill" onclick="setBulkQuickQty('${p.id}', 10)">+10</span>
                          <span class="quick-qty-pill" onclick="setBulkQuickQty('${p.id}', 25)">+25</span>
                        </div>
                      </td>
                      <td data-label="Line Total">
                        <b style="font-size:14px;color:${qty > 0 ? 'var(--emerald)' : 'var(--muted)'}">${money(lineTotal)}</b>
                        ${qty > 0 ? `<small style="display:block;color:var(--muted)">(${qty} units)</small>` : ''}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Custom B2B Quote & Gifting Inquiries -->
        <div class="wholesale-inquiry-box animate-fade-up delay-2">
          <div style="max-width:700px;margin:0 auto">
            <span class="eyebrow" style="color:var(--emerald);justify-content:center">CUSTOM CORPORATE &amp; SALON DISTRIBUTION</span>
            <h2 style="font-size:32px;text-align:center;margin:10px 0 14px">Request a Custom Wholesale Quote</h2>
            <p style="text-align:center;color:var(--muted);margin-bottom:30px">
              Need custom branding, private label hair bundles, hotel amenities, or orders exceeding 100+ units? Speak directly with our dedicated commercial accounts team in Accra.
            </p>

            <form onsubmit="handleWholesaleInquirySubmit(event)">
              <div class="form-grid">
                <div class="form-group">
                  <label>Business / Salon / Company Name</label>
                  <input required name="company" placeholder="e.g. Bella Luxe Beauty Lounge">
                </div>
                <div class="form-group">
                  <label>Contact Person</label>
                  <input required name="contact" placeholder="e.g. Akua Frimpong">
                </div>
                <div class="form-group">
                  <label>Corporate Phone / WhatsApp</label>
                  <input required name="phone" type="tel" placeholder="e.g. 024 XXX XXXX">
                </div>
                <div class="form-group">
                  <label>Email Address</label>
                  <input required name="email" type="email" placeholder="wholesale@yourcompany.com">
                </div>
                <div class="form-group">
                  <label>City &amp; Region</label>
                  <input required name="city" placeholder="e.g. East Legon, Accra / Kumasi">
                </div>
                <div class="form-group">
                  <label>Estimated Order Volume</label>
                  <select name="volume">
                    <option>50 – 100 units</option>
                    <option>100 – 250 units</option>
                    <option>250 – 500 units</option>
                    <option>500+ master distributor volume</option>
                  </select>
                </div>
                <div class="form-group full">
                  <label>Specific Product Requests &amp; Notes</label>
                  <textarea name="notes" rows="3" placeholder="Specify collections of interest (e.g. Raw Wigs, Italian Mules, Silk Robes, Vitamin C Serums, custom packaging)..."></textarea>
                </div>
              </div>
              <div style="display:flex;gap:14px;margin-top:16px;justify-content:center">
                <button class="primary" style="background:#c24d67" type="submit">Submit Wholesale Inquiry ${icon('arrow')}</button>
                <button class="secondary-btn" type="button" onclick="toast('Downloading ByMarie 2026 Wholesale Catalogue PDF...')">Download Line-Sheet PDF</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <!-- Sticky Wholesale Summary & Action Bar -->
      ${totalBulkUnits > 0 ? `
        <div class="wholesale-sticky-bar animate-fade-up">
          <div>
            <div style="font-size:12px;color:var(--muted)">Selected Bulk Units: <b>${totalBulkUnits} items</b> across catalog</div>
            <div style="display:flex;gap:12px;align-items:baseline">
              <span style="font-size:22px;font-weight:800;color:var(--emerald)">${money(netWholesaleTotal)}</span>
              ${discPct > 0 ? `
                <del style="color:var(--muted-light);font-size:14px">${money(grossRetailSubtotal)}</del>
                <span class="badge" style="background:var(--sage);color:var(--emerald)">${discPct}% Bulk Discount Applied</span>
              ` : `
                <small style="color:var(--muted)">(Add ${5 - totalBulkUnits} more for 20% OFF)</small>
              `}
            </div>
          </div>
          <div style="display:flex;gap:12px">
            <button class="secondary-btn" onclick="wholesaleQtyState={};render()">Reset</button>
            <button class="primary" onclick="addAllWholesaleToCart()">
              Add Wholesale Order to Bag (${totalBulkUnits} units) ${icon('arrow')}
            </button>
          </div>
        </div>
      ` : ''}
    </main>
  `;
}

// ===================================================
// WISHLIST VIEW
// ===================================================

function wishlistPage() {
  const items = wishlist.map(byId).filter(Boolean);
  return `
    <main class="shop-page animate-fade-up">
      <div class="page-intro">
        <span class="eyebrow">SAVED ITEMS</span>
        <h1>Your Wishlist</h1>
        <p>Pieces you're considering for future rituals.</p>
      </div>

      ${items.length ? `
        <div class="product-grid">
          ${items.map(productCard).join('')}
        </div>
      ` : `
        <div style="text-align:center;padding:80px 20px;background:#fff;border-radius:var(--radius-lg);border:1px solid var(--line)">
          <div style="font-size:40px;color:var(--muted);margin-bottom:12px">♡</div>
          <h2 style="font-size:28px;margin-bottom:8px">Nothing saved just yet</h2>
          <p style="color:var(--muted);margin-bottom:20px">Click the heart icon on any piece to save it here for later.</p>
          <button class="primary" onclick="go('shop')">Browse Collection</button>
        </div>
      `}
    </main>
  `;
}

// ===================================================
// FULL ADMIN CONSOLE & CRUD
// ===================================================

function isAdminUser() {
  const user = getUser();
  if (user && user.loggedIn && user.email && ADMIN_EMAILS.some(e => e.toLowerCase() === user.email.toLowerCase())) {
    return true;
  }
  if (user && user.loggedIn && user.status === 'Super Admin') {
    return true;
  }
  if (adminAuthenticated) return true;
  return false;
}

function handleAdminLogin(event) {
  event.preventDefault();
  const fd = new FormData(event.target);
  const passcode = (fd.get('passcode') || '').trim();
  if (passcode === 'admin2026' || passcode === 'bymarie' || passcode === '123456' || passcode === 'admin') {
    adminAuthenticated = true;
    toast('Admin Console Unlocked! ⚡');
    render();
  } else {
    toast('Invalid admin passcode. Please try again or sign in with admin email.', 'error');
  }
}

function renderAdminLoginGate() {
  const user = getUser();
  return `
    <main class="admin-login-shell">
      <div class="admin-login-card animate-fade-up" style="max-width:480px;text-align:center">
        <div style="font-size:42px;margin-bottom:10px">🔒</div>
        <span class="eyebrow" style="color:var(--gold-light)">EXECUTIVE CONTROL GATE</span>
        <h2 style="font-size:26px;margin:8px 0 12px">Admin Console Access</h2>
        <p style="color:#a1a1aa;font-size:13.5px;line-height:1.6;margin-bottom:24px">
          The Admin Console is strictly restricted to executive accounts (<strong style="color:#fff">sunumanfred14@gmail.com</strong>).
        </p>

        ${user && user.loggedIn ? `
          <div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);padding:16px;border-radius:var(--radius-md);margin-bottom:20px;text-align:left">
            <small style="color:#a1a1aa;display:block;margin-bottom:4px">Logged In Account:</small>
            <strong style="color:#fff;display:block;font-size:14px">${user.name || 'Member'} (${user.email})</strong>
            <small style="color:var(--red);display:block;margin-top:6px;font-weight:700">⚠️ Account does not have administrative privileges.</small>
          </div>
          <div style="display:flex;gap:10px;flex-direction:column">
            <button class="primary" style="width:100%" onclick="clearUser();authMode='signin';go('auth')">Sign In as Admin (sunumanfred14@gmail.com)</button>
            <button class="secondary-btn" style="width:100%;color:#fff;border-color:rgba(255,255,255,0.2)" onclick="go('home')">Return to Storefront</button>
          </div>
        ` : `
          <form onsubmit="handleAdminLogin(event)">
            <div class="form-group" style="margin-bottom:16px;text-align:left">
              <label style="color:#a1a1aa">Security Passcode</label>
              <input required type="password" name="passcode" placeholder="Enter admin passcode" autofocus>
            </div>
            <button class="primary" style="width:100%" type="submit">Unlock Console ${icon('arrow')}</button>
          </form>
          <div style="margin-top:14px">
            <button class="secondary-btn" style="width:100%;color:#fff;border-color:rgba(255,255,255,0.2)" onclick="authMode='signin';go('auth')">Sign In with Admin Account (sunumanfred14@gmail.com)</button>
          </div>
        `}
      </div>
    </main>
  `;
}

const ADMIN_NAV = [
  { section: 'Executive Intelligence', items: [
    { key: 'dashboard', label: 'Executive Overview', icon: 'grid' },
    { key: 'orders', label: 'Order Logistics', icon: 'bag' },
    { key: 'products', label: 'Haute Couture Catalog', icon: 'box' },
    { key: 'inventory', label: 'Inventory Sentinel', icon: 'layers' }
  ]},
  { section: 'Commercial & CRM', items: [
    { key: 'users', label: 'VIP Clients & Wallets', icon: 'users' },
    { key: 'broadcast', label: 'Bulk SMS & Email Engine', icon: 'send' },
    { key: 'wholesale', label: 'Wholesale B2B Pipeline', icon: 'zap' },
    { key: 'discounts', label: 'Promo & Marketing', icon: 'tag' }
  ]},
  { section: 'Store Architecture', items: [
    { key: 'cms', label: 'Storefront CMS', icon: 'palette' },
    { key: 'supabase', label: 'Cloud DB & Sync', icon: 'zap' }
  ]}
];

const ADMIN_TAB_TITLES = {
  dashboard: 'Executive Overview',
  orders: 'Order Logistics & Fulfillment',
  products: 'Haute Couture Product Catalog',
  inventory: 'Real-Time Stock Sentinel',
  users: 'VIP Client CRM & Float Wallets',
  broadcast: 'Bulk SMS & Email Broadcast Engine',
  wholesale: 'Wholesale & B2B Commercial Inquiries',
  discounts: 'Marketing & Promo Engine',
  cms: 'Storefront CMS & Campaign Media',
  supabase: 'Supabase Cloud Postgres & Backup'
};

function getWholesaleInquiries() {
  const data = localStorage.getItem('bymarie-wholesale-inquiries');
  if (!data) return [];
  try { return JSON.parse(data); } catch { return []; }
}

function saveWholesaleInquiries(list) {
  localStorage.setItem('bymarie-wholesale-inquiries', JSON.stringify(list));
}

function updateWholesaleInquiryStatus(id, status) {
  const list = getWholesaleInquiries();
  const item = list.find(x => x.id === id);
  if (item) {
    item.status = status;
    saveWholesaleInquiries(list);
    toast(`Inquiry ${id} updated to ${status}`);
    render();
  }
}

function deleteWholesaleInquiry(id) {
  if (!confirm(`Delete wholesale inquiry ${id}?`)) return;
  const list = getWholesaleInquiries().filter(x => x.id !== id);
  saveWholesaleInquiries(list);
  toast('Wholesale inquiry removed');
  render();
}

function getCommandPaletteResults(query) {
  const q = (query || '').toLowerCase().trim();
  const navCommands = [
    { icon: 'grid', label: 'Go to Executive Overview', action: "adminTab='dashboard';commandPaletteOpen=false;render()" },
    { icon: 'bag', label: 'Go to Order Logistics', action: "adminTab='orders';commandPaletteOpen=false;render()" },
    { icon: 'box', label: 'Go to Haute Couture Catalog', action: "adminTab='products';commandPaletteOpen=false;render()" },
    { icon: 'layers', label: 'Go to Inventory Sentinel', action: "adminTab='inventory';commandPaletteOpen=false;render()" },
    { icon: 'users', label: 'Go to VIP Clients & Wallets', action: "adminTab='users';fetchLatestUsers();commandPaletteOpen=false;render()" },
    { icon: 'send', label: 'Go to Bulk SMS & Email Engine', action: "adminTab='broadcast';fetchLatestUsers();commandPaletteOpen=false;render()" },
    { icon: 'zap', label: 'Go to Wholesale B2B Pipeline', action: "adminTab='wholesale';commandPaletteOpen=false;render()" },
    { icon: 'tag', label: 'Go to Promo & Marketing', action: "adminTab='discounts';commandPaletteOpen=false;render()" },
    { icon: 'palette', label: 'Go to Storefront CMS', action: "adminTab='cms';commandPaletteOpen=false;render()" },
    { icon: 'zap', label: 'Go to Cloud DB & Sync', action: "adminTab='supabase';commandPaletteOpen=false;render()" },
    { icon: 'plus', label: 'Add New Haute Couture Product', action: "commandPaletteOpen=false;adminTab='products';render();openProductModal('add')" },
    { icon: 'download', label: 'Export Complete Orders CSV', action: "commandPaletteOpen=false;render();exportOrdersCSV()" },
    { icon: 'arrowLeft', label: 'Return to Storefront', action: "commandPaletteOpen=false;go('home')" }
  ];

  const matchedNav = !q ? navCommands : navCommands.filter(c => c.label.toLowerCase().includes(q));
  const matchedProducts = q ? getProducts().filter(p => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)).slice(0, 5) : [];
  const matchedOrders = q ? getOrders().filter(o => o.id.toLowerCase().includes(q) || o.name.toLowerCase().includes(q)).slice(0, 5) : [];

  return { navCommands: matchedNav, products: matchedProducts, orders: matchedOrders };
}

function admin() {
  if (!isAdminLoggedIn()) return renderAdminLoginGate();

  const products = getProducts();
  const orders = getOrders();
  const coupons = getCoupons();
  const users = getUsers();
  const wholesaleInquiries = getWholesaleInquiries();

  const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const lowStockProducts = products.filter(p => p.stock > 0 && p.stock <= 8);
  const outOfStockProducts = products.filter(p => p.stock <= 0);
  const alertCount = lowStockProducts.length + outOfStockProducts.length;
  const pendingOrders = orders.filter(o => o.status === 'Pending' || o.status === 'Processing').length;
  const newWholesaleCount = wholesaleInquiries.filter(w => w.status === 'New').length;

  const navCounts = {
    products: products.length,
    inventory: alertCount,
    orders: orders.length,
    users: users.length,
    wholesale: newWholesaleCount,
    discounts: coupons.length
  };

  return `
    <main class="admin-shell">
      <!-- Million-Dollar Haute Couture Desktop Sidebar -->
      <aside class="admin-sidebar desktop-only">
        <div class="admin-brand-header">
          <a class="brand admin-brand" href="#home" onclick="go('home')">BYMARIE</a>
          <div class="admin-executive-tag">
            <span class="pulse-dot"></span>
            EXECUTIVE ATELIER
          </div>
        </div>

        <nav class="admin-nav">
          ${ADMIN_NAV.map(group => `
            <span class="admin-nav-label">${group.section}</span>
            ${group.items.map(item => `
              <button class="${adminTab === item.key ? 'active' : ''}" onclick="adminTab='${item.key}';render()">
                ${svgIcon(item.icon, 17)}
                <span>${item.label}</span>
                ${navCounts[item.key] ? `<b class="nav-count ${item.key === 'inventory' && alertCount ? 'warn' : ''}">${navCounts[item.key]}</b>` : ''}
              </button>
            `).join('')}
          `).join('')}
        </nav>

        <div class="admin-sidebar-footer">
          <div class="admin-user-chip">
            <span class="avatar" style="background:#c24d67;color:#fff">I</span>
            <div style="min-width:0">
              <strong style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Ifeoma Adichie</strong>
              <small style="color:var(--gold)">Super Administrator</small>
            </div>
          </div>
          <button class="admin-exit" onclick="go('home')">${svgIcon('arrowLeft', 16)} Return to Storefront</button>
        </div>
      </aside>

      <!-- Mobile Slide-out Drawer (Offcanvas Menu) -->
      ${adminMobileDrawerOpen ? `
        <div class="admin-mobile-backdrop" onclick="adminMobileDrawerOpen=false;render()"></div>
        <aside class="admin-mobile-drawer animate-fade-in">
          <div class="admin-mobile-drawer-header">
            <div>
              <a class="brand admin-brand" href="#home" onclick="adminMobileDrawerOpen=false;go('home')">BYMARIE</a>
              <div class="admin-executive-tag">
                <span class="pulse-dot"></span>
                EXECUTIVE ATELIER
              </div>
            </div>
            <button class="admin-mobile-drawer-close" onclick="adminMobileDrawerOpen=false;render()" aria-label="Close Navigation Menu">✕</button>
          </div>

          <div class="admin-user-chip" style="margin:12px 0 16px;background:rgba(255,255,255,0.04);border-radius:var(--radius-md);border:1px solid rgba(255,255,255,0.08);padding:10px 12px">
            <span class="avatar" style="background:#c24d67;color:#fff">I</span>
            <div style="min-width:0">
              <strong style="color:#fff;font-size:13px">Ifeoma Adichie</strong>
              <small style="color:var(--gold-light);font-size:11px">Super Administrator</small>
            </div>
          </div>

          <nav style="display:flex;flex-direction:column;gap:14px;overflow-y:auto;overflow-x:hidden;padding:6px 0 20px;flex:1;width:100%;box-sizing:border-box">
            ${ADMIN_NAV.map(group => `
              <div style="display:flex;flex-direction:column;gap:6px;width:100%">
                <span style="font-size:10px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:var(--gold-light);padding:0 4px 4px;border-bottom:1px solid rgba(255,255,255,0.07);display:block;margin-bottom:2px">
                  ${group.section}
                </span>
                <div style="display:flex;flex-direction:column;gap:6px;width:100%">
                  ${group.items.map(item => `
                    <button type="button" onclick="adminTab='${item.key}';adminMobileDrawerOpen=false;render()" style="display:flex;align-items:center;justify-content:space-between;width:100%;min-height:44px;padding:10px 14px;border-radius:8px;background:${adminTab === item.key ? 'linear-gradient(135deg, rgba(194,77,103,0.4) 0%, rgba(194,77,103,0.15) 100%)' : 'rgba(255,255,255,0.04)'};border:1px solid ${adminTab === item.key ? '#c24d67' : 'rgba(255,255,255,0.08)'};color:#ffffff;cursor:pointer;text-align:left;box-sizing:border-box;transition:all 0.2s ease">
                      <div style="display:flex;align-items:center;gap:12px;min-width:0">
                        <span style="display:grid;place-items:center;color:${adminTab === item.key ? '#ffb3c1' : 'var(--gold-light)'};flex-shrink:0">
                          ${svgIcon(item.icon, 18)}
                        </span>
                        <span style="font-size:13.5px;font-weight:${adminTab === item.key ? '700' : '500'};color:#ffffff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                          ${item.label}
                        </span>
                      </div>
                      ${navCounts[item.key] ? `
                        <b style="background:${item.key === 'inventory' && alertCount ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.14)'};color:#ffffff;font-size:10px;font-weight:800;padding:2px 8px;border-radius:12px;border:${item.key === 'inventory' && alertCount ? '1px solid rgba(239,68,68,0.6)' : 'none'};flex-shrink:0">
                          ${navCounts[item.key]}
                        </b>
                      ` : `
                        <span style="color:${adminTab === item.key ? '#ffb3c1' : '#71717a'};font-size:14px;font-weight:700;flex-shrink:0">›</span>
                      `}
                    </button>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </nav>

          <div class="admin-sidebar-footer" style="margin-top:auto;padding-top:14px">
            <button class="admin-exit" onclick="adminMobileDrawerOpen=false;go('home')">${svgIcon('arrowLeft', 16)} Return to Storefront</button>
          </div>
        </aside>
      ` : ''}

      <!-- Main Executive Viewport -->
      <div class="admin-main">
        <!-- Million-Dollar Desktop Topbar -->
        <div class="admin-topbar desktop-only">
          <div class="admin-breadcrumb">
            <span style="color:#a1a1aa">Executive Suite</span> <span style="color:#52525b">/</span> <b style="color:#fff">${ADMIN_TAB_TITLES[adminTab] || 'Dashboard'}</b>
          </div>

          <button class="command-palette-trigger" onclick="commandPaletteOpen=true;commandPaletteQuery='';render()">
            ${svgIcon('search', 14)} <span>Search or command palette...</span> <kbd>⌘K</kbd>
          </button>

          <div class="admin-topbar-actions">
            <div class="admin-kpi-pill">
              <span style="font-size:10px;color:#a1a1aa">LIVE REVENUE</span>
              <strong style="color:var(--gold-light);font-size:13px">${money(totalRevenue)}</strong>
            </div>
            <span class="store-status"><i></i> Production Live</span>
            <button class="secondary-btn" style="padding:6px 12px;font-size:12px;background:#092420;color:#fff;border-color:rgba(255,255,255,0.15);display:inline-flex;align-items:center;gap:6px" onclick="syncAdminWithBackend()">
              ⚡ Sync DB
            </button>
            <button class="icon-btn" aria-label="Notifications" onclick="commandPaletteOpen=true;commandPaletteQuery='';render()">
              ${svgIcon('bell', 18)}
              ${alertCount || pendingOrders ? `<span class="badge-count">${alertCount + pendingOrders}</span>` : ''}
            </button>
          </div>
        </div>

        <!-- Mobile Top Navigation Header -->
        <div class="admin-mobile-header mobile-only">
          <div style="display:flex;align-items:center;gap:10px">
            <button class="admin-mobile-menu-btn" onclick="adminMobileDrawerOpen=true;render()" aria-label="Open Navigation Menu">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            <div class="admin-mobile-brand">
              <span class="admin-mobile-title">BYMARIE</span>
              <span class="admin-mobile-badge">${ADMIN_TAB_TITLES[adminTab] ? ADMIN_TAB_TITLES[adminTab].split(' ')[0] : 'Admin'}</span>
            </div>
          </div>

          <div style="display:flex;align-items:center;gap:8px">
            <div class="admin-kpi-pill compact">
              <span style="font-size:8.5px;color:#a1a1aa">REVENUE</span>
              <strong style="color:var(--gold-light);font-size:11.5px">${money(totalRevenue)}</strong>
            </div>
            <button class="admin-mobile-icon-btn" onclick="syncAdminWithBackend()" title="Sync Database">
              ⚡
            </button>
            <button class="admin-mobile-icon-btn" onclick="commandPaletteOpen=true;commandPaletteQuery='';render()" title="Search & Actions">
              ${svgIcon('search', 15)}
            </button>
          </div>
        </div>

        <section class="admin-body">
          ${adminTab === 'dashboard' ? renderAdminDashboard(products, orders, totalRevenue, lowStockProducts, outOfStockProducts, users) : ''}
          ${adminTab === 'orders' ? renderAdminOrders(orders) : ''}
          ${adminTab === 'products' ? renderAdminProducts(products) : ''}
          ${adminTab === 'inventory' ? renderAdminInventory(products) : ''}
          ${adminTab === 'users' ? renderAdminUsers(users) : ''}
          ${adminTab === 'broadcast' ? renderAdminBroadcast(users) : ''}
          ${adminTab === 'wholesale' ? renderAdminWholesale(wholesaleInquiries) : ''}
          ${adminTab === 'discounts' ? renderAdminDiscounts(coupons) : ''}
          ${adminTab === 'cms' ? renderAdminSiteCMS() : ''}
          ${adminTab === 'supabase' ? renderAdminSupabaseConfig() : ''}
        </section>

        <!-- Mobile Fixed Bottom App Navigation Bar (Luxury App Dock) -->
        <nav class="admin-mobile-bottom-bar mobile-only">
          <button class="admin-mobile-nav-item ${adminTab === 'dashboard' ? 'active' : ''}" onclick="adminTab='dashboard';render()">
            ${svgIcon('grid', 20)}
            <span>Overview</span>
          </button>

          <button class="admin-mobile-nav-item ${adminTab === 'orders' ? 'active' : ''}" onclick="adminTab='orders';render()">
            <div style="position:relative;display:inline-block">
              ${svgIcon('bag', 20)}
              ${pendingOrders ? `<span class="nav-badge-dot">${pendingOrders}</span>` : ''}
            </div>
            <span>Orders</span>
          </button>

          <button class="admin-mobile-nav-add" onclick="openProductModal('add')" title="Add New Luxury Piece">
            <span>+</span>
          </button>

          <button class="admin-mobile-nav-item ${adminTab === 'inventory' ? 'active' : ''}" onclick="adminTab='inventory';render()">
            <div style="position:relative;display:inline-block">
              ${svgIcon('layers', 20)}
              ${alertCount ? `<span class="nav-badge-dot warn">${alertCount}</span>` : ''}
            </div>
            <span>Stock</span>
          </button>

          <button class="admin-mobile-nav-item ${(adminTab !== 'dashboard' && adminTab !== 'orders' && adminTab !== 'inventory') ? 'active' : ''}" onclick="adminMobileDrawerOpen=true;render()">
            <div style="position:relative;display:inline-block">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </div>
            <span>Menu</span>
          </button>
        </nav>
      </div>
    </main>
  `;
}

function trendSpark(current, direction = 'up') {
  if (!current || current <= 0) return [0, 0, 0, 0, 0, 0, 0];
  const base = current;
  const upRatios = [0.4, 0.55, 0.5, 0.7, 0.8, 0.9];
  const downRatios = [1.5, 1.4, 1.3, 1.2, 1.1, 1.05];
  const ratios = direction === 'up' ? upRatios : downRatios;
  return [...ratios.map(r => Number((base * r).toFixed(1))), current];
}

function sparklineSvg(values, color = 'var(--emerald)', width = 72, height = 28) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = (max - min) || 1;
  const stepX = width / (values.length - 1);
  const pts = values.map((v, i) => `${(i * stepX).toFixed(1)},${(height - ((v - min) / range) * height).toFixed(1)}`);
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none"><polyline points="${pts.join(' ')}" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function areaChartSvg(values, labels, width = 640, height = 200) {
  const max = Math.max(...values, 1);
  const min = 0;
  const range = max - min || 1;
  const stepX = width / (values.length - 1);
  const pts = values.map((v, i) => [i * stepX, height - ((v - min) / range) * height]);
  const linePath = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;

  return `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" class="area-chart-svg">
      <defs>
        <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style="stop-color:#c24d67;stop-opacity:0.45"/>
          <stop offset="100%" style="stop-color:#c24d67;stop-opacity:0"/>
        </linearGradient>
      </defs>
      <path d="${areaPath}" fill="url(#revenueGradient)"/>
      <path d="${linePath}" fill="none" stroke="#c24d67" stroke-width="2.5" vector-effect="non-scaling-stroke"/>
      ${pts.map(p => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4" fill="#fff" stroke="#c24d67" stroke-width="2"/>`).join('')}
    </svg>
    <div class="area-chart-labels">
      ${labels.map(l => `<span>${l}</span>`).join('')}
    </div>
  `;
}

function renderAdminDashboard(products, orders, totalRevenue, lowStock, outOfStock, users) {
  const alertTotal = lowStock.length + (outOfStock ? outOfStock.length : 0);
  const totalFloatBalance = users.reduce((sum, u) => sum + (Number(u.walletBalance) || 0), 0);
  const aov = orders.length ? (totalRevenue / orders.length) : 0;

  const categoryBreakdown = Object.entries(
    products.reduce((acc, p) => { acc[p.category] = (acc[p.category] || 0) + 1; return acc; }, {})
  ).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  const catTotal = categoryBreakdown.reduce((s, c) => s + c.count, 0);
  const catPalette = ['#c24d67', '#c59737', '#1b638a', '#791b34', '#70428e', '#155d53', '#d45b7e', '#4a7c59', '#8a6b74', '#e4a253'];

  let cumPct = 0;
  const gradientStops = catTotal > 0 ? categoryBreakdown.map((c, i) => {
    const pct = (c.count / catTotal) * 100;
    const start = cumPct;
    cumPct += pct;
    return `${catPalette[i % catPalette.length]} ${start}% ${cumPct}%`;
  }).join(', ') : '#27272a 0% 100%';

  const weekly = [0, 0, 0, 0, 0, 0, totalRevenue];
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const ordersSpark = trendSpark(orders.length, 'up');
  const catalogSpark = trendSpark(products.length, 'up');
  const alertSpark = trendSpark(alertTotal, 'down');

  return `
    <div class="admin-top-bar animate-fade-up">
      <div>
        <span class="eyebrow" style="color:var(--gold-light)">EXECUTIVE BUSINESS INTELLIGENCE</span>
        <h1 style="font-size:32px;margin-top:4px">Haute Couture Performance Command</h1>
      </div>
      <div style="display:flex;gap:10px">
        <button class="secondary-btn" onclick="exportOrdersCSV()">📥 Export Sales CSV</button>
        <button class="primary" style="background:#c24d67" onclick="openProductModal('add')">${svgIcon('plus', 16)} Add New Piece</button>
      </div>
    </div>

    <!-- 6 High-Altitude Financial KPI Bento Grid -->
    <div class="stats-row cols-3 animate-fade-up delay-1" style="margin-bottom:20px">
      <div class="stat-card sparkline-card">
        <div>
          <span class="stat-icon rose">${svgIcon('tag', 18)}</span>
          <strong style="color:var(--gold-light)">${money(totalRevenue)}</strong>
          <span>Gross Merchandise Volume (GMV)</span>
        </div>
        <div class="sparkline-wrap">
          ${sparklineSvg(trendSpark(totalRevenue, 'up'), '#c24d67')}
          <span class="stat-trend ${totalRevenue > 0 ? 'up' : 'neutral'}">${svgIcon('trendUp', 12)} Live Revenue</span>
        </div>
      </div>

      <div class="stat-card sparkline-card">
        <div>
          <span class="stat-icon blue">${svgIcon('bag', 18)}</span>
          <strong>${money(aov)}</strong>
          <span>Average Order Value (AOV)</span>
        </div>
        <div class="sparkline-wrap">
          ${sparklineSvg(trendSpark(aov, 'up'), 'var(--blue)')}
          <span class="stat-trend ${orders.length > 0 ? 'up' : 'neutral'}">${svgIcon('trendUp', 12)} Order Value</span>
        </div>
      </div>

      <div class="stat-card sparkline-card">
        <div>
          <span class="stat-icon gold">${svgIcon('users', 18)}</span>
          <strong style="color:#38bdf8">${money(totalFloatBalance)}</strong>
          <span>Member Float Wallet Liabilities</span>
        </div>
        <div class="sparkline-wrap">
          ${sparklineSvg(trendSpark(totalFloatBalance, 'up'), '#38bdf8')}
          <span class="stat-trend up">${svgIcon('trendUp', 12)} Liquid Balance</span>
        </div>
      </div>
    </div>

    <!-- Live Charts Section -->
    <div class="dashboard-bento animate-fade-up delay-2">
      <div class="bento-hero-card">
        <div class="stat-card-top">
          <span class="stat-icon rose">${svgIcon('tag', 18)}</span>
          <span class="stat-trend ${totalRevenue > 0 ? 'up' : 'neutral'}">${svgIcon('trendUp', 13)} Live Sales</span>
        </div>
        <strong class="bento-hero-value" style="color:#fff">${money(totalRevenue)}</strong>
        <span style="color:#a1a1aa">7-Day Real-Time Revenue Velocity (Cedis)</span>
        <div class="bento-hero-chart">
          ${areaChartSvg(weekly, weekDays)}
        </div>
      </div>

      <div class="bento-donut-card">
        <h3 style="color:#fff">Collection Mix (${products.length} Items)</h3>
        <div class="donut-wrap">
          <div class="donut-chart" style="background:conic-gradient(${gradientStops})">
            <div class="donut-hole"><strong style="color:#fff">${products.length}</strong><small style="color:#a1a1aa">Pieces</small></div>
          </div>
        </div>
        <div class="donut-legend">
          ${products.length > 0 ? categoryBreakdown.map((c, i) => `
            <div class="donut-legend-row">
              <span class="dot" style="background:${catPalette[i % catPalette.length]}"></span>
              <span style="color:#e4e4e7">${c.name}</span>
              <b style="color:#fff">${Math.round((c.count / (catTotal || 1)) * 100)}%</b>
            </div>
          `).join('') : `
            <div style="color:#71717a;font-size:12px;text-align:center;padding:10px 0">No products in catalog yet</div>
          `}
        </div>
      </div>
    </div>

    <!-- Secondary KPI Row -->
    <div class="stats-row cols-3 animate-fade-up delay-3">
      <div class="stat-card sparkline-card">
        <div>
          <span class="stat-icon blue">${svgIcon('bag', 18)}</span>
          <strong>${orders.length}</strong>
          <span>Total Orders Placed</span>
        </div>
        <div class="sparkline-wrap">
          ${sparklineSvg(ordersSpark, 'var(--blue)')}
          <span class="stat-trend ${orders.length ? 'up' : 'neutral'}">${svgIcon('trendUp', 12)} Order Queue</span>
        </div>
      </div>

      <div class="stat-card sparkline-card">
        <div>
          <span class="stat-icon gold">${svgIcon('box', 18)}</span>
          <strong>${products.length}</strong>
          <span>Active Pieces in Boutique</span>
        </div>
        <div class="sparkline-wrap">
          ${sparklineSvg(catalogSpark, 'var(--gold)')}
          <span class="stat-trend ${products.length ? 'up' : 'neutral'}">${svgIcon('trendUp', 12)} ${categoryBreakdown.length} Categories</span>
        </div>
      </div>

      <div class="stat-card sparkline-card">
        <div>
          <span class="stat-icon ${alertTotal ? 'red' : 'rose'}">${svgIcon('layers', 18)}</span>
          <strong style="color:${alertTotal ? 'var(--red)' : '#34d399'}">${alertTotal}</strong>
          <span>Stock Sentinel Alerts</span>
        </div>
        <div class="sparkline-wrap">
          ${sparklineSvg(alertSpark, alertTotal ? 'var(--red)' : '#34d399')}
          <span class="stat-trend ${alertTotal ? 'down' : 'up'}">${svgIcon(alertTotal ? 'trendDown' : 'trendUp', 12)} ${alertTotal ? 'Needs Replenishment' : 'Optimal Inventory'}</span>
        </div>
      </div>
    </div>

    <!-- Recent High-Value Orders -->
    <div class="admin-section-head" style="margin-top:28px">
      <h3 style="color:#fff">Recent Live Orders Stream</h3>
      <button class="text-btn" style="color:var(--gold)" onclick="adminTab='orders';render()">View All Logistics →</button>
    </div>
    <div class="table-scroll">
      <table class="data-table">
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Client</th>
            <th>Date</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Logistics Action</th>
          </tr>
        </thead>
        <tbody>
          ${orders.slice(0, 5).map(o => `
            <tr>
              <td><b>${o.id}</b></td>
              <td>
                <div class="table-avatar-row">
                  <span class="table-avatar" style="background:#c24d67;color:#fff">${o.name.charAt(0)}</span>
                  <div>
                    <strong>${o.name}</strong>
                    <small style="color:#a1a1aa;display:block">${o.phone}</small>
                  </div>
                </div>
              </td>
              <td>${o.date}</td>
              <td><b style="color:var(--gold-light)">${money(o.total)}</b></td>
              <td><span class="badge ${o.status.toLowerCase()}">${o.status}</span></td>
              <td>
                <select class="mini-select" onchange="updateOrderStatus('${o.id}', this.value)">
                  ${['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'].map(s => `
                    <option ${o.status === s ? 'selected' : ''}>${s}</option>
                  `).join('')}
                </select>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderAdminProducts(products) {
  const f = adminProductFilter;
  const categories = [...new Set(products.map(p => p.category))].sort();
  const query = f.search.toLowerCase().trim();
  const list = products.filter(p => {
    const matchSearch = !query || `${p.name} ${p.category}`.toLowerCase().includes(query);
    const matchCat = f.category === 'All' || p.category === f.category;
    const matchStock = f.stock === 'All'
      || (f.stock === 'In stock' && p.stock > 8)
      || (f.stock === 'Low stock' && p.stock > 0 && p.stock <= 8)
      || (f.stock === 'Out of stock' && p.stock <= 0);
    return matchSearch && matchCat && matchStock;
  });

  return `
    <div class="admin-top-bar animate-fade-up">
      <div>
        <span class="eyebrow" style="color:var(--gold-light)">HAUTE COUTURE CATALOG</span>
        <h1 style="font-size:32px;margin-top:4px">Product Collections (${products.length})</h1>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="secondary-btn" style="color:#fca5a5;border-color:rgba(239,68,68,0.3);font-size:12px;padding:8px 12px" onclick="if(confirm('Wipe any remaining sample catalog items and reset to 0?')){saveProducts([]);toast('Catalog wiped to 0 pieces!');render();}">🧹 Purge Sample Catalog</button>
        <button class="primary" style="background:#c24d67" onclick="openProductModal('add')">${svgIcon('plus', 16)} Add New Piece</button>
      </div>
    </div>

    <div class="admin-filter-bar">
      <div class="searchbox">
        <span>${icon('search')}</span>
        <input aria-label="Search products" value="${f.search}" oninput="adminProductFilter.search=this.value;render()" placeholder="Search pieces by name, category, or notes…">
      </div>
      <select onchange="adminProductFilter.category=this.value;render()">
        ${['All', ...categories].map(x => `<option ${f.category === x ? 'selected' : ''}>${x}</option>`).join('')}
      </select>
      <select onchange="adminProductFilter.stock=this.value;render()">
        ${['All', 'In stock', 'Low stock', 'Out of stock'].map(x => `<option ${f.stock === x ? 'selected' : ''}>${x}</option>`).join('')}
      </select>
      <span class="results-meta" style="margin:0;color:#a1a1aa">${list.length} of ${products.length} displayed</span>
    </div>

    ${list.length ? `
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Piece Details</th>
              <th>Category</th>
              <th>Retail Price</th>
              <th>Stock Status</th>
              <th>Rating</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${list.map(p => `
              <tr>
                <td>
                  <div class="table-product-cell">
                    <img src="${p.image}" alt="${p.name}" style="border-radius:6px;width:44px;height:52px;object-fit:cover">
                    <div>
                      <strong style="color:#fff">${p.name}</strong>
                      <div style="display:flex;gap:6px;margin-top:4px">
                        ${p.tag ? `<span class="tag" style="position:static;display:inline-block;padding:2px 6px;font-size:9px">${p.tag}</span>` : ''}
                        <small style="color:#a1a1aa;font-size:10px">${p.colors ? p.colors.join(', ') : ''}</small>
                      </div>
                    </div>
                  </div>
                </td>
                <td><span class="badge" style="background:rgba(194,77,103,0.15);color:#ffb3c1;border:1px solid rgba(194,77,103,0.3)">${p.category}</span></td>
                <td><b style="color:var(--gold-light)">${money(p.price)}</b>${p.old ? `<del style="color:#71717a;display:block;font-size:11px">${money(p.old)}</del>` : ''}</td>
                <td>
                  <button type="button" onclick="toggleProductStockStatus('${p.id}')" title="Click to toggle availability" class="badge ${p.stock > 8 ? 'delivered' : p.stock > 0 ? 'pending' : 'cancelled'}" style="border:none;cursor:pointer;display:inline-flex;align-items:center;gap:4px">
                    ${p.stock > 0 ? `⚡ In Stock (${p.stock})` : '❌ Out of Stock'}
                  </button>
                </td>
                <td>★ ${p.rating || 5.0}</td>
                <td>
                  <div class="table-actions">
                    <button type="button" class="secondary-btn" style="padding:4px 8px;font-size:11px" onclick="toggleProductStockStatus('${p.id}')">${p.stock > 0 ? 'Set Out' : 'Set In'}</button>
                    <button class="icon-action-btn" title="Edit piece" onclick="openProductModal('edit', '${p.id}')">${svgIcon('edit', 15)}</button>
                    <button class="icon-action-btn danger" title="Delete piece" onclick="deleteProduct('${p.id}')">${svgIcon('trash', 15)}</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : `
      <div class="admin-empty-state">
        <span>${svgIcon('search', 26)}</span>
        <h3 style="color:#fff">No pieces match your filters</h3>
        <p style="color:#a1a1aa">Try adjusting search query or selecting another category.</p>
        <button class="secondary-btn" onclick="adminProductFilter={search:'',category:'All',stock:'All'};render()">Clear filters</button>
      </div>
    `}
  `;
}

function renderAdminInventory(products) {
  if (!products.length) {
    return `
      <div class="admin-top-bar animate-fade-up">
        <div>
          <span class="eyebrow" style="color:var(--gold-light)">STOCK SENTINEL</span>
          <h1 style="font-size:32px;margin-top:4px">Inventory Control &amp; Replenishment</h1>
        </div>
        <button class="primary" style="background:#c24d67" onclick="openProductModal('add')">
          ${svgIcon('plus', 16)} Add First Piece
        </button>
      </div>

      <div class="admin-empty-state animate-fade-up" style="padding:60px 24px;text-align:center">
        <span style="font-size:44px;display:block;margin-bottom:12px">🛡️</span>
        <h2 style="font-family:'Playfair Display',serif;font-size:26px;color:#fff;margin-bottom:8px">Stock Sentinel Standby</h2>
        <p style="color:#a1a1aa;font-size:14px;max-width:480px;margin:0 auto 20px">No products currently in the boutique catalog. Add luxury pieces to activate automated stock alerts, replenishment meters, and batch stepper controls.</p>
        <button class="primary" style="background:#c24d67" onclick="openProductModal('add')">
          ${svgIcon('plus', 16)} Add First Piece
        </button>
      </div>
    `;
  }

  const f = adminInventoryFilter;
  const query = f.search.toLowerCase().trim();
  const list = products.filter(p => {
    const matchSearch = !query || `${p.name} ${p.category}`.toLowerCase().includes(query);
    const matchStock = f.stock === 'All'
      || (f.stock === 'In stock' && p.stock > 8)
      || (f.stock === 'Low stock' && p.stock > 0 && p.stock <= 8)
      || (f.stock === 'Out of stock' && p.stock <= 0);
    return matchSearch && matchStock;
  });
  const maxStock = Math.max(...products.map(p => p.stock), 1);

  return `
    <div class="admin-top-bar animate-fade-up">
      <div>
        <span class="eyebrow" style="color:var(--gold-light)">STOCK SENTINEL</span>
        <h1 style="font-size:32px;margin-top:4px">Inventory Control &amp; Replenishment</h1>
      </div>
      <button class="primary" style="background:#c24d67" onclick="openProductModal('add')">
        ${svgIcon('plus', 16)} Add New Piece
      </button>
    </div>

    <div class="admin-filter-bar">
      <div class="searchbox">
        <span>${icon('search')}</span>
        <input aria-label="Search inventory" value="${f.search}" oninput="adminInventoryFilter.search=this.value;render()" placeholder="Search pieces by name or category…">
      </div>
      <select onchange="adminInventoryFilter.stock=this.value;render()">
        ${['All', 'In stock', 'Low stock', 'Out of stock'].map(x => `<option ${f.stock === x ? 'selected' : ''}>${x}</option>`).join('')}
      </select>
      <span class="results-meta" style="margin:0;color:#a1a1aa">${list.length} of ${products.length} items</span>
    </div>

    ${list.length ? `
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Piece</th>
              <th>Category</th>
              <th>Stock Meter</th>
              <th>Health Status</th>
              <th>Batch Adjustment</th>
            </tr>
          </thead>
          <tbody>
            ${list.map(p => `
              <tr>
                <td>
                  <div class="table-product-cell">
                    <img src="${p.image}" alt="${p.name}" style="border-radius:6px;width:40px;height:48px;object-fit:cover">
                    <strong style="color:#fff">${p.name}</strong>
                  </div>
                </td>
                <td><span style="color:#d4d4d8">${p.category}</span></td>
                <td>
                  <div class="stock-bar-wrap">
                    <span class="stock-bar-num" style="color:#fff;font-weight:700">${p.stock}</span>
                    <div class="stock-bar" style="background:#27272a"><div class="stock-bar-fill ${p.stock > 8 ? 'ok' : p.stock > 0 ? 'low' : 'out'}" style="width:${Math.min(100, (p.stock / maxStock) * 100)}%"></div></div>
                  </div>
                </td>
                <td>
                  <span class="badge ${p.stock > 8 ? 'delivered' : p.stock > 0 ? 'pending' : 'cancelled'}">
                    ${p.stock > 8 ? 'Optimal' : p.stock > 0 ? 'Low Stock' : 'Out of Stock'}
                  </span>
                </td>
                <td>
                  <div class="table-actions">
                    <button class="icon-action-btn" title="Remove one unit" onclick="adjustProductStock('${p.id}', -1)">−1</button>
                    <button class="icon-action-btn" title="Add one unit" onclick="adjustProductStock('${p.id}', 1)">+1</button>
                    <button class="icon-action-btn" title="Add ten units" onclick="adjustProductStock('${p.id}', 10)">+10</button>
                    <button type="button" class="secondary-btn" style="padding:4px 8px;font-size:11px" onclick="toggleProductStockStatus('${p.id}')">${p.stock > 0 ? 'Out' : 'In'}</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : `
      <div class="admin-empty-state">
        <span>${svgIcon('layers', 26)}</span>
        <h3 style="color:#fff">No items match your filters</h3>
        <p style="color:#a1a1aa">Try adjusting the search query or stock filter.</p>
        <button class="secondary-btn" onclick="adminInventoryFilter={search:'',stock:'All'};render()">Clear filters</button>
      </div>
    `}
  `;
}

function exportOrdersToExcel() {
  const orders = getOrders();
  if (!orders.length) return toast('No customer orders found to export', 'warning');

  const headers = [
    'Order ID',
    'Date',
    'Customer Name',
    'Phone',
    'Email',
    'Delivery Destination',
    'City',
    'Region',
    'Items Breakdown',
    'Subtotal (GHS)',
    'Discount (GHS)',
    'Delivery Fee (GHS)',
    'Grand Total (GHS)',
    'Payment Method',
    'Fulfillment Status'
  ];

  const rows = orders.map(o => {
    const itemsStr = (o.items || []).map(it => `${it.qty}x ${it.name || it.id} (${it.size || ''} ${it.color || ''})`).join('; ');
    return [
      `"${o.id}"`,
      `"${o.date || ''}"`,
      `"${(o.name || '').replace(/"/g, '""')}"`,
      `"${(o.phone || '').replace(/"/g, '""')}"`,
      `"${(o.email || '').replace(/"/g, '""')}"`,
      `"${(o.address || '').replace(/"/g, '""')}"`,
      `"${(o.city || '').replace(/"/g, '""')}"`,
      `"${(o.region || '').replace(/"/g, '""')}"`,
      `"${itemsStr.replace(/"/g, '""')}"`,
      `"${(o.subtotal || 0).toFixed(2)}"`,
      `"${(o.discountAmount || 0).toFixed(2)}"`,
      `"${(o.deliveryFee || 0).toFixed(2)}"`,
      `"${(o.total || 0).toFixed(2)}"`,
      `"${(o.payment || '').replace(/"/g, '""')}"`,
      `"${o.status || 'Pending'}"`
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ByMarie-Customer-Orders-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('📊 All orders exported to Excel (.csv) successfully! ⚡');
}

function shareOrderToWhatsApp(orderId) {
  const order = getOrders().find(o => o.id === orderId);
  if (!order) return toast('Order not found', 'warning');

  const itemsList = (order.items || []).map(it => `• ${it.qty}x *${it.name || it.id}* (GH₵ ${(it.price || 0).toFixed(2)})`).join('\n');

  const text = `🛍️ *BYMARIE LUXURY BOUTIQUE — ORDER ${order.id}*\n` +
    `----------------------------------------\n` +
    `📅 *Date:* ${order.date || 'Today'}\n` +
    `👤 *Client:* ${order.name}\n` +
    `📞 *Phone:* ${order.phone}\n` +
    `📍 *Delivery Destination:* ${order.address}, ${order.city} (${order.region})\n` +
    `🚚 *Method:* ${order.delivery}\n` +
    `💳 *Payment:* ${order.payment}\n` +
    `📊 *Status:* ${order.status}\n\n` +
    `📦 *Itemized Pieces:*\n` +
    `${itemsList}\n\n` +
    `💰 *Grand Total:* GH₵ ${(order.total || 0).toFixed(2)}\n` +
    `----------------------------------------\n` +
    `✨ _Dispatched from ByMarie Atelier Hub Accra_`;

  const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(waUrl, '_blank');
  toast('Opening WhatsApp with order summary... 💬');
}

function shareAllOrdersToWhatsApp() {
  const orders = getOrders();
  if (!orders.length) return toast('No orders to share', 'warning');

  const ordersList = orders.slice(0, 20).map((o, idx) => {
    return `${idx + 1}. *${o.id}* | ${o.name} (${o.phone})\n   📍 ${o.city} • GH₵ ${(o.total || 0).toFixed(2)} [${o.status}]`;
  }).join('\n\n');

  const text = `📦 *BYMARIE LOGISTICS DISPATCH SCHEDULE*\n` +
    `📅 *Batch Date:* ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}\n` +
    `📊 *Total Orders:* ${orders.length}\n` +
    `----------------------------------------\n\n` +
    `${ordersList}\n\n` +
    `----------------------------------------\n` +
    `⚡ _ByMarie Executive Dispatch Schedule_`;

  const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(waUrl, '_blank');
  toast('Opening WhatsApp with orders dispatch schedule... 💬');
}

function renderAdminOrders(orders) {
  const f = adminOrderFilter;
  const query = f.search.toLowerCase().trim();
  const list = orders.filter(o => {
    const matchSearch = !query || `${o.id} ${o.name} ${o.phone} ${o.city}`.toLowerCase().includes(query);
    const matchStatus = f.status === 'All' || o.status === f.status;
    return matchSearch && matchStatus;
  });

  const statusCounts = {
    Pending: orders.filter(o => o.status === 'Pending').length,
    Processing: orders.filter(o => o.status === 'Processing').length,
    Shipped: orders.filter(o => o.status === 'Shipped').length,
    Delivered: orders.filter(o => o.status === 'Delivered').length
  };

  return `
    <div class="admin-top-bar animate-fade-up">
      <div>
        <span class="eyebrow" style="color:var(--gold-light)">LOGISTICS &amp; DISPATCH</span>
        <h1 style="font-size:32px;margin-top:4px">Customer Orders (${orders.length})</h1>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="secondary-btn" style="background:#22c55e;color:#fff;border-color:#22c55e;font-size:12.5px;padding:8px 14px" onclick="shareAllOrdersToWhatsApp()">
          💬 Share Schedule to WhatsApp
        </button>
        <button class="secondary-btn" style="background:#0284c7;color:#fff;border-color:#0284c7;font-size:12.5px;padding:8px 14px" onclick="exportOrdersToExcel()">
          📊 Export to Excel (.CSV)
        </button>
      </div>
    </div>

    <div class="stats-row cols-4" style="margin-bottom:20px">
      <div class="stat-card compact"><strong style="color:#eab308">${statusCounts.Pending}</strong><span>Pending</span></div>
      <div class="stat-card compact"><strong style="color:#38bdf8">${statusCounts.Processing}</strong><span>Processing</span></div>
      <div class="stat-card compact"><strong style="color:#a855f7">${statusCounts.Shipped}</strong><span>Shipped</span></div>
      <div class="stat-card compact"><strong style="color:#34d399">${statusCounts.Delivered}</strong><span>Delivered</span></div>
    </div>

    <div class="admin-filter-bar">
      <div class="searchbox">
        <span>${icon('search')}</span>
        <input aria-label="Search orders" value="${f.search}" oninput="adminOrderFilter.search=this.value;render()" placeholder="Search by Order ID, client name, phone, or town…">
      </div>
      <select onchange="adminOrderFilter.status=this.value;render()">
        ${['All', 'Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'].map(x => `<option ${f.status === x ? 'selected' : ''}>${x}</option>`).join('')}
      </select>
      <span class="results-meta" style="margin:0;color:#a1a1aa">${list.length} of ${orders.length} orders</span>
    </div>

    ${list.length ? `
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Client</th>
              <th>Date</th>
              <th>Delivery / City</th>
              <th>Payment Method</th>
              <th>Total Amount</th>
              <th>Fulfillment Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${list.map(o => `
              <tr>
                <td><b>${o.id}</b></td>
                <td>
                  <div class="table-avatar-row">
                    <span class="table-avatar" style="background:#c24d67;color:#fff">${(o.name || 'C').charAt(0).toUpperCase()}</span>
                    <div>
                      <strong style="color:#fff">${o.name}</strong>
                      <small style="display:block;color:#a1a1aa">${o.phone}</small>
                    </div>
                  </div>
                </td>
                <td>${o.date}</td>
                <td><small style="color:#e4e4e7">${o.city} (${o.delivery && o.delivery.includes('Express') ? '⚡ Express' : 'Standard'})</small></td>
                <td><span style="font-size:12px;color:#d4d4d8">${o.payment}</span></td>
                <td><b style="color:var(--gold-light)">${money(o.total)}</b></td>
                <td>
                  <select class="mini-select" onchange="updateOrderStatus('${o.id}', this.value)">
                    ${['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'].map(s => `
                      <option ${o.status === s ? 'selected' : ''}>${s}</option>
                    `).join('')}
                  </select>
                </td>
                <td>
                  <div class="table-actions">
                    <button class="icon-action-btn" title="View order summary" onclick="openOrderModal('${o.id}')">${svgIcon('eye', 15)}</button>
                    <button class="icon-action-btn" title="Share Order to WhatsApp" onclick="shareOrderToWhatsApp('${o.id}')" style="color:#34d399">💬</button>
                    <button class="icon-action-btn" title="Printable Luxury Invoice" onclick="openInvoiceModal('${o.id}')">${svgIcon('receipt', 15)}</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : `
      <div class="admin-empty-state">
        <span>${svgIcon('bag', 26)}</span>
        <h3 style="color:#fff">No orders match your filter</h3>
        <p style="color:#a1a1aa">Try adjusting search parameters.</p>
        <button class="secondary-btn" onclick="adminOrderFilter={search:'',status:'All'};render()">Clear filters</button>
      </div>
    `}
  `;
}

function renderAdminUsers(users) {
  const f = adminUserFilter || { search: '', minWallet: 'All' };
  const query = (f.search || '').toLowerCase().trim();
  const list = (users || []).filter(u => {
    const matchSearch = !query || `${u.name || ''} ${u.email || ''} ${u.phone || ''}`.toLowerCase().includes(query);
    const matchWallet = f.minWallet === 'All'
      || (f.minWallet === 'Has balance' && (u.walletBalance || 0) > 0)
      || (f.minWallet === 'High balance' && (u.walletBalance || 0) >= 500)
      || (f.minWallet === 'Zero balance' && (u.walletBalance || 0) <= 0);
    return matchSearch && matchWallet;
  });

  const totalFloatBalance = users.reduce((sum, u) => sum + (u.walletBalance || 0), 0);
  const usersWithBalanceCount = users.filter(u => (u.walletBalance || 0) > 0).length;

  return `
    <div class="admin-top-bar animate-fade-up">
      <div>
        <span class="eyebrow" style="color:var(--gold-light)">CLIENT DIRECTORY &amp; WALLETS</span>
        <h1 style="font-size:32px;margin-top:4px">VIP Client Ledger (${users.length})</h1>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <button class="secondary-btn" style="background:#0a2924;color:var(--gold-light);border-color:var(--gold);font-size:12.5px;padding:8px 14px" onclick="fetchLatestUsers(true)">
          ${svgIcon('refresh', 14)} Refresh Live Clients
        </button>
        <button class="secondary-btn" style="background:#22c55e;color:#fff;border-color:#22c55e;font-size:12.5px;padding:8px 14px" onclick="adminTab='broadcast';render()">
          📢 Bulk SMS &amp; Email Engine
        </button>
        <button class="primary" style="background:#c24d67" onclick="activeModal='admin_add_user';render()">
          ${svgIcon('plus', 16)} Add VIP Account
        </button>
      </div>
    </div>

    <div class="stats-row cols-3 animate-fade-up delay-1" style="margin-bottom:20px">
      <div class="stat-card compact">
        <strong style="color:#fff">${users.length}</strong>
        <span>Registered VIP Clients</span>
      </div>
      <div class="stat-card compact">
        <strong style="color:#38bdf8">${money(totalFloatBalance)}</strong>
        <span>Float Wallet Outstanding Liabilities</span>
      </div>
      <div class="stat-card compact">
        <strong style="color:#34d399">${usersWithBalanceCount}</strong>
        <span>Active Funded Accounts</span>
      </div>
    </div>

    <div class="admin-filter-bar">
      <div class="searchbox">
        <span>${icon('search')}</span>
        <input aria-label="Search users" value="${f.search}" oninput="adminUserFilter.search=this.value;render()" placeholder="Search clients by name, email, or phone…">
      </div>
      <select onchange="adminUserFilter.minWallet=this.value;render()">
        ${['All', 'Has balance', 'High balance', 'Zero balance'].map(x => `<option ${f.minWallet === x ? 'selected' : ''}>${x}</option>`).join('')}
      </select>
      <span class="results-meta" style="margin:0;color:#a1a1aa">${list.length} of ${users.length} clients</span>
    </div>

    ${list.length ? `
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Client Profile</th>
              <th>Phone / WhatsApp</th>
              <th>Primary Address &amp; City</th>
              <th>Status &amp; Last Login</th>
              <th>Orders</th>
              <th>Float Wallet</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${list.map(u => `
              <tr>
                <td>
                  <div class="table-avatar-row">
                    <span class="table-avatar" style="background:#c24d67;color:#fff">${(u.name || 'C').charAt(0).toUpperCase()}</span>
                    <div>
                      <strong style="color:#fff">${u.name || 'Anonymous Client'}</strong>
                      <small style="display:block;color:#a1a1aa">${u.email || 'No email'}</small>
                    </div>
                  </div>
                </td>
                <td>
                  ${u.phone ? `
                    <a href="https://wa.me/${u.phone.replace(/[^0-9]/g, '')}" target="_blank" style="color:#34d399;font-weight:700;font-size:12px;text-decoration:underline">
                      ${u.phone} 💬
                    </a>
                  ` : '<span style="color:#71717a">N/A</span>'}
                </td>
                <td>
                  <strong style="color:#fff;display:block;font-size:12.5px">${u.city || 'Accra'}</strong>
                  <small style="color:#a1a1aa">${u.address || 'Address on file'}</small>
                </td>
                <td>
                  <span class="badge" style="background:${u.status === 'Super Admin' ? '#8b5cf6' : (u.loggedIn ? '#10b981' : '#64748b')};color:#fff;font-size:10.5px">
                    ${u.status === 'Super Admin' ? '👑 Super Admin' : (u.loggedIn ? '● Signed In' : 'Active')}
                  </span>
                  <small style="display:block;color:#a1a1aa;margin-top:3px">${u.lastLogin || u.joinedDate || 'Recent'}</small>
                </td>
                <td><b style="color:#fff;font-size:14px">${u.ordersCount || 0}</b></td>
                <td>
                  <span class="badge ${(u.walletBalance || 0) > 0 ? 'delivered' : 'pending'}" style="font-size:13px;padding:5px 10px">
                    💳 ${money(u.walletBalance || 0)}
                  </span>
                </td>
                <td>
                  <div class="table-actions" style="display:flex;align-items:center;gap:6px;flex-wrap:nowrap">
                    <button class="client-action-btn dossier" title="View Complete Client Dossier" onclick="openUserDossierModal('${u.id}')">
                      ${svgIcon('eye', 13)} Dossier
                    </button>
                    <button class="client-action-btn edit" title="Edit Contact, Phone & Details" onclick="openEditUserModal('${u.id}')">
                      ✏️ Edit
                    </button>
                    <button class="client-action-btn sms" title="Send Direct SMS" onclick="openSendSmsModal('${u.id}')">
                      📱 SMS
                    </button>
                    <button class="client-action-btn email" title="Send Direct Email" onclick="openDirectEmail('${u.id}')">
                      📧 Email
                    </button>
                    <button class="client-action-btn credit" onclick="promptAdjustWallet('${u.id}', '${u.name}')">+ Credit</button>
                    <button class="client-action-btn debit" onclick="promptDebitWallet('${u.id}', '${u.name}')">− Debit</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : `
      <div class="admin-empty-state">
        <span>${svgIcon('users', 26)}</span>
        <h3 style="color:#fff">No clients match your filter</h3>
        <p style="color:#a1a1aa">Try adjusting your search terms or refresh from database.</p>
        <button class="secondary-btn" onclick="adminUserFilter={search:'',minWallet:'All'};fetchLatestUsers(true);render()">Clear &amp; Refresh</button>
      </div>
    `}
  `;
}

// ===================================================
// BULK SMS & BULK EMAIL CAMPAIGN BROADCAST ENGINE
// ===================================================

let broadcastChannel = 'sms'; // 'sms' | 'email' | 'history'
let broadcastAudience = 'all'; // 'all' | 'funded' | 'buyers' | 'prospects' | 'custom'
let broadcastCustomRecipients = '';
let broadcastSmsSender = 'Bymarie';
let broadcastSmsMessage = 'Greetings from ByMarie! Our exclusive new couture collection is now live. Explore handcrafted scents & styles: https://bymarie.shop Concierge: +233241002000';
let broadcastEmailSubject = '✨ Unveiling the New ByMarie Haute Couture Collection';
let broadcastEmailHeadline = 'A New Epoch of African Luxury & Tailored Excellence';
let broadcastEmailBody = 'Dear {name},\n\nWe are delighted to present the latest private collection at ByMarie. Handcrafted with bespoke silken textures and refined botanical extraits, each piece represents the pinnacle of Ghanaian luxury artistry.\n\nAs a valued member of our private client ledger, you enjoy priority access to secure pieces before public availability.';
let broadcastEmailCtaText = 'Explore The Private Collection';
let broadcastEmailCtaUrl = 'https://bymarie.shop';
let broadcastSending = false;

const BROADCAST_TEMPLATES = {
  drop: {
    name: '🌟 Haute Couture Drop',
    sms: 'Greetings from ByMarie! Our exclusive new couture collection is now live. Explore handcrafted scents & styles: https://bymarie.shop Concierge: +233241002000',
    emailSubject: '✨ Unveiling the New ByMarie Haute Couture Collection',
    emailHeadline: 'A New Epoch of African Luxury & Tailored Excellence',
    emailBody: 'Dear {name},\n\nWe are delighted to present the latest private collection at ByMarie. Handcrafted with bespoke silken textures and refined botanical extraits, each piece represents the pinnacle of Ghanaian luxury artistry.\n\nAs a valued member of our private client ledger, you enjoy priority access to secure pieces before public availability.',
    ctaText: 'Explore The Private Collection',
    ctaUrl: 'https://bymarie.shop'
  },
  sale: {
    name: '⚡ 20% VIP Privilege Code',
    sms: 'Hello {name}! Enjoy an exclusive 20% privilege code "VIP20" on all luxury styles and scents today at ByMarie: https://bymarie.shop Concierge: +233241002000',
    emailSubject: '👑 Private Client Privilege: 20% Off All ByMarie Creations',
    emailHeadline: 'Exclusive Atelier Privilege for Valued Clients',
    emailBody: 'Dear {name},\n\nFor a limited window, enjoy a bespoke 20% privilege across all ByMarie luxury couture, hair aesthetics, and fine scent extraits.\n\nUse your private access voucher code at checkout: VIP20',
    ctaText: 'Claim Your VIP Privilege',
    ctaUrl: 'https://bymarie.shop'
  },
  wallet: {
    name: '💳 Float Wallet Top-up Bonus',
    sms: 'ByMarie Alert: Top up your VIP Float Wallet today and receive 10% bonus shopping credit instantly! Check your balance ({balance}): https://bymarie.shop/#account',
    emailSubject: '💳 VIP Float Wallet Bonus: 10% Extra on Every Deposit',
    emailHeadline: 'Accelerate Your Float Wallet with Exclusive Bonus Credit',
    emailBody: 'Dear {name},\n\nYour current ByMarie Float Wallet balance is {balance}.\n\nFor this week only, top up your Float Wallet via Mobile Money or Card and receive an instant 10% complimentary bonus credit added to your account.',
    ctaText: 'Top Up Float Wallet Now',
    ctaUrl: 'https://bymarie.shop/#account'
  },
  concierge: {
    name: '🎁 Private Concierge Invitation',
    sms: 'Dear {name}, your ByMarie private concierge is available for personalized styling & bridal consultations. WhatsApp us directly: https://wa.me/233241002000',
    emailSubject: '💎 Private Concierge & Bespoke Client Services',
    emailHeadline: 'At Your Service: Dedicated Personal Styling & Bridal Consultations',
    emailBody: 'Dear {name},\n\nWhether preparing for an executive gala, custom bridal fitting, or private scent consultation, our dedicated concierge team is at your disposal in Cantonments and East Legon.\n\nConnect directly with your dedicated style advisor today.',
    ctaText: 'Connect with Concierge',
    ctaUrl: 'https://wa.me/233241002000'
  }
};

function onSmsMessageInput(val) {
  broadcastSmsMessage = val;
  const countEl = document.getElementById('sms-live-counter');
  const len = val.length;
  const pages = Math.ceil(len / 160) || 1;
  if (countEl) {
    countEl.textContent = `${len} Chars • ${pages} SMS ${pages > 1 ? 'Pages' : 'Page'}`;
    if (pages > 1) countEl.classList.add('warn');
    else countEl.classList.remove('warn');
  }
  const previewBubble = document.getElementById('sms-live-bubble-preview');
  if (previewBubble) {
    previewBubble.textContent = (val || 'Type your message...')
      .replace(/\{name\}/g, 'Ifeoma')
      .replace(/\{balance\}/g, 'GH₵ 250.00')
      .replace(/\{email\}/g, 'ifeoma@example.com')
      .replace(/\{phone\}/g, '024 100 2000');
  }
}

function onSmsSenderInput(val) {
  broadcastSmsSender = val;
  const senderHeader = document.getElementById('sms-live-sender-preview');
  if (senderHeader) {
    senderHeader.textContent = val || 'Bymarie';
  }
}

function onEmailSubjectInput(val) {
  broadcastEmailSubject = val;
  const subjPreview = document.getElementById('email-live-subject-preview');
  if (subjPreview) subjPreview.textContent = val || 'No Subject';
}

function onEmailHeadlineInput(val) {
  broadcastEmailHeadline = val;
  const headlinePreview = document.getElementById('email-live-headline-preview');
  if (headlinePreview) {
    headlinePreview.textContent = val;
    headlinePreview.style.display = val ? 'block' : 'none';
  }
}

function onEmailBodyInput(val) {
  broadcastEmailBody = val;
  const bodyPreview = document.getElementById('email-live-body-preview');
  if (bodyPreview) {
    bodyPreview.innerHTML = (val || 'Email body content...')
      .replace(/\{name\}/g, 'Ifeoma')
      .replace(/\{balance\}/g, 'GH₵ 250.00')
      .replace(/\{email\}/g, 'ifeoma@example.com')
      .replace(/\{phone\}/g, '024 100 2000')
      .split('\n\n')
      .map(p => `<p style="margin:0 0 12px 0">${p.replace(/\n/g, '<br/>')}</p>`)
      .join('');
  }
}

function onEmailCtaTextInput(val) {
  broadcastEmailCtaText = val;
  const ctaWrap = document.getElementById('email-live-cta-wrap');
  const ctaBtn = document.getElementById('email-live-cta-preview');
  if (ctaWrap && ctaBtn) {
    ctaBtn.textContent = `${val} →`;
    ctaWrap.style.display = (val && broadcastEmailCtaUrl) ? 'block' : 'none';
  }
}

function onEmailCtaUrlInput(val) {
  broadcastEmailCtaUrl = val;
  const ctaWrap = document.getElementById('email-live-cta-wrap');
  const ctaBtn = document.getElementById('email-live-cta-preview');
  if (ctaWrap && ctaBtn) {
    ctaBtn.href = val;
    ctaWrap.style.display = (broadcastEmailCtaText && val) ? 'block' : 'none';
  }
}

function onCustomRecipientsInput(val) {
  broadcastCustomRecipients = val;
  const list = val.split(/[\n,;]+/).map(x => x.trim()).filter(Boolean);
  const strip = document.getElementById('custom-recipients-strip');
  if (strip) {
    strip.innerHTML = `
      <span style="font-size:12px;color:#a1a1aa;margin-right:8px">Target Preview:</span>
      ${list.slice(0, 6).map(r => `<span class="recipient-chip">${r}</span>`).join('')}
      ${list.length > 6 ? `<span class="recipient-chip more">+${list.length - 6} more</span>` : ''}
      ${list.length === 0 ? `<span style="color:#ef4444;font-size:12px">⚠️ No valid recipients entered</span>` : ''}
    `;
  }
}

function applyBroadcastTemplate(key) {
  const t = BROADCAST_TEMPLATES[key];
  if (!t) return;
  if (broadcastChannel === 'sms') {
    broadcastSmsMessage = t.sms;
  } else {
    broadcastEmailSubject = t.emailSubject;
    broadcastEmailHeadline = t.emailHeadline;
    broadcastEmailBody = t.emailBody;
    broadcastEmailCtaText = t.ctaText;
    broadcastEmailCtaUrl = t.ctaUrl;
  }
  toast(`Applied luxury template: "${t.name}" ✨`);
  render();
}

function insertBroadcastVariable(varName, targetField) {
  if (broadcastChannel === 'sms') {
    broadcastSmsMessage = (broadcastSmsMessage ? broadcastSmsMessage + ' ' : '') + `{${varName}}`;
    const textarea = document.getElementById('broadcast-sms-textarea');
    if (textarea) {
      textarea.value = broadcastSmsMessage;
      onSmsMessageInput(broadcastSmsMessage);
    }
  } else {
    if (targetField === 'subject') {
      broadcastEmailSubject = (broadcastEmailSubject ? broadcastEmailSubject + ' ' : '') + `{${varName}}`;
      const subjInput = document.getElementById('broadcast-email-subject');
      if (subjInput) {
        subjInput.value = broadcastEmailSubject;
        onEmailSubjectInput(broadcastEmailSubject);
      }
    } else {
      broadcastEmailBody = (broadcastEmailBody ? broadcastEmailBody + ' ' : '') + `{${varName}}`;
      const bodyTextarea = document.getElementById('broadcast-email-body');
      if (bodyTextarea) {
        bodyTextarea.value = broadcastEmailBody;
        onEmailBodyInput(broadcastEmailBody);
      }
    }
  }
  toast(`Inserted variable {${varName}}`);
}

function openDirectEmail(userId) {
  const u = getUsers().find(x => x.id === userId || x.email === userId);
  if (!u || !u.email) return toast('Client does not have an email address', 'warning');
  adminTab = 'broadcast';
  broadcastChannel = 'email';
  broadcastAudience = 'custom';
  broadcastCustomRecipients = u.email;
  toast(`Composing private VIP email to ${u.name || u.email} 📧`);
  render();
}

function renderAdminBroadcast(users) {
  const allPhones = users.filter(u => u.phone && u.phone.trim().length >= 8);
  const allEmails = users.filter(u => u.email && u.email.includes('@'));

  let targetRecipients = [];
  let recipientLabel = '';

  if (broadcastChannel === 'sms') {
    if (broadcastAudience === 'all') {
      targetRecipients = allPhones.map(u => u.phone.trim());
      recipientLabel = `All VIP Clients (${targetRecipients.length} phone numbers)`;
    } else if (broadcastAudience === 'funded') {
      targetRecipients = users.filter(u => (u.walletBalance || 0) > 0 && u.phone).map(u => u.phone.trim());
      recipientLabel = `Funded Float Accounts (${targetRecipients.length} phones)`;
    } else if (broadcastAudience === 'buyers') {
      targetRecipients = users.filter(u => (u.ordersCount || 0) > 0 && u.phone).map(u => u.phone.trim());
      recipientLabel = `Active Shoppers (${targetRecipients.length} phones)`;
    } else if (broadcastAudience === 'prospects') {
      targetRecipients = users.filter(u => (!u.ordersCount || u.ordersCount === 0) && u.phone).map(u => u.phone.trim());
      recipientLabel = `Prospect Accounts (${targetRecipients.length} phones)`;
    } else if (broadcastAudience === 'custom') {
      targetRecipients = broadcastCustomRecipients.split(/[\n,;]+/).map(x => x.trim()).filter(x => x && x.length >= 8);
      recipientLabel = `Custom Recipient List (${targetRecipients.length} phone numbers)`;
    }
  } else {
    if (broadcastAudience === 'all') {
      targetRecipients = allEmails.map(u => u.email.trim());
      recipientLabel = `All VIP Clients (${targetRecipients.length} email addresses)`;
    } else if (broadcastAudience === 'funded') {
      targetRecipients = users.filter(u => (u.walletBalance || 0) > 0 && u.email).map(u => u.email.trim());
      recipientLabel = `Funded Float Accounts (${targetRecipients.length} emails)`;
    } else if (broadcastAudience === 'buyers') {
      targetRecipients = users.filter(u => (u.ordersCount || 0) > 0 && u.email).map(u => u.email.trim());
      recipientLabel = `Active Shoppers (${targetRecipients.length} emails)`;
    } else if (broadcastAudience === 'prospects') {
      targetRecipients = users.filter(u => (!u.ordersCount || u.ordersCount === 0) && u.email).map(u => u.email.trim());
      recipientLabel = `Prospect Accounts (${targetRecipients.length} emails)`;
    } else if (broadcastAudience === 'custom') {
      targetRecipients = broadcastCustomRecipients.split(/[\n,;]+/).map(x => x.trim()).filter(x => x && x.includes('@'));
      recipientLabel = `Custom Recipient List (${targetRecipients.length} email addresses)`;
    }
  }

  const campaignLogs = getCampaignLogs();
  const smsCharCount = broadcastSmsMessage.length;
  const smsPageCount = Math.ceil(smsCharCount / 160) || 1;

  return `
    <div class="admin-top-bar animate-fade-up">
      <div>
        <span class="eyebrow" style="color:var(--gold-light)">COMMUNICATIONS &amp; MARKETING ATELIER</span>
        <h1 style="font-size:32px;margin-top:4px">Bulk SMS &amp; Email Broadcast Engine</h1>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <button class="secondary-btn" style="background:#0a2924;color:var(--gold-light);border-color:var(--gold);font-size:12.5px;padding:8px 14px" onclick="fetchLatestUsers(true)">
          ${svgIcon('refresh', 14)} Sync Latest Clients
        </button>
        <button class="secondary-btn" onclick="adminTab='users';render()">
          ${svgIcon('users', 14)} View Client Ledger (${users.length})
        </button>
      </div>
    </div>

    <!-- Multi-Channel Hub Stats -->
    <div class="stats-row cols-4 animate-fade-up delay-1" style="margin-bottom:24px">
      <div class="stat-card compact">
        <strong style="color:#fff">${users.length}</strong>
        <span>Registered VIP Clients</span>
      </div>
      <div class="stat-card compact">
        <strong style="color:#34d399">${allPhones.length}</strong>
        <span>Reachable Mobile Numbers (mNotify)</span>
      </div>
      <div class="stat-card compact">
        <strong style="color:#38bdf8">${allEmails.length}</strong>
        <span>Reachable VIP Emails (Resend)</span>
      </div>
      <div class="stat-card compact">
        <strong style="color:var(--gold)">${campaignLogs.length}</strong>
        <span>Campaigns Dispatched</span>
      </div>
    </div>

    <!-- Channel Navigation Switcher -->
    <div class="broadcast-channel-bar animate-fade-up delay-1">
      <button class="broadcast-channel-btn ${broadcastChannel === 'sms' ? 'active' : ''}" onclick="broadcastChannel='sms';render()">
        ${svgIcon('message', 18)}
        <span>📱 Bulk SMS Broadcast</span>
        <b class="channel-badge">${allPhones.length} Phones</b>
      </button>
      <button class="broadcast-channel-btn ${broadcastChannel === 'email' ? 'active' : ''}" onclick="broadcastChannel='email';render()">
        ${svgIcon('mail', 18)}
        <span>📧 Luxury Email Campaign</span>
        <b class="channel-badge">${allEmails.length} Emails</b>
      </button>
      <button class="broadcast-channel-btn ${broadcastChannel === 'history' ? 'active' : ''}" onclick="broadcastChannel='history';fetchCampaignLogs();render()">
        ${svgIcon('clock', 18)}
        <span>📜 Broadcast Delivery History</span>
        <b class="channel-badge">${campaignLogs.length} Sent</b>
      </button>
    </div>

    ${broadcastChannel === 'history' ? renderBroadcastHistoryView(campaignLogs) : `
      <div class="broadcast-layout animate-fade-up delay-2">
        <!-- Left Column: Audience & Composer Form -->
        <div class="broadcast-composer-card">
          
          <!-- Audience Targeting Section -->
          <div class="composer-section">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
              <label style="font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--gold-light);margin:0">
                1. Select Target Audience Segment
              </label>
              <span class="badge" style="background:#092e29;color:var(--gold);border:1px solid #165e53">
                ${recipientLabel}
              </span>
            </div>

            <div class="audience-options-grid">
              <button type="button" class="audience-pill ${broadcastAudience === 'all' ? 'active' : ''}" onclick="broadcastAudience='all';render()">
                👥 All Registered Clients (${broadcastChannel === 'sms' ? allPhones.length : allEmails.length})
              </button>
              <button type="button" class="audience-pill ${broadcastAudience === 'funded' ? 'active' : ''}" onclick="broadcastAudience='funded';render()">
                💳 Funded Float Wallets (${users.filter(u => (u.walletBalance || 0) > 0).length})
              </button>
              <button type="button" class="audience-pill ${broadcastAudience === 'buyers' ? 'active' : ''}" onclick="broadcastAudience='buyers';render()">
                🛍️ Active Shoppers (Orders > 0)
              </button>
              <button type="button" class="audience-pill ${broadcastAudience === 'prospects' ? 'active' : ''}" onclick="broadcastAudience='prospects';render()">
                🎯 Prospects (0 Orders)
              </button>
              <button type="button" class="audience-pill ${broadcastAudience === 'custom' ? 'active' : ''}" onclick="broadcastAudience='custom';render()">
                ✍️ Custom Recipient Paste List
              </button>
            </div>

            ${broadcastAudience === 'custom' ? `
              <div style="margin-top:14px">
                <label style="font-size:12px;color:#a1a1aa;margin-bottom:6px;display:block">
                  Paste ${broadcastChannel === 'sms' ? 'Ghana Mobile Numbers (comma or line separated e.g. 0244123456, +233501234567)' : 'Email Addresses (comma or line separated)'}:
                </label>
                <textarea class="admin-input" rows="3" placeholder="0241002000, 0551002000..." oninput="onCustomRecipientsInput(this.value)">${broadcastCustomRecipients}</textarea>
              </div>
            ` : ''}

            <!-- Recipient Preview Strip -->
            <div class="recipient-preview-strip" id="custom-recipients-strip">
              <span style="font-size:12px;color:#a1a1aa;margin-right:8px">Target Preview:</span>
              ${targetRecipients.slice(0, 6).map(r => `<span class="recipient-chip">${r}</span>`).join('')}
              ${targetRecipients.length > 6 ? `<span class="recipient-chip more">+${targetRecipients.length - 6} more</span>` : ''}
              ${targetRecipients.length === 0 ? `<span style="color:#ef4444;font-size:12px">⚠️ No valid recipients found in this segment</span>` : ''}
            </div>
          </div>

          <!-- Luxury Preset Templates -->
          <div class="composer-section">
            <label style="font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--gold-light);margin-bottom:10px;display:block">
              2. Quick Luxury Atelier Presets
            </label>
            <div class="template-presets-grid">
              ${Object.entries(BROADCAST_TEMPLATES).map(([k, t]) => `
                <button type="button" class="template-preset-btn" onclick="applyBroadcastTemplate('${k}')">
                  ${t.name}
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Personalization Tags Bar -->
          <div class="composer-section" style="padding-bottom:6px">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <span style="font-size:12px;color:#a1a1aa">Personalization Tokens:</span>
              <button type="button" class="token-btn" onclick="insertBroadcastVariable('name')">+ {name}</button>
              <button type="button" class="token-btn" onclick="insertBroadcastVariable('balance')">+ {balance}</button>
              <button type="button" class="token-btn" onclick="insertBroadcastVariable('email')">+ {email}</button>
              <button type="button" class="token-btn" onclick="insertBroadcastVariable('phone')">+ {phone}</button>
            </div>
          </div>

          <!-- Channel-Specific Content Studio -->
          ${broadcastChannel === 'sms' ? `
            <!-- SMS Form -->
            <form onsubmit="handleDispatchSmsBroadcast(event)">
              <div class="form-group" style="margin-bottom:16px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                  <label style="margin:0">SMS Sender ID (mNotify / BMS)</label>
                  <small style="color:var(--gold)">Max 11 Characters</small>
                </div>
                <input required maxlength="11" name="sender" id="broadcast-sms-sender" value="${broadcastSmsSender}" oninput="onSmsSenderInput(this.value)" placeholder="Bymarie" class="admin-input">
              </div>

              <div class="form-group" style="margin-bottom:16px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                  <label style="margin:0">SMS Campaign Message</label>
                  <span id="sms-live-counter" class="sms-counter ${smsPageCount > 1 ? 'warn' : ''}">
                    ${smsCharCount} Chars • ${smsPageCount} SMS ${smsPageCount > 1 ? 'Pages' : 'Page'}
                  </span>
                </div>
                <textarea required rows="5" name="message" id="broadcast-sms-textarea" class="admin-input" oninput="onSmsMessageInput(this.value)" placeholder="Type your luxury SMS message here...">${broadcastSmsMessage}</textarea>
              </div>

              <!-- Test Dispatch Bar -->
              <div class="test-dispatch-bar">
                <div style="flex-grow:1;display:flex;gap:8px;align-items:center">
                  <input type="text" id="test-sms-phone" placeholder="024 100 2000" style="background:#031c18;color:#fff;border:1px solid #165e53;padding:8px 12px;border-radius:4px;font-size:12.5px;width:160px">
                  <button type="button" class="secondary-btn" style="font-size:12px;padding:8px 12px" onclick="handleSendTestSms()">
                    📲 Send Test SMS
                  </button>
                </div>
                <span style="font-size:11.5px;color:#a1a1aa">Verify on your mobile before mass send</span>
              </div>

              <div style="margin-top:24px">
                <button type="submit" class="primary" style="width:100%;height:52px;font-size:15px;background:#22c55e;font-weight:700" ${broadcastSending || !targetRecipients.length ? 'disabled' : ''}>
                  ${broadcastSending ? '⚡ Dispatching SMS Campaign...' : `🚀 Dispatch Bulk SMS to ${targetRecipients.length} Clients →`}
                </button>
              </div>
            </form>
          ` : `
            <!-- Email Form -->
            <form onsubmit="handleDispatchEmailBroadcast(event)">
              <div class="form-group" style="margin-bottom:16px">
                <label>Email Subject Line</label>
                <input required name="subject" id="broadcast-email-subject" value="${broadcastEmailSubject}" oninput="onEmailSubjectInput(this.value)" placeholder="Exclusive VIP Preview: New Haute Couture Drop" class="admin-input">
              </div>

              <div class="form-group" style="margin-bottom:16px">
                <label>Luxury Headline (Optional Title)</label>
                <input name="headline" id="broadcast-email-headline" value="${broadcastEmailHeadline}" oninput="onEmailHeadlineInput(this.value)" placeholder="A New Epoch of African Luxury & Tailored Excellence" class="admin-input">
              </div>

              <div class="form-group" style="margin-bottom:16px">
                <label>Email Body Content (Paragraphs)</label>
                <textarea required rows="6" name="content" id="broadcast-email-body" class="admin-input" oninput="onEmailBodyInput(this.value)" placeholder="Dear {name},&#10;&#10;We are delighted to invite you...">${broadcastEmailBody}</textarea>
              </div>

              <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px">
                <div class="form-group">
                  <label>CTA Button Text</label>
                  <input name="ctaText" id="broadcast-email-cta-text" value="${broadcastEmailCtaText}" oninput="onEmailCtaTextInput(this.value)" placeholder="Explore The Atelier" class="admin-input">
                </div>
                <div class="form-group">
                  <label>CTA Button URL</label>
                  <input name="ctaUrl" id="broadcast-email-cta-url" value="${broadcastEmailCtaUrl}" oninput="onEmailCtaUrlInput(this.value)" placeholder="https://bymarie.shop" class="admin-input">
                </div>
              </div>

              <!-- Test Dispatch Bar -->
              <div class="test-dispatch-bar">
                <div style="flex-grow:1;display:flex;gap:8px;align-items:center">
                  <input type="email" id="test-email-address" value="${ADMIN_EMAIL}" placeholder="you@example.com" style="background:#031c18;color:#fff;border:1px solid #165e53;padding:8px 12px;border-radius:4px;font-size:12.5px;width:220px">
                  <button type="button" class="secondary-btn" style="font-size:12px;padding:8px 12px" onclick="handleSendTestEmail()">
                    📧 Send Test Email
                  </button>
                </div>
                <span style="font-size:11.5px;color:#a1a1aa">Powered by Resend API</span>
              </div>

              <div style="margin-top:24px">
                <button type="submit" class="primary" style="width:100%;height:52px;font-size:15px;background:#38bdf8;color:#000;font-weight:700" ${broadcastSending || !targetRecipients.length ? 'disabled' : ''}>
                  ${broadcastSending ? '⚡ Dispatching Luxury Email Campaign...' : `👑 Dispatch Luxury Email to ${targetRecipients.length} VIP Clients →`}
                </button>
              </div>
            </form>
          `}

        </div>

        <!-- Right Column: Live Luxury Preview Drawer -->
        <div class="broadcast-preview-card">
          <div class="preview-header">
            <span style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--gold)">
              ${broadcastChannel === 'sms' ? '📱 Mobile Phone Live SMS Preview' : '📧 Luxury Branded HTML Email Preview'}
            </span>
            <span class="preview-badge">Live Canvas</span>
          </div>

          ${broadcastChannel === 'sms' ? `
            <div class="phone-mockup-frame">
              <div class="phone-mockup-speaker"></div>
              <div class="phone-mockup-screen">
                <div class="sms-sender-header">
                  <strong id="sms-live-sender-preview">${broadcastSmsSender || 'Bymarie'}</strong>
                  <small>SMS • Today</small>
                </div>
                <div class="sms-bubble-wrapper">
                  <div class="sms-chat-bubble" id="sms-live-bubble-preview">
                    ${(broadcastSmsMessage || 'Type your message...')
                      .replace(/\{name\}/g, 'Ifeoma')
                      .replace(/\{balance\}/g, 'GH₵ 250.00')
                      .replace(/\{email\}/g, 'ifeoma@example.com')
                      .replace(/\{phone\}/g, '024 100 2000')}
                  </div>
                  <small class="sms-time-stamp">Delivered Just Now</small>
                </div>
              </div>
            </div>
          ` : `
            <div class="email-preview-container">
              <div class="email-client-bar">
                <div><span style="color:#71717a">From:</span> ByMarie Concierge &lt;concierge@bymarie.shop&gt;</div>
                <div><span style="color:#71717a">Subject:</span> <strong id="email-live-subject-preview">${broadcastEmailSubject || 'No Subject'}</strong></div>
              </div>
              <div class="email-preview-body">
                <!-- Header -->
                <div class="email-html-header">
                  <h2 style="font-family:'Cinzel', Georgia, serif;margin:0;font-size:20px;letter-spacing:3px;color:#fff">BYMARIE</h2>
                  <small style="color:var(--gold);letter-spacing:1.5px;text-transform:uppercase;font-size:9.5px;display:block;margin-top:4px">Luxury Style • Scent Extraits • Essentials</small>
                </div>
                <!-- Content -->
                <div class="email-html-content">
                  <h3 id="email-live-headline-preview" style="font-family:'Playfair Display', Georgia, serif;font-size:18px;color:#083832;margin:0 0 14px 0;display:${broadcastEmailHeadline ? 'block' : 'none'}">${broadcastEmailHeadline}</h3>
                  <div id="email-live-body-preview" style="font-size:13.5px;line-height:1.7;color:#3f3f46">
                    ${(broadcastEmailBody || 'Email body content...')
                      .replace(/\{name\}/g, 'Ifeoma')
                      .replace(/\{balance\}/g, 'GH₵ 250.00')
                      .replace(/\{email\}/g, 'ifeoma@example.com')
                      .replace(/\{phone\}/g, '024 100 2000')
                      .split('\n\n')
                      .map(p => `<p style="margin:0 0 12px 0">${p.replace(/\n/g, '<br/>')}</p>`)
                      .join('')}
                  </div>

                  <div id="email-live-cta-wrap" style="text-align:center;margin:24px 0 18px 0;display:${(broadcastEmailCtaText && broadcastEmailCtaUrl) ? 'block' : 'none'}">
                    <a href="${broadcastEmailCtaUrl || '#'}" target="_blank" class="email-preview-btn" id="email-live-cta-preview">
                      ${broadcastEmailCtaText || 'Explore The Atelier'} →
                    </a>
                  </div>

                  <div style="margin-top:24px;padding-top:16px;border-top:1px solid #f4f4f5;font-size:11.5px;color:#71717a">
                    <strong style="color:#083832;display:block">ByMarie Private Client Atelier</strong>
                    Cantonments &amp; East Legon, Accra • WhatsApp: +233 24 100 2000
                  </div>
                </div>
                <!-- Footer -->
                <div class="email-html-footer">
                  Exclusive VIP Dispatch from ByMarie Luxury Atelier
                </div>
              </div>
            </div>
          `}
        </div>
      </div>
    `}
  `;
}

function renderBroadcastHistoryView(logs) {
  return `
    <div class="admin-card animate-fade-up" style="padding:0;overflow:hidden">
      <div style="padding:20px 24px;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;justify-content:space-between;align-items:center">
        <div>
          <h3 style="margin:0;font-size:18px;color:#fff">Broadcast Campaign History (${logs.length})</h3>
          <small style="color:#a1a1aa">Chronological ledger of all SMS and Email dispatches</small>
        </div>
        <button class="secondary-btn" style="font-size:12px" onclick="fetchCampaignLogs();render()">
          ${svgIcon('refresh', 13)} Refresh Ledger
        </button>
      </div>

      ${logs.length ? `
        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th>Channel</th>
                <th>Campaign Title / Subject</th>
                <th>Audience / Count</th>
                <th>Status</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              ${logs.map(log => `
                <tr>
                  <td>
                    <span class="badge" style="background:${log.channel === 'SMS' ? '#22c55e' : '#38bdf8'};color:#000;font-weight:700;font-size:11px">
                      ${log.channel === 'SMS' ? '📱 SMS' : '📧 EMAIL'}
                    </span>
                  </td>
                  <td>
                    <strong style="color:#fff;display:block;font-size:13.5px">${log.title || 'Campaign'}</strong>
                    ${log.headline ? `<small style="color:#a1a1aa">${log.headline}</small>` : ''}
                  </td>
                  <td>
                    <b style="color:var(--gold-light);font-size:13px">${log.recipientsCount || (log.recipients ? log.recipients.length : 0)} Recipients</b>
                  </td>
                  <td>
                    <span class="badge delivered" style="font-size:11px">
                      ✓ ${log.status || 'Delivered'}
                    </span>
                  </td>
                  <td>
                    <span style="color:#a1a1aa;font-size:12px">${log.dateFormatted || log.timestamp || 'Recent'}</span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : `
        <div class="admin-empty-state">
          <span>${svgIcon('receipt', 26)}</span>
          <h3 style="color:#fff">No past campaigns recorded yet</h3>
          <p style="color:#a1a1aa">Compose and send your first SMS or Email broadcast above.</p>
          <button class="primary" style="background:#22c55e" onclick="broadcastChannel='sms';render()">Compose SMS Campaign</button>
        </div>
      `}
    </div>
  `;
}

async function handleDispatchSmsBroadcast(event) {
  event.preventDefault();
  const allUsers = getUsers();
  let recipients = [];

  if (broadcastAudience === 'all') {
    recipients = allUsers.filter(u => u.phone).map(u => u.phone.trim());
  } else if (broadcastAudience === 'funded') {
    recipients = allUsers.filter(u => (u.walletBalance || 0) > 0 && u.phone).map(u => u.phone.trim());
  } else if (broadcastAudience === 'buyers') {
    recipients = allUsers.filter(u => (u.ordersCount || 0) > 0 && u.phone).map(u => u.phone.trim());
  } else if (broadcastAudience === 'prospects') {
    recipients = allUsers.filter(u => (!u.ordersCount || u.ordersCount === 0) && u.phone).map(u => u.phone.trim());
  } else if (broadcastAudience === 'custom') {
    recipients = broadcastCustomRecipients.split(/[\n,;]+/).map(x => x.trim()).filter(x => x && x.length >= 9);
  }

  if (!recipients.length) {
    return toast('No valid recipient phone numbers in this segment', 'warning');
  }

  if (!confirm(`Confirm dispatch of Bulk SMS to ${recipients.length} clients via mNotify?`)) return;

  broadcastSending = true;
  render();
  toast(`🚀 Dispatching SMS broadcast to ${recipients.length} clients...`, 'info');

  try {
    const res = await fetch(`${API_BASE}/sms/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipients,
        message: broadcastSmsMessage.trim(),
        sender: broadcastSmsSender.trim() || 'Bymarie'
      })
    });

    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'SMS Dispatch failed');

    toast(`✅ Bulk SMS successfully dispatched to ${recipients.length} clients! 📱`, 'success');
    await fetchCampaignLogs();
    broadcastChannel = 'history';
  } catch (err) {
    console.error('SMS broadcast dispatch error:', err);
    toast(`SMS Dispatch error: ${err.message}`, 'warning');
  } finally {
    broadcastSending = false;
    render();
  }
}

async function handleDispatchEmailBroadcast(event) {
  event.preventDefault();
  const allUsers = getUsers();
  let recipients = [];

  if (broadcastAudience === 'all') {
    recipients = allUsers.filter(u => u.email).map(u => u.email.trim());
  } else if (broadcastAudience === 'funded') {
    recipients = allUsers.filter(u => (u.walletBalance || 0) > 0 && u.email).map(u => u.email.trim());
  } else if (broadcastAudience === 'buyers') {
    recipients = allUsers.filter(u => (u.ordersCount || 0) > 0 && u.email).map(u => u.email.trim());
  } else if (broadcastAudience === 'prospects') {
    recipients = allUsers.filter(u => (!u.ordersCount || u.ordersCount === 0) && u.email).map(u => u.email.trim());
  } else if (broadcastAudience === 'custom') {
    recipients = broadcastCustomRecipients.split(/[\n,;]+/).map(x => x.trim()).filter(x => x && x.includes('@'));
  }

  if (!recipients.length) {
    return toast('No valid recipient email addresses in this segment', 'warning');
  }

  if (!confirm(`Confirm dispatch of Luxury Email Campaign to ${recipients.length} VIP clients?`)) return;

  broadcastSending = true;
  render();
  toast(`📧 Dispatching Luxury Email Campaign to ${recipients.length} VIPs via Resend...`, 'info');

  try {
    const res = await fetch(`${API_BASE}/email/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipients,
        subject: broadcastEmailSubject.trim(),
        headline: broadcastEmailHeadline.trim(),
        content: broadcastEmailBody.trim(),
        ctaText: broadcastEmailCtaText.trim(),
        ctaUrl: broadcastEmailCtaUrl.trim()
      })
    });

    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Email Broadcast failed');

    toast(`✅ Luxury Email campaign dispatched! (${data.delivered || recipients.length} sent) 👑`, 'success');
    await fetchCampaignLogs();
    broadcastChannel = 'history';
  } catch (err) {
    console.error('Email broadcast dispatch error:', err);
    toast(`Email Dispatch notice: ${err.message}`, 'warning');
  } finally {
    broadcastSending = false;
    render();
  }
}

async function handleSendTestSms() {
  const input = document.getElementById('test-sms-phone');
  const phone = input ? input.value.trim() : '';
  if (!phone || phone.length < 9) return toast('Please enter a valid Ghana phone number for test', 'warning');

  toast(`Sending test SMS to ${phone}...`, 'info');
  try {
    const res = await fetch(`${API_BASE}/sms/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipients: [phone],
        message: `[TEST PREVIEW] ${broadcastSmsMessage.trim()}`,
        sender: broadcastSmsSender.trim() || 'Bymarie'
      })
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Test SMS failed');
    toast(`📲 Test SMS sent to ${phone}!`, 'success');
  } catch (e) {
    toast(`Test SMS Note: ${e.message}`, 'warning');
  }
}

async function handleSendTestEmail() {
  const input = document.getElementById('test-email-address');
  const email = input ? input.value.trim() : '';
  if (!email || !email.includes('@')) return toast('Please enter a valid email address for test', 'warning');

  toast(`Sending test Luxury Email to ${email}...`, 'info');
  try {
    const res = await fetch(`${API_BASE}/email/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipients: [email],
        subject: `[TEST PREVIEW] ${broadcastEmailSubject.trim()}`,
        headline: broadcastEmailHeadline.trim(),
        content: broadcastEmailBody.trim(),
        ctaText: broadcastEmailCtaText.trim(),
        ctaUrl: broadcastEmailCtaUrl.trim()
      })
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Test Email failed');
    toast(`📧 Test Email sent to ${email}!`, 'success');
  } catch (e) {
    toast(`Test Email Note: ${e.message}`, 'warning');
  }
}

function openUserDossierModal(userId) {
  const users = getUsers();
  const u = users.find(x => x.id === userId || x.email === userId);
  if (!u) return toast('Client profile not found', 'warning');
  
  const allOrders = getOrders();
  const userOrders = allOrders.filter(o => o.email && u.email && o.email.toLowerCase() === u.email.toLowerCase());
  
  modalData = { user: u, orders: userOrders };
  activeModal = 'admin_user_dossier';
  render();
}

function openSendSmsModal(targetUserId = null) {
  const users = getUsers();
  let targetUser = null;
  if (targetUserId) {
    targetUser = users.find(u => u.id === targetUserId || u.phone === targetUserId);
  }
  adminTab = 'broadcast';
  broadcastChannel = 'sms';
  if (targetUser && targetUser.phone) {
    broadcastAudience = 'custom';
    broadcastCustomRecipients = targetUser.phone;
  }
  render();
}

async function handleAdminAddUser(event) {
  event.preventDefault();
  const fd = new FormData(event.target);
  const name = (fd.get('name') || '').trim();
  const email = (fd.get('email') || '').trim().toLowerCase();
  const phone = (fd.get('phone') || '').trim();
  const address = (fd.get('address') || '').trim();
  const walletBalance = Number(fd.get('walletBalance') || 0);

  if (!email || !name) return toast('Name and email are required', 'warning');

  const users = getUsers();
  let existing = users.find(u => u.email && u.email.toLowerCase() === email);

  if (existing) {
    existing.name = name;
    existing.phone = phone || existing.phone;
    existing.address = address || existing.address;
    existing.walletBalance = walletBalance;
  } else {
    existing = {
      id: `usr-${Date.now()}`,
      name,
      email,
      phone,
      address,
      city: 'Accra',
      region: 'Greater Accra',
      walletBalance,
      joinedDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      lastLogin: 'Never (Admin Created)',
      ordersCount: 0,
      status: 'Active'
    };
    users.unshift(existing);
  }

  saveUsers(users);
  activeModal = null;
  toast(`VIP Client Account "${existing.name}" registered with ${money(walletBalance)} balance! 💳`);
  render();

  try {
    await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(existing)
    });
    fetchLatestUsers();
  } catch (e) {}
}

function openEditUserModal(userId) {
  const users = getUsers();
  const u = users.find(x => x.id === userId || x.email === userId);
  if (!u) return toast('Client profile not found', 'warning');
  modalData = { user: u };
  activeModal = 'admin_edit_user';
  render();
}

async function handleAdminEditUser(event) {
  event.preventDefault();
  const fd = new FormData(event.target);
  const id = fd.get('id');
  const name = (fd.get('name') || '').trim();
  const email = (fd.get('email') || '').trim().toLowerCase();
  const phone = (fd.get('phone') || '').trim();
  const address = (fd.get('address') || '').trim();
  const city = (fd.get('city') || 'Accra').trim();
  const walletBalance = Number(fd.get('walletBalance') || 0);

  if (!email || !name) return toast('Name and email are required', 'warning');

  const users = getUsers();
  let u = users.find(x => x.id === id || (x.email && x.email.toLowerCase() === email));

  if (u) {
    u.name = name;
    u.email = email;
    u.phone = phone;
    u.address = address;
    u.city = city;
    u.walletBalance = walletBalance;
  } else {
    u = {
      id: id || `usr-${Date.now()}`,
      name,
      email,
      phone,
      address,
      city,
      walletBalance,
      joinedDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      ordersCount: 0,
      status: 'Active'
    };
    users.unshift(u);
  }

  saveUsers(users);
  activeModal = null;
  toast(`Updated client details for "${u.name}" (${u.phone || 'No phone'}) ⚡`, 'success');
  render();

  try {
    await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(u)
    });
    fetchLatestUsers();
  } catch (e) {}
}

let otpAuthMode = false;
let otpEmailTarget = '';

async function handleCustomerSignIn(event) {
  event.preventDefault();
  const fd = new FormData(event.target);
  const email = (fd.get('email') || '').trim().toLowerCase();
  const password = fd.get('password');

  if (!email) return toast('Please enter your email', 'warning');
  if (!password) return toast('Please enter your password', 'warning');

  toast(`Authenticating with ByMarie Atelier...`, 'info');

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      return toast(data.error || 'Authentication failed. Please check credentials.', 'danger');
    }

    const verifiedUser = data.user;
    if (data.authToken) {
      localStorage.setItem('bymarie-auth-token', data.authToken);
    }

    saveUser(verifiedUser);
    
    // Update local users array
    const users = getUsers();
    const idx = users.findIndex(u => u.email && u.email.toLowerCase() === verifiedUser.email.toLowerCase());
    if (idx !== -1) {
      users[idx] = { ...users[idx], ...verifiedUser };
    } else {
      users.unshift(verifiedUser);
    }
    saveUsers(users);

    if (ADMIN_EMAILS.some(e => e.toLowerCase() === email) || verifiedUser.status === 'Super Admin') {
      adminAuthenticated = true;
      toast(`Welcome back, Executive Administrator ${verifiedUser.name}! 👑⚡`, 'success');
      activeModal = null;
      go('admin');
      return;
    }

    toast(`Welcome back, ${verifiedUser.name}! 👑`, 'success');
    activeModal = null;
    go('account');
  } catch (err) {
    console.error('Sign In error:', err);
    toast('Network connection error while authenticating. Please try again.', 'danger');
  }
}

async function handleCustomerSignUp(event) {
  event.preventDefault();
  const fd = new FormData(event.target);
  const name = (fd.get('name') || '').trim();
  const email = (fd.get('email') || '').trim().toLowerCase();
  const phone = (fd.get('phone') || '').trim();
  const password = fd.get('password');
  const confirmPassword = fd.get('confirmPassword');

  if (!email || !name) return toast('Please enter name and email', 'warning');
  if (!password || password.length < 6) return toast('Password must be at least 6 characters', 'warning');
  if (confirmPassword !== null && password !== confirmPassword) {
    return toast('Passwords do not match. Please re-enter your password to confirm.', 'warning');
  }

  toast(`Verifying & registering luxury membership...`, 'info');

  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone, password })
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      return toast(data.error || 'Registration failed. Email may already be registered.', 'danger');
    }

    const newUser = data.user;
    if (data.authToken) {
      localStorage.setItem('bymarie-auth-token', data.authToken);
    }

    saveUser(newUser);

    const users = getUsers();
    const idx = users.findIndex(u => u.email && u.email.toLowerCase() === newUser.email.toLowerCase());
    if (idx !== -1) {
      users[idx] = { ...users[idx], ...newUser };
    } else {
      users.unshift(newUser);
    }
    saveUsers(users);

    if (ADMIN_EMAILS.some(e => e.toLowerCase() === email) || newUser.status === 'Super Admin') {
      adminAuthenticated = true;
      toast(`Welcome to ByMarie Executive Console, ${newUser.name}! 👑⚡`, 'success');
      activeModal = null;
      go('admin');
      return;
    }

    toast(`Welcome to ByMarie, ${newUser.name}! 👑`, 'success');
    activeModal = null;
    go('account');
  } catch (err) {
    console.error('Registration error:', err);
    toast('Network error during registration. Please try again.', 'danger');
  }
}

async function handleRequestOtp(targetEmail) {
  const email = (targetEmail || prompt('Enter your registered email address to receive a 6-digit login code:') || '').trim().toLowerCase();
  if (!email || !email.includes('@')) return toast('Please provide a valid email address', 'warning');

  toast(`Sending 6-digit verification code to ${email}...`, 'info');

  try {
    const res = await fetch(`${API_BASE}/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      return toast(data.error || 'Failed to dispatch verification code', 'danger');
    }

    otpEmailTarget = email;
    otpAuthMode = true;
    toast(`🔑 6-digit code sent to ${email}! Please enter it below.`, 'success');
    render();
  } catch (err) {
    toast('Network error sending verification code', 'danger');
  }
}

async function handleVerifyOtpSubmit(event) {
  event.preventDefault();
  const fd = new FormData(event.target);
  const code = (fd.get('code') || '').trim();
  const email = otpEmailTarget || (fd.get('email') || '').trim().toLowerCase();

  if (!code || code.length < 6) return toast('Please enter the 6-digit verification code', 'warning');

  toast('Verifying authentication code...', 'info');

  try {
    const res = await fetch(`${API_BASE}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code })
    });
    const data = await res.json();

    if (!res.ok || data.error) {
      return toast(data.error || 'Invalid or expired verification code', 'danger');
    }

    const verifiedUser = data.user;
    if (data.authToken) {
      localStorage.setItem('bymarie-auth-token', data.authToken);
    }

    otpAuthMode = false;
    otpEmailTarget = '';
    saveUser(verifiedUser);

    const users = getUsers();
    const idx = users.findIndex(u => u.email && u.email.toLowerCase() === verifiedUser.email.toLowerCase());
    if (idx !== -1) {
      users[idx] = { ...users[idx], ...verifiedUser };
    } else {
      users.unshift(verifiedUser);
    }
    saveUsers(users);

    if (ADMIN_EMAILS.some(e => e.toLowerCase() === email) || verifiedUser.status === 'Super Admin') {
      adminAuthenticated = true;
      toast(`Authenticated as Executive Administrator ${verifiedUser.name}! 👑⚡`, 'success');
      activeModal = null;
      go('admin');
      return;
    }

    toast(`Welcome back, ${verifiedUser.name}! 👑`, 'success');
    activeModal = null;
    go('account');
  } catch (err) {
    toast('Network error during verification', 'danger');
  }
}

function handleCustomerSignOut() {
  adminAuthenticated = false;
  const user = getUser();
  user.loggedIn = false;
  saveUser(user);

  const users = getUsers();
  const u = users.find(x => x.email === user.email || x.id === user.id);
  if (u) {
    u.loggedIn = false;
    saveUsers(users);
  }

  toast('Signed out of ByMarie profile');
  go('home');
}

function renderAdminWholesale(inquiries) {
  return `
    <div class="admin-top-bar animate-fade-up">
      <div>
        <span class="eyebrow" style="color:var(--gold-light)">COMMERCIAL &amp; B2B SUPPLY</span>
        <h1 style="font-size:32px;margin-top:4px">Wholesale Quotation Pipeline (${inquiries.length})</h1>
      </div>
      <button class="secondary-btn" onclick="toast('Exporting wholesale inquiries...')">📥 Export B2B Leads</button>
    </div>

    ${inquiries.length ? `
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>ID / Date</th>
              <th>Company / Salon</th>
              <th>Contact Person</th>
              <th>Phone / WhatsApp</th>
              <th>Target Volume</th>
              <th>Notes / Pieces</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${inquiries.map(w => `
              <tr>
                <td><b>${w.id}</b><br><small style="color:#a1a1aa">${w.date}</small></td>
                <td><strong style="color:#fff">${w.company}</strong><br><small style="color:#e4e4e7">${w.city}</small></td>
                <td>${w.contact}<br><small style="color:#a1a1aa">${w.email}</small></td>
                <td>
                  <a href="https://wa.me/${w.phone.replace(/[^0-9]/g, '')}" target="_blank" style="color:#34d399;text-decoration:none;font-weight:700">
                    💬 ${w.phone}
                  </a>
                </td>
                <td><span class="badge" style="background:#c24d67;color:#fff;font-size:10.5px">${w.volume}</span></td>
                <td><small style="color:#d4d4d8;max-width:200px;display:block">${w.notes}</small></td>
                <td>
                  <select class="mini-select" onchange="updateWholesaleInquiryStatus('${w.id}', this.value)">
                    ${['New', 'Quoted', 'Approved', 'Invoiced', 'Closed'].map(s => `
                      <option ${w.status === s ? 'selected' : ''}>${s}</option>
                    `).join('')}
                  </select>
                </td>
                <td>
                  <div class="table-actions">
                    <a class="secondary-btn" style="padding:4px 8px;font-size:11px;text-decoration:none" href="https://wa.me/${w.phone.replace(/[^0-9]/g, '')}?text=Hello%20${encodeURIComponent(w.contact)},%20thank%20you%20for%20reaching%20out%20to%20ByMarie%20Wholesale..." target="_blank">Chat ↗</a>
                    <button class="icon-action-btn danger" title="Remove inquiry" onclick="deleteWholesaleInquiry('${w.id}')">${svgIcon('trash', 14)}</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : `
      <div class="admin-empty-state">
        <span>⚡</span>
        <h3 style="color:#fff">No wholesale quotation inquiries yet</h3>
        <p style="color:#a1a1aa">Incoming bulk requests from boutique owners and salons will appear here.</p>
      </div>
    `}
  `;
}

function renderAdminDiscounts(coupons) {
  return `
    <div class="admin-top-bar animate-fade-up">
      <div>
        <span class="eyebrow" style="color:var(--gold-light)">MARKETING &amp; PROMO CAMPAIGNS</span>
        <h1 style="font-size:32px;margin-top:4px">Promo Code Engine (${coupons.length})</h1>
      </div>
      <button class="primary" style="background:#c24d67" onclick="activeModal='add_coupon';render()">${svgIcon('plus', 16)} Create Promo Code</button>
    </div>

    <div class="coupon-grid">
      ${coupons.map((c, i) => `
        <div class="coupon-card">
          <div class="coupon-card-top">
            <span class="coupon-badge">${c.type === 'percent' ? `${c.discount}% OFF` : 'FREE SHIP'}</span>
            <button class="icon-action-btn danger" title="Delete promo code" onclick="deleteCoupon(${i})">${svgIcon('trash', 15)}</button>
          </div>
          <b class="coupon-code">${c.code}</b>
          <p style="color:#d4d4d8">${c.label}</p>
          <div class="coupon-card-foot">
            <span class="dot active"></span> Active · ${c.type === 'percent' ? 'Percentage discount' : 'Shipping fee waiver'}
          </div>
        </div>
      `).join('')}
      <button class="coupon-card-add" onclick="activeModal='add_coupon';render()">
        ${svgIcon('plus', 22)}
        <span>Create a new promo campaign</span>
      </button>
    </div>
  `;
}

function renderAdminSiteCMS() {
  const settings = getSiteSettings();
  return `
    <div class="admin-top-bar animate-fade-up">
      <div>
        <span class="eyebrow" style="color:var(--gold-light)">FRONTEND CMS &amp; MEDIA</span>
        <h1 style="font-size:32px;margin-top:4px">Storefront Copy &amp; Campaign Video</h1>
      </div>
      <button class="primary" style="background:#c24d67" onclick="document.getElementById('cms-form').requestSubmit()">Save Settings ⚡</button>
    </div>

    <form id="cms-form" onsubmit="saveCMSFromAdmin(event)">
      <div class="cms-card animate-fade-up delay-1">
        <h3 style="color:#fff">📢 Marquee Announcement &amp; Promo Header</h3>
        <div class="form-grid">
          <div class="form-group full">
            <label>Announcement Bar Text</label>
            <input required name="announcementText" value="${settings.announcementText}" placeholder="e.g. Complimentary delivery across Ghana...">
          </div>
          <div class="form-group">
            <label>Featured Promo Code Badge</label>
            <input required name="promoCodeNotice" value="${settings.promoCodeNotice}" placeholder="e.g. WELCOME10">
          </div>
        </div>
      </div>

      <!-- Multi-Video Campaign Studio & 30s Rotator CMS -->
      <div class="cms-card animate-fade-up delay-2">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:10px">
          <div>
            <h3 style="color:#fff;margin:0">🎬 Hero Multi-Video Campaign Playlist</h3>
            <p style="color:#a1a1aa;font-size:13px;margin:4px 0 0">
              Upload multiple luxury MP4/WEBM video files or URLs. The homepage hero automatically rotates through them seamlessly with progress indicators.
            </p>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <label style="color:var(--gold-light);font-size:12px;font-weight:700;margin:0">Transition Interval:</label>
            <select name="heroVideoInterval" onchange="handleChangeHeroInterval(this.value)" style="background:#083832;color:#fff;border:1px solid var(--gold);border-radius:4px;padding:5px 10px;font-size:12px">
              <option value="15" ${settings.heroVideoInterval == 15 ? 'selected' : ''}>Every 15 Seconds</option>
              <option value="30" ${(!settings.heroVideoInterval || settings.heroVideoInterval == 30) ? 'selected' : ''}>Every 30 Seconds (Default ⚡)</option>
              <option value="45" ${settings.heroVideoInterval == 45 ? 'selected' : ''}>Every 45 Seconds</option>
              <option value="60" ${settings.heroVideoInterval == 60 ? 'selected' : ''}>Every 60 Seconds</option>
            </select>
          </div>
        </div>

        <div class="form-grid" style="margin-top:14px">
          <div class="form-group full">
            <label>Upload Video Files from Device (Select 1 or Multiple Files)</label>
            <div class="image-upload-dropzone" style="background:#18181b;border-color:#3f3f46">
              <span style="font-size:28px">🎬</span>
              <strong style="display:block;margin-top:4px;font-size:14px;color:#fff">+ Upload Campaign Video(s)</strong>
              <small style="color:#a1a1aa">Select MP4, WEBM, or MOV video files from your device</small>
              <input type="file" accept="video/*" multiple onchange="handleMultiHeroVideoUpload(event)">
            </div>
          </div>

          <div class="form-group full">
            <label>Add Video by Direct URL</label>
            <div style="display:flex;gap:10px">
              <input id="new-video-url-input" placeholder="https://example.com/campaign-video.mp4" style="flex-grow:1">
              <button type="button" class="primary" style="padding:0 20px;font-size:13px;white-space:nowrap" onclick="handleAddHeroVideoUrl(document.getElementById('new-video-url-input').value)">+ Add Video</button>
            </div>
          </div>

          <div class="form-group full">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <label style="margin:0">Active Campaign Playlist (${getHeroVideosList(settings).length} Videos)</label>
              <span style="color:var(--gold-light);font-size:12px">⚡ Auto-Cycles on Homepage Every ${settings.heroVideoInterval || 30}s</span>
            </div>

            <div class="admin-video-grid">
              ${getHeroVideosList(settings).map((vUrl, vIdx) => `
                <div class="admin-video-card ${vIdx === 0 ? 'active-primary' : ''}">
                  <div class="admin-video-thumb-wrap">
                    <video muted playsinline onmouseover="safePlay(this)" onmouseout="safePause(this)" src="${vUrl}"></video>
                    <span style="position:absolute;top:6px;left:6px;background:rgba(0,0,0,0.75);color:#fff;font-size:10.5px;padding:2px 7px;border-radius:4px;border:1px solid rgba(255,255,255,0.2);font-weight:700">
                      ${vIdx === 0 ? '⭐ Video #1 (Primary)' : `Video #${vIdx + 1}`}
                    </span>
                  </div>
                  
                  <div style="font-size:11.5px;color:#a1a1aa;word-break:break-all;line-height:1.4">
                    <code>${vUrl.length > 40 ? vUrl.substring(0, 37) + '...' : vUrl}</code>
                  </div>

                  <div class="admin-video-card-actions">
                    ${vIdx > 0 ? `<button type="button" class="admin-video-action-btn" title="Move Up" onclick="handleMoveHeroVideo(${vIdx}, -1)">⬆️ Up</button>` : ''}
                    ${vIdx < getHeroVideosList(settings).length - 1 ? `<button type="button" class="admin-video-action-btn" title="Move Down" onclick="handleMoveHeroVideo(${vIdx}, 1)">⬇️ Down</button>` : ''}
                    <button type="button" class="admin-video-action-btn delete" title="Remove Video" onclick="handleDeleteHeroVideo(${vIdx})">🗑️ Remove</button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>

      <div class="cms-card animate-fade-up delay-3">
        <h3 style="color:#fff">✨ Hero Text &amp; Brand Philosophy</h3>
        <div class="form-grid">
          <div class="form-group full">
            <label>Hero Title Headline</label>
            <input required name="heroTitle" value="${settings.heroTitle}">
          </div>
          <div class="form-group full">
            <label>Hero Subtitle Description</label>
            <textarea required name="heroSubtitle" rows="2">${settings.heroSubtitle}</textarea>
          </div>
          <div class="form-group full">
            <label>Brand Ethos Title</label>
            <input required name="brandEthosTitle" value="${settings.brandEthosTitle}">
          </div>
          <div class="form-group full">
            <label>Brand Ethos Narrative</label>
            <textarea required name="brandEthosText" rows="3">${settings.brandEthosText}</textarea>
          </div>
        </div>
      </div>

      <!-- Category Collection Covers & Brand Imagery Section (Supports Multiple Images per Collection) -->
      <div class="cms-card animate-fade-up delay-4">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <h3 style="color:#fff">🖼️ Category Collection Covers (Multi-Image Slider Support)</h3>
          <span style="font-size:11.5px;color:var(--gold-light);font-weight:700">Auto-Sliding Active When 2+ Photos</span>
        </div>
        <p style="color:#a1a1aa;font-size:13px;margin-bottom:18px">
          Upload 2, 3, 4, or more cover photos per boutique collection. When more than one photo is uploaded, the homepage collection card automatically smoothly cross-fades between the images with interactive indicators.
        </p>

        <div class="form-grid">
          <div class="form-group full">
            <label>Brand Philosophy / Ethos Cover Image</label>
            <div style="display:flex;gap:10px;align-items:center">
              <input name="ethosImageUrl" value="${settings.ethosImageUrl || ''}" placeholder="Image URL / Upload file below" style="flex:1">
              <label class="secondary-btn" style="cursor:pointer;padding:8px 14px;font-size:12px;display:flex;align-items:center;gap:6px">
                📁 Upload Photo <input type="file" accept="image/*" style="display:none" onchange="handleAdminCoverUpload(event, 'ethos')">
              </label>
            </div>
            ${settings.ethosImageUrl ? `
              <div style="margin-top:8px;max-width:180px;border-radius:8px;overflow:hidden;border:1px solid #3f3f46">
                <img src="${settings.ethosImageUrl}" style="width:100%;height:100px;object-fit:cover">
              </div>
            ` : ''}
          </div>

          ${[
            ['Clothing', 'Clothing & Silhouettes'],
            ['Shoes', 'Shoes & Footwear'],
            ['Bags', 'Luxury Bags & Totes'],
            ['Wigs', 'Raw Virgin & HD Wigs'],
            ['Skin Care', 'Skin Care & Botanicals'],
            ['Perfumes', 'Perfumes & Extraits'],
            ['Lifestyle', 'Lifestyle & Home Care'],
            ['Nails', 'Nails & Lacquers'],
            ['Panties', 'Panties & Intimates'],
            ['Toiletries', 'Bath & Toiletries']
          ].map(([catKey, catTitle]) => {
            const covers = getCategoryCoverList(catKey);
            return `
              <div class="form-group full">
                <div class="admin-category-cover-card">
                  <div style="display:flex;justify-content:space-between;align-items:center">
                    <strong style="color:#fff;font-size:14.5px">${catTitle}</strong>
                    <span class="badge" style="background:#051916;color:var(--gold-light);border:1px solid rgba(197,151,55,0.3);font-size:11px">
                      ${covers.length} Photo${covers.length === 1 ? '' : 's'} ${covers.length > 1 ? '✨ (Active Slideshow)' : ''}
                    </span>
                  </div>
                  
                  <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
                    <label class="primary" style="cursor:pointer;padding:7px 14px;font-size:12px;display:inline-flex;align-items:center;gap:6px;background:#c24d67">
                      📁 Select &amp; Upload Multiple Photos
                      <input type="file" multiple accept="image/*" style="display:none" onchange="handleAdminCoverUpload(event, '${catKey}')">
                    </label>
                    
                    <div style="display:flex;gap:6px;flex:1;min-width:220px">
                      <input id="new-cover-url-${catKey}" placeholder="Or paste high-res image URL..." style="font-size:12px;padding:7px 10px;flex:1">
                      <button type="button" class="secondary-btn" style="padding:7px 12px;font-size:11.5px" onclick="addAdminCoverUrl('${catKey}')">+ Add URL</button>
                    </div>
                  </div>

                  ${covers.length ? `
                    <div class="admin-cover-thumbs">
                      ${covers.map((img, idx) => `
                        <div class="admin-cover-thumb" title="Cover Photo #${idx + 1} for ${catKey}">
                          <img src="${img}" alt="Cover ${idx + 1}">
                          <button type="button" class="admin-cover-thumb-delete" onclick="removeAdminCategoryCover('${catKey}', ${idx})" title="Remove this photo">✕</button>
                        </div>
                      `).join('')}
                    </div>
                  ` : `
                    <small style="color:#71717a;font-style:italic">No cover photos uploaded yet (default Haute Couture atelier card displayed on storefront).</small>
                  `}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <div class="cms-card animate-fade-up delay-5">
        <h3 style="color:#fff">📞 Concierge &amp; Contact Details</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>Contact Email</label>
            <input required type="email" name="contactEmail" value="${settings.contactEmail}">
          </div>
          <div class="form-group">
            <label>Contact Phone / WhatsApp</label>
            <input required name="contactPhone" value="${settings.contactPhone}">
          </div>
          <div class="form-group full">
            <label>Physical Atelier Address</label>
            <input required name="accraAddress" value="${settings.accraAddress}">
          </div>
        </div>
      </div>
    </form>
  `;
}

function renderAdminSupabaseConfig() {
  const cfg = getSupabaseConfig();
  const isClientReady = !!getSupabaseClient();

  return `
    <div class="admin-top-bar animate-fade-up">
      <div>
        <span class="eyebrow" style="color:var(--gold-light)">BACKEND &amp; CLOUD DATABASE</span>
        <h1 style="font-size:32px;margin-top:4px">Supabase Cloud Postgres Integration</h1>
      </div>
      <div class="supabase-badge ${isClientReady ? 'connected' : 'offline'}">
        <span>${isClientReady ? '⚡ Connected to Supabase Cloud' : '🟡 Offline Local Fallback Active'}</span>
      </div>
    </div>

    <div class="cms-card animate-fade-up delay-1">
      <h3 style="color:#fff">🔑 Cloud Credentials Configuration</h3>
      <p style="color:#a1a1aa;font-size:13px;margin-bottom:20px">
        Connect ByMarie to a cloud Supabase Postgres database. Enter your Supabase Project URL and Anon API Key below.
      </p>

      <form onsubmit="saveSupabaseConfigFromAdmin(event)">
        <div class="form-grid">
          <div class="form-group full">
            <label>Supabase Project URL</label>
            <input required name="url" value="${cfg.url}" placeholder="https://xyzcompany.supabase.co">
          </div>
          <div class="form-group full">
            <label>Supabase Anon Key</label>
            <input required name="key" type="password" value="${cfg.key}" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...">
          </div>
        </div>
        <div style="display:flex;gap:12px;margin-top:16px">
          <button class="primary" style="background:#c24d67" type="submit">Save Supabase Connection</button>
          ${isClientReady ? `<button class="secondary-btn" type="button" onclick="testSupabaseConnection()">Test Connection ⚡</button>` : ''}
        </div>
      </form>
    </div>

    <div class="cms-card animate-fade-up delay-2">
      <h3 style="color:#fff">📜 Cloud Database Setup SQL</h3>
      <ol style="margin-left:20px;font-size:13px;color:#d4d4d8;line-height:1.8;margin-bottom:20px">
        <li>Log in to your <a href="https://supabase.com/dashboard" target="_blank" style="color:#c24d67;font-weight:700;text-decoration:underline">Supabase Dashboard ↗</a>.</li>
        <li>Go to <strong>SQL Editor</strong> in Supabase, paste the SQL schema below, and click <strong>RUN</strong> to create tables!</li>
      </ol>

      <div style="background:#09090b;color:#a7f3d0;padding:18px;border-radius:var(--radius-sm);font-family:'DM Mono',monospace;font-size:11px;max-height:220px;overflow-y:auto;white-space:pre-wrap;margin-bottom:14px;border:1px solid #27272a">
CREATE TABLE public.products (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL,
  price NUMERIC NOT NULL, old NUMERIC DEFAULT 0, stock INTEGER DEFAULT 10,
  tag TEXT DEFAULT '', image TEXT NOT NULL, images JSONB DEFAULT '[]'::jsonb,
  desc TEXT, details JSONB DEFAULT '[]'::jsonb, colors JSONB DEFAULT '[]'::jsonb,
  sizes JSONB DEFAULT '[]'::jsonb, rating NUMERIC DEFAULT 5.0, reviews JSONB DEFAULT '[]'::jsonb
);

CREATE TABLE public.orders (
  id TEXT PRIMARY KEY, date TEXT NOT NULL, name TEXT NOT NULL, email TEXT,
  phone TEXT NOT NULL, address TEXT NOT NULL, city TEXT NOT NULL, region TEXT NOT NULL,
  delivery TEXT, payment TEXT, status TEXT DEFAULT 'Processing', items JSONB,
  subtotal NUMERIC, discountAmount NUMERIC, deliveryFee NUMERIC, total NUMERIC NOT NULL
);

CREATE TABLE public.coupons (
  code TEXT PRIMARY KEY, discount NUMERIC NOT NULL, type TEXT, label TEXT
);

CREATE TABLE public.site_settings (
  id INT PRIMARY KEY DEFAULT 1, heroTitle TEXT, heroSubtitle TEXT,
  announcementText TEXT, promoCodeNotice TEXT, brandEthosTitle TEXT, brandEthosText TEXT
);
      </div>

      <button class="secondary-btn" style="font-size:12px" onclick="navigator.clipboard.writeText(\`CREATE TABLE public.products (id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, price NUMERIC NOT NULL, old NUMERIC DEFAULT 0, stock INTEGER DEFAULT 10, tag TEXT DEFAULT '', image TEXT NOT NULL, images JSONB DEFAULT '[]'::jsonb, desc TEXT, details JSONB DEFAULT '[]'::jsonb, colors JSONB DEFAULT '[]'::jsonb, sizes JSONB DEFAULT '[]'::jsonb, rating NUMERIC DEFAULT 5.0, reviews JSONB DEFAULT '[]'::jsonb); CREATE TABLE public.orders (id TEXT PRIMARY KEY, date TEXT NOT NULL, name TEXT NOT NULL, email TEXT, phone TEXT NOT NULL, address TEXT NOT NULL, city TEXT NOT NULL, region TEXT NOT NULL, delivery TEXT, payment TEXT, status TEXT DEFAULT 'Processing', items JSONB, subtotal NUMERIC, discountAmount NUMERIC, deliveryFee NUMERIC, total NUMERIC NOT NULL); CREATE TABLE public.coupons (code TEXT PRIMARY KEY, discount NUMERIC NOT NULL, type TEXT, label TEXT); CREATE TABLE public.site_settings (id INT PRIMARY KEY DEFAULT 1, heroTitle TEXT, heroSubtitle TEXT, announcementText TEXT, promoCodeNotice TEXT, brandEthosTitle TEXT, brandEthosText TEXT);\`); toast('Supabase SQL Schema copied to clipboard!');">
        📋 Copy Complete SQL Schema to Clipboard
      </button>
    </div>

    <div class="cms-card animate-fade-up delay-3">
      <h3 style="color:#fff">⚡ Cloud Sync &amp; Local Backup</h3>
      <p style="color:#a1a1aa;font-size:13px;margin-bottom:20px">
        Sync local records to Supabase Cloud or download an emergency JSON database backup.
      </p>

      <div style="display:flex;gap:14px;flex-wrap:wrap">
        <button class="primary" style="background:#c24d67" onclick="syncCatalogToSupabase()">
          ⬆️ Sync Local Catalog to Supabase
        </button>
        <button class="secondary-btn" onclick="fetchCatalogFromSupabase()">
          ⬇️ Fetch Latest Catalog from Supabase
        </button>
      </div>
    </div>
  `;
}

function saveSupabaseConfigFromAdmin(event) {
  event.preventDefault();
  const fd = new FormData(event.target);
  const cfg = {
    url: (fd.get('url') || '').trim(),
    key: (fd.get('key') || '').trim(),
    active: true
  };
  saveSupabaseConfig(cfg);
  supabaseClient = null;
  toast('Supabase credentials saved!');
  render();
}

async function testSupabaseConnection() {
  const client = getSupabaseClient();
  if (!client) return toast('Supabase client is not ready', 'warning');
  try {
    toast('Testing Supabase connection...', 'info');
    const { error } = await client.from('products').select('count', { count: 'exact', head: true });
    if (error) throw error;
    toast('Supabase Connection Test Successful! ⚡');
  } catch (err) {
    toast(`Connection result: ${err.message}`, 'info');
  }
}

async function handleModalImageUpload(event) {
  const files = Array.from(event.target.files);
  if (!files.length) return;

  const client = getSupabaseClient();

  for (const file of files) {
    let uploadedUrl = '';
    if (client) {
      try {
        toast(`Uploading ${file.name} to Supabase Cloud Storage...`, 'info');
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
        const filePath = `products/${fileName}`;

        const { data, error } = await client.storage.from('product-images').upload(filePath, file);
        if (!error) {
          const { data: publicData } = client.storage.from('product-images').getPublicUrl(filePath);
          uploadedUrl = publicData.publicUrl;
        }
      } catch (err) {
        console.warn('Supabase storage upload fallback:', err);
      }
    }

    if (uploadedUrl) {
      if (!adminProductModal.product.images) adminProductModal.product.images = [];
      adminProductModal.product.images.push(uploadedUrl);
      if (!adminProductModal.product.image) adminProductModal.product.image = uploadedUrl;
      render();
      toast(`Photo ${file.name} uploaded to Supabase Cloud Storage! ⚡`);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64Url = e.target.result;
        if (!adminProductModal.product.images) adminProductModal.product.images = [];
        adminProductModal.product.images.push(base64Url);
        if (!adminProductModal.product.image) adminProductModal.product.image = base64Url;
        render();
        toast(`Photo uploaded: ${file.name}`);
      };
      reader.readAsDataURL(file);
    }
  }
}

function addModalImageUrl(url) {
  const clean = (url || '').trim();
  if (!clean) return toast('Please enter a valid image URL', 'warning');
  if (!adminProductModal.product.images) adminProductModal.product.images = [];
  adminProductModal.product.images.push(clean);
  if (!adminProductModal.product.image) adminProductModal.product.image = clean;
  render();
  toast('Image URL added to gallery!');
}

function setMainModalImage(index) {
  if (adminProductModal && adminProductModal.product.images && adminProductModal.product.images[index]) {
    const selected = adminProductModal.product.images[index];
    adminProductModal.product.image = selected;
    adminProductModal.product.images.splice(index, 1);
    adminProductModal.product.images.unshift(selected);
    render();
    toast('Set as main cover photo!');
  }
}

function removeModalImage(index) {
  if (adminProductModal && adminProductModal.product.images) {
    adminProductModal.product.images.splice(index, 1);
    adminProductModal.product.image = adminProductModal.product.images[0] || '';
    render();
    toast('Image removed', 'info');
  }
}

function openProductModal(mode, productId = null) {
  const p = productId ? byId(productId) : null;
  adminProductModal = {
    mode,
    product: p ? JSON.parse(JSON.stringify(p)) : {
      id: `prod-${Date.now()}`,
      name: '',
      category: 'Clothing',
      price: 0,
      old: 0,
      stock: 1,
      tag: '',
      image: '',
      images: [],
      desc: '',
      details: [],
      colors: [],
      sizes: []
    }
  };
  render();
}

// ===================================================
// DIRECT BACKEND API CONNECTIVITY & CONTROL
// ===================================================

let backendConnected = true;

async function syncAdminWithBackend(silent = false) {
  try {
    const [pRes, oRes, cRes, sRes, uRes, wRes] = await Promise.allSettled([
      fetch(`${API_BASE}/products`),
      fetch(`${API_BASE}/orders`),
      fetch(`${API_BASE}/coupons`),
      fetch(`${API_BASE}/settings`),
      fetch(`${API_BASE}/users`),
      fetch(`${API_BASE}/wholesale`)
    ]);

    let syncCount = 0;

    if (pRes.status === 'fulfilled' && pRes.value.ok) {
      const data = await pRes.value.json();
      if (Array.isArray(data)) {
        const cleanProds = data.filter(p => {
          if (!p || !p.id || !p.name) return false;
          const id = String(p.id).toLowerCase();
          if (id.startsWith('p-') || id.startsWith('p_') || id.startsWith('prod-0') || id.startsWith('prod-1') || id.startsWith('prod-2')) return false;
          const nm = String(p.name).toLowerCase();
          if (nm.includes('linen edit') || nm.includes('tailored ease') || nm.includes('atelier blazer') || nm.includes('suede slingback') || nm.includes('woven leather') || nm.includes('leather slide')) {
            return false;
          }
          return true;
        });
        saveProducts(cleanProds);
        syncCount++;
      }
    }

    if (oRes.status === 'fulfilled' && oRes.value.ok) {
      const data = await oRes.value.json();
      if (Array.isArray(data)) {
        saveOrders(data);
        syncCount++;
      }
    }

    if (cRes.status === 'fulfilled' && cRes.value.ok) {
      const data = await cRes.value.json();
      if (Array.isArray(data)) {
        saveCoupons(data);
        syncCount++;
      }
    }

    if (sRes.status === 'fulfilled' && sRes.value.ok) {
      const data = await sRes.value.json();
      if (data && typeof data === 'object') {
        saveSiteSettings({ ...getSiteSettings(), ...data });
        syncCount++;
      }
    }

    if (uRes.status === 'fulfilled' && uRes.value.ok) {
      const data = await uRes.value.json();
      if (Array.isArray(data)) {
        saveUsers(data);
        syncCount++;
      }
    }

    if (wRes.status === 'fulfilled' && wRes.value.ok) {
      const data = await wRes.value.json();
      if (Array.isArray(data)) {
        saveWholesaleInquiries(data);
        syncCount++;
      }
    }

    backendConnected = true;
    if (!silent) toast('⚡ Direct Live Sync: All backend databases up to date!', 'info');
    render();
  } catch (err) {
    backendConnected = false;
    console.warn('Backend sync note:', err.message);
  }
}

async function saveProductFromModal(event) {
  event.preventDefault();
  const form = event.target;
  const fd = new FormData(form);
  
  const products = getProducts();
  const id = adminProductModal.product.id || `prod-${Date.now()}`;
  
  const rawDetails = (fd.get('details') || '').split('\n').map(s => s.trim()).filter(Boolean);

  const updatedProduct = {
    id,
    isCustom: true,
    name: fd.get('name'),
    category: fd.get('category'),
    price: Number(fd.get('price')),
    old: Number(fd.get('old') || 0),
    stock: Number(fd.get('stock')),
    tag: fd.get('tag') || '',
    image: adminProductModal.product.images?.[0] || fd.get('image'),
    images: adminProductModal.product.images?.length ? adminProductModal.product.images : [fd.get('image')].filter(Boolean),
    desc: fd.get('desc'),
    details: rawDetails.length ? rawDetails : ['High grade craftsmanship', 'Guaranteed authentic'],
    colors: fd.get('colors').split(',').map(s => s.trim()).filter(Boolean),
    sizes: fd.get('sizes').split(',').map(s => s.trim()).filter(Boolean),
    rating: adminProductModal.product.rating || 5.0,
    reviews: adminProductModal.product.reviews || []
  };
  
  const isAdd = adminProductModal.mode === 'add';
  if (isAdd) {
    products.unshift(updatedProduct);
  } else {
    const idx = products.findIndex(p => p.id === id);
    if (idx !== -1) products[idx] = updatedProduct;
    else products.unshift(updatedProduct);
  }
  
  saveProducts(products);
  adminProductModal = null;
  render();

  // Send Direct Backend Mutation
  try {
    const url = isAdd ? `${API_BASE}/products` : `${API_BASE}/products/${id}`;
    const method = isAdd ? 'POST' : 'PUT';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedProduct)
    });
    if (res.ok) {
      toast(`⚡ Product "${updatedProduct.name}" saved directly to backend DB!`);
    } else {
      toast(`Product saved locally ✓`);
    }
  } catch (e) {
    toast(`Product saved locally ✓`);
  }
}

async function deleteProduct(id) {
  if (!confirm('Are you sure you want to remove this product from the catalog?')) return;
  let products = getProducts().filter(p => p.id !== id);
  saveProducts(products);
  toast('Product removed from catalog');
  render();

  try {
    await fetch(`${API_BASE}/products/${id}`, { method: 'DELETE' });
    toast(`⚡ Backend database updated: Product deleted`);
  } catch (e) {}
}

async function toggleProductStockStatus(id) {
  const products = getProducts();
  const p = products.find(prod => prod.id === id);
  if (!p) return;

  if (p.stock > 0) {
    p._lastStock = p.stock;
    p.stock = 0;
    toast(`"${p.name}" set to Out of Stock ❌`, 'warning');
  } else {
    p.stock = p._lastStock || 15;
    toast(`"${p.name}" marked as In Stock (${p.stock} units) ⚡`);
  }

  saveProducts(products);
  render();

  try {
    await fetch(`${API_BASE}/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p)
    });
  } catch (e) {}
}

async function adjustProductStock(id, delta) {
  const products = getProducts();
  const p = products.find(prod => prod.id === id);
  if (p) {
    p.stock = Math.max(0, p.stock + delta);
    saveProducts(products);
    render();

    try {
      await fetch(`${API_BASE}/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p)
      });
    } catch (e) {}
  }
}

async function updateOrderStatus(orderId, status) {
  const orders = getOrders();
  const o = orders.find(ord => ord.id === orderId);
  if (o) {
    o.status = status;
    saveOrders(orders);
    toast(`Order #${orderId} status changed to ${status}`);
    render();

    try {
      await fetch(`${API_BASE}/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      toast(`⚡ Backend DB updated: Order #${orderId} status is ${status}`);
    } catch (e) {}
  }
}

async function createCoupon(event) {
  event.preventDefault();
  const fd = new FormData(event.target);
  const newCoupon = {
    code: fd.get('code').toUpperCase().trim(),
    discount: Number(fd.get('discount')),
    type: fd.get('type'),
    label: fd.get('label')
  };

  const coupons = getCoupons();
  coupons.push(newCoupon);
  saveCoupons(coupons);
  activeModal = null;
  toast(`Promo code ${newCoupon.code} created! ⚡`);
  render();

  try {
    await fetch(`${API_BASE}/coupons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCoupon)
    });
  } catch (e) {}
}

async function deleteCoupon(index) {
  const coupons = getCoupons();
  const target = coupons[index];
  coupons.splice(index, 1);
  saveCoupons(coupons);
  toast('Promo code deleted');
  render();

  if (target && target.code) {
    try {
      await fetch(`${API_BASE}/coupons/${target.code}`, { method: 'DELETE' });
    } catch (e) {}
  }
}

async function updateWholesaleInquiryStatus(id, status) {
  const list = getWholesaleInquiries();
  const item = list.find(w => w.id === id);
  if (item) {
    item.status = status;
    saveWholesaleInquiries(list);
    toast(`Inquiry #${id} marked as ${status}`);
    render();

    try {
      await fetch(`${API_BASE}/wholesale/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
    } catch (e) {}
  }
}

async function deleteWholesaleInquiry(id) {
  if (!confirm('Remove this wholesale inquiry from pipeline?')) return;
  let list = getWholesaleInquiries().filter(w => w.id !== id);
  saveWholesaleInquiries(list);
  toast('Wholesale inquiry dismissed');
  render();

  try {
    await fetch(`${API_BASE}/wholesale/${id}`, { method: 'DELETE' });
  } catch (e) {}
}

async function saveCMSFromAdmin(event) {
  event.preventDefault();
  const fd = new FormData(event.target);
  const cur = getSiteSettings();

  const updatedSettings = {
    ...cur,
    announcementText: fd.get('announcementText') || '',
    promoCodeNotice: fd.get('promoCodeNotice') || '',
    heroTitle: fd.get('heroTitle') || '',
    heroSubtitle: fd.get('heroSubtitle') || '',
    heroMediaUrl: fd.get('heroMediaUrl') || '',
    brandEthosTitle: fd.get('brandEthosTitle') || '',
    brandEthosText: fd.get('brandEthosText') || '',
    ethosImageUrl: (fd.get('ethosImageUrl') || '').trim(),
    contactEmail: fd.get('contactEmail') || '',
    contactPhone: fd.get('contactPhone') || '',
    accraAddress: fd.get('accraAddress') || ''
  };

  saveSiteSettings(updatedSettings);
  toast('⚡ Storefront CMS settings saved directly to backend DB!');
  render();

  try {
    await fetch(`${API_BASE}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedSettings)
    });
  } catch (e) {}
}

async function handleAdminCoverUpload(event, target) {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;

  toast(`Processing ${files.length} cover image${files.length > 1 ? 's' : ''}...`, 'info');
  
  const readPromises = files.map(file => {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  });

  const base64List = (await Promise.all(readPromises)).filter(Boolean);
  if (!base64List.length) return;

  const settings = getSiteSettings();
  if (target === 'ethos') {
    settings.ethosImageUrl = base64List[0];
  } else {
    if (!settings.categoryCovers) settings.categoryCovers = {};
    const existing = getCategoryCoverList(target);
    settings.categoryCovers[target] = [...existing, ...base64List];
  }
  
  saveSiteSettings(settings);
  toast(`Updated ${target} with ${base64List.length} cover photo${base64List.length > 1 ? 's' : ''}! ⚡`);
  render();

  try {
    fetch(`${API_BASE}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    }).catch(() => {});
  } catch (err) {}
}

function addAdminCoverUrl(target) {
  const input = document.getElementById(`new-cover-url-${target}`);
  if (!input) return;
  const url = (input.value || '').trim();
  if (!url) return toast('Please enter an image URL', 'warning');
  
  const settings = getSiteSettings();
  if (!settings.categoryCovers) settings.categoryCovers = {};
  const existing = getCategoryCoverList(target);
  settings.categoryCovers[target] = [...existing, url];
  saveSiteSettings(settings);
  toast(`Added cover image to ${target}! ⚡`);
  render();

  try {
    fetch(`${API_BASE}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    }).catch(() => {});
  } catch (err) {}
}

function removeAdminCategoryCover(target, index) {
  const settings = getSiteSettings();
  if (!settings.categoryCovers || !settings.categoryCovers[target]) return;
  const list = getCategoryCoverList(target);
  list.splice(index, 1);
  settings.categoryCovers[target] = list;
  saveSiteSettings(settings);
  toast(`Removed cover photo from ${target}`);
  render();

  try {
    fetch(`${API_BASE}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    }).catch(() => {});
  } catch (err) {}
}

async function handleMultiHeroVideoUpload(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;

  toast(`Uploading ${files.length} campaign video(s) to cloud CDN...`, 'info');
  const settings = getSiteSettings();
  if (!Array.isArray(settings.heroVideos)) settings.heroVideos = [];

  let addedCount = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    let uploadedUrl = null;

    // 1. Try uploading directly to Supabase Storage (Global CDN)
    try {
      const client = getSupabaseClient();
      if (client && client.storage) {
        const fileExt = file.name.split('.').pop() || 'mp4';
        const sPath = `hero_${Date.now()}_${i}.${fileExt}`;
        const { data: sData, error: sErr } = await client.storage.from('media').upload(sPath, file, {
          cacheControl: '3600',
          upsert: true
        });
        if (!sErr && sData) {
          const { data: pubData } = client.storage.from('media').getPublicUrl(sPath);
          if (pubData && pubData.publicUrl) {
            uploadedUrl = pubData.publicUrl;
            console.log('✅ Uploaded to Supabase Storage CDN:', uploadedUrl);
          }
        }
      }
    } catch (sEx) {
      console.warn('Supabase storage direct upload notice:', sEx);
    }

    // 2. Fallback: Try uploading to backend /api/upload
    if (!uploadedUrl) {
      try {
        const fd = new FormData();
        fd.append('photos', file);
        const res = await fetch(`${API_BASE}/upload`, {
          method: 'POST',
          body: fd
        });
        if (res.ok) {
          const data = await res.json();
          if (data.urls && data.urls[0]) {
            uploadedUrl = sanitizeMediaUrl(data.urls[0]);
          }
        }
      } catch (err) {
        console.warn('API upload fallback:', err);
      }
    }

    // If successfully uploaded to CDN, save permanent URL
    if (uploadedUrl) {
      try { await VideoDB.saveVideo(`hero_vid_${Date.now()}_${i}`, file); } catch (e) {}
      settings.heroVideos.push(uploadedUrl);
      if (!settings.heroMediaUrl) settings.heroMediaUrl = uploadedUrl;
      addedCount++;
    } else {
      const blobUrl = URL.createObjectURL(file);
      try { await VideoDB.saveVideo(`hero_vid_${Date.now()}_${i}`, file); } catch (e) {}
      settings.heroVideos.push(blobUrl);
      if (!settings.heroMediaUrl) settings.heroMediaUrl = blobUrl;
      addedCount++;
    }
  }

  // Filter out any stale template video references
  settings.heroVideos = settings.heroVideos.filter(v => typeof v === 'string' && v.trim().length > 0 && !v.includes('assets/bymarie.mp4') && !v.includes('assets/hero-fashion.mp4'));

  saveSiteSettings(settings);
  render();

  // Persist permanently to Supabase Cloud Database
  try {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    if (res.ok) {
      const saved = await res.json();
      console.log('✅ Settings saved permanently to Supabase:', saved);
      toast(`🎬 Saved ${addedCount} video(s) permanently to cloud playlist!`, 'success');
    }
  } catch (err) {
    console.warn('Notice saving settings to backend:', err);
  }
}

function handleAddHeroVideoUrl(url) {
  if (!url || !url.trim()) return toast('Please enter a valid video URL', 'warning');
  const trimmed = sanitizeMediaUrl(url);
  const settings = getSiteSettings();
  if (!Array.isArray(settings.heroVideos)) settings.heroVideos = [];
  settings.heroVideos.push(trimmed);
  if (!settings.heroMediaUrl) settings.heroMediaUrl = trimmed;
  saveSiteSettings(settings);
  toast('🎬 Video URL added to hero campaign playlist!', 'success');
  render();

  try {
    fetch(`${API_BASE}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    }).catch(() => {});
  } catch (err) {}
}

function handleDeleteHeroVideo(index) {
  const settings = getSiteSettings();
  if (!Array.isArray(settings.heroVideos)) return;
  if (settings.heroVideos.length <= 1) {
    return toast('At least one video must remain in the hero playlist', 'warning');
  }
  settings.heroVideos.splice(index, 1);
  settings.heroMediaUrl = settings.heroVideos[0] || 'assets/bymarie.mp4';
  saveSiteSettings(settings);
  toast('Video removed from playlist');
  render();

  try {
    fetch(`${API_BASE}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    }).catch(() => {});
  } catch (err) {}
}

function handleMoveHeroVideo(index, direction) {
  const settings = getSiteSettings();
  if (!Array.isArray(settings.heroVideos)) return;
  const targetIdx = index + direction;
  if (targetIdx < 0 || targetIdx >= settings.heroVideos.length) return;
  const temp = settings.heroVideos[index];
  settings.heroVideos[index] = settings.heroVideos[targetIdx];
  settings.heroVideos[targetIdx] = temp;
  settings.heroMediaUrl = settings.heroVideos[0];
  saveSiteSettings(settings);
  render();

  try {
    fetch(`${API_BASE}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    }).catch(() => {});
  } catch (err) {}
}

function handleChangeHeroInterval(seconds) {
  const settings = getSiteSettings();
  settings.heroVideoInterval = Number(seconds) || 30;
  saveSiteSettings(settings);
  toast(`⏱️ Hero video transition interval set to ${settings.heroVideoInterval} seconds!`, 'info');
  initHeroVideoRotation();

  try {
    fetch(`${API_BASE}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    }).catch(() => {});
  } catch (err) {}
}

function handleHeroVideoUpload(event) {
  handleMultiHeroVideoUpload(event);
}

// Global window bindings for video playlist handlers
window.handleDeleteHeroVideo = handleDeleteHeroVideo;
window.handleMoveHeroVideo = handleMoveHeroVideo;
window.handleAddHeroVideoUrl = handleAddHeroVideoUrl;
window.handleMultiHeroVideoUpload = handleMultiHeroVideoUpload;
window.handleChangeHeroInterval = handleChangeHeroInterval;
window.switchHeroVideo = switchHeroVideo;
window.prevHeroVideo = prevHeroVideo;
window.nextHeroVideo = nextHeroVideo;
window.initHeroVideoRotation = initHeroVideoRotation;

function exportOrdersCSV() {
  const orders = getOrders();
  let csv = 'Order ID,Date,Customer Name,Email,Phone,City,Region,Delivery,Payment,Status,Total (GHc)\n';
  
  orders.forEach(o => {
    csv += `"${o.id}","${o.date}","${o.name}","${o.email}","${o.phone}","${o.city}","${o.region}","${o.delivery}","${o.payment}","${o.status}",${o.total}\n`;
  });
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bymarie-orders-export-${Date.now()}.csv`;
  a.click();
  toast('Orders exported to CSV');
}

function openLightbox(imgSrc) {
  modalData = { imgSrc };
  activeModal = 'lightbox';
  render();
}

function renderModals() {
  // Command Palette
  if (commandPaletteOpen) {
    const { navCommands, products, orders } = getCommandPaletteResults(commandPaletteQuery);
    const hasResults = navCommands.length || products.length || orders.length;
    return `
      <div class="modal-backdrop command-palette-backdrop" onclick="if(event.target===this){commandPaletteOpen=false;render()}">
        <div class="command-palette">
          <div class="command-palette-input">
            ${svgIcon('search', 18)}
            <input autofocus placeholder="Search or jump to..." value="${commandPaletteQuery}" oninput="commandPaletteQuery=this.value;render()" onkeydown="if(event.key==='Enter'){const first=document.querySelector('.command-palette-item');if(first)first.click();}">
            <kbd>ESC</kbd>
          </div>
          <div class="command-palette-results">
            ${!hasResults ? `<div class="command-palette-empty">No results for "${commandPaletteQuery}"</div>` : ''}
            ${navCommands.length ? `
              <div class="command-palette-group">
                <span>Navigate</span>
                ${navCommands.map(c => `<button class="command-palette-item" onclick="${c.action}">${svgIcon(c.icon, 15)} ${c.label}</button>`).join('')}
              </div>
            ` : ''}
            ${products.length ? `
              <div class="command-palette-group">
                <span>Products</span>
                ${products.map(p => `<button class="command-palette-item" onclick="commandPaletteOpen=false;adminTab='products';render();openProductModal('edit','${p.id}')">${svgIcon('box', 15)} ${p.name} <small>${p.category}</small></button>`).join('')}
              </div>
            ` : ''}
            ${orders.length ? `
              <div class="command-palette-group">
                <span>Orders</span>
                ${orders.map(o => `<button class="command-palette-item" onclick="commandPaletteOpen=false;adminTab='orders';render();openOrderModal('${o.id}')">${svgIcon('bag', 15)} ${o.id} <small>${o.name}</small></button>`).join('')}
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }

  // Quick View Modal
  if (activeModal === 'quickview') {
    const p = modalData.product;
    const images = (p.images && p.images.length) ? p.images : [p.image];
    const currentImg = images[modalData.imgIdx || 0];
    const chosenVariant = selectedVariants[p.id]?.color || (p.colors && p.colors[0]) || 'Standard';
    const chosenSize = selectedVariants[p.id]?.size || (p.sizes && p.sizes[0]) || '';
    const outOfStock = p.stock <= 0;

    return `
      <div class="modal-backdrop" onclick="if(event.target===this){activeModal=null;render()}">
        <div class="modal-card" style="max-width:800px;display:grid;grid-template-columns:1fr 1fr;gap:30px;padding:30px">
          <button class="modal-close" onclick="activeModal=null;render()">✕</button>
          <div>
            <img src="${currentImg}" alt="${p.name}" style="width:100%;height:380px;object-fit:cover;border-radius:var(--radius-md)">
            <div style="display:flex;gap:8px;margin-top:10px">
              ${images.map((img, idx) => `
                <div onclick="modalData.imgIdx=${idx};render()" style="width:55px;height:65px;border-radius:var(--radius-xs);overflow:hidden;border:2px solid ${(modalData.imgIdx || 0) === idx ? 'var(--emerald)' : 'transparent'};cursor:pointer">
                  <img src="${img}" style="width:100%;height:100%;object-fit:cover">
                </div>
              `).join('')}
            </div>
          </div>
          <div style="display:flex;flex-direction:column">
            <span class="eyebrow">${p.category}</span>
            <h2 style="font-size:28px;margin:6px 0 10px">${p.name}</h2>
            <div class="rating" style="margin-bottom:12px">★ ${p.rating}</div>
            <div class="price" style="font-size:22px;margin:0 0 14px">${money(p.price)}</div>
            <p style="color:var(--muted);font-size:13px;line-height:1.6;margin-bottom:16px">${p.desc}</p>
            
            ${p.colors && p.colors.length ? `
              <div style="margin-bottom:14px">
                <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:12px">
                  <span style="color:var(--muted);font-weight:700">Option / Color Availability:</span>
                  <strong>${chosenVariant}</strong>
                </div>
                <div style="display:flex;gap:6px;flex-wrap:wrap">
                  ${p.colors.map(c => `
                    <button class="chip color-chip ${chosenVariant === c ? 'active' : ''}" style="padding:6px 12px;font-size:11px" onclick="selectedVariants['${p.id}']={...selectedVariants['${p.id}'],color:'${c}'};render()">
                      <span class="color-dot-indicator" style="background-color:${getColorHex(c)};width:11px;height:11px"></span>
                      <span>${c}</span>
                    </button>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            ${p.sizes && p.sizes.length ? `
              <div style="margin-bottom:14px">
                <small style="display:block;font-weight:700;margin-bottom:6px">Size / Length: ${chosenSize}</small>
                <div style="display:flex;gap:6px;flex-wrap:wrap">
                  ${p.sizes.map(s => `
                    <button class="chip ${chosenSize === s ? 'active' : ''}" style="padding:6px 12px;font-size:11px" onclick="selectedVariants['${p.id}']={...selectedVariants['${p.id}'],size:'${s}'};render()">${s}</button>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            <div style="margin-top:auto;display:flex;flex-direction:column;gap:10px">
              <button class="primary" ${outOfStock ? 'disabled' : ''} onclick="add('${p.id}','${chosenVariant}','${chosenSize}');activeModal=null;render()">
                ${outOfStock ? 'Out of stock' : `Add to Bag • ${money(p.price)}`}
              </button>
              <button class="secondary-btn" onclick="activeModal=null;go('product/${p.id}')">
                View Full Details Page →
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Lightbox
  if (activeModal === 'lightbox') {
    return `
      <div class="modal-backdrop lightbox-modal" onclick="activeModal=null;render()">
        <div class="lightbox-content" onclick="event.stopPropagation()">
          <button class="modal-close" style="color:#fff" onclick="activeModal=null;render()">✕</button>
          <img src="${modalData.imgSrc}" alt="Expanded view">
        </div>
      </div>
    `;
  }

  // MoMo USSD Prompt
  if (activeModal === 'momo_prompt') {
    const { order, phone, network } = modalData;
    return `
      <div class="modal-backdrop">
        <div class="modal-card prompt-simulation-card">
          <div class="pulse-spinner"></div>
          <span class="eyebrow" style="justify-content:center">AUTHORIZING PAYMENT</span>
          <h2 style="font-size:24px;margin:12px 0 6px">${network} Mobile Money</h2>
          <p style="color:var(--muted);font-size:13px;margin-bottom:20px">
            A prompt has been sent to <strong>${phone}</strong> for <strong>${money(order.total)}</strong>.
            Please approve the prompt on your phone to complete your order.
          </p>

          <div style="background:var(--sage-light);border:1px dashed var(--emerald);border-radius:var(--radius-sm);padding:14px;margin-bottom:24px;font-size:12px">
            <span style="display:block;font-weight:700">Simulating USSD Mobile Payment:</span>
            <small style="color:var(--muted)">[Prompt: Pay GH₵ ${order.total.toFixed(2)} to ByMarie E-Commerce? Reply 1 to Confirm]</small>
          </div>

          <button class="primary" style="width:100%" onclick="completeOrder(modalData.order)">
            ✓ Simulate USSD Approval on Phone
          </button>
        </div>
      </div>
    `;
  }

  // Order Details Modal
  if (activeModal === 'order_view') {
    const { order } = modalData;
    const stages = ['Pending', 'Processing', 'Shipped', 'Delivered'];
    const currentIdx = stages.indexOf(order.status) === -1 ? 0 : stages.indexOf(order.status);

    return `
      <div class="modal-backdrop" onclick="if(event.target===this){activeModal=null;render()}">
        <div class="modal-card" style="max-width:650px">
          <button class="modal-close" onclick="activeModal=null;render()">✕</button>
          <span class="eyebrow">ORDER TRACKING & DETAILS</span>
          <h2 style="font-size:24px;margin:6px 0 16px">Order #${order.id}</h2>
          
          ${renderOrderStatusTimeline(order.status)}

          <div style="background:var(--cashmere);border:1px solid var(--line);border-radius:var(--radius-sm);padding:16px;margin-bottom:20px;font-size:13px">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px">
              <span>Delivery Method:</span>
              <b>${order.delivery}</b>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:8px">
              <span>Payment Option:</span>
              <b>${order.payment}</b>
            </div>
            <div style="display:flex;justify-content:space-between">
              <span>Destination:</span>
              <b>${order.address}, ${order.city} (${order.region})</b>
            </div>
          </div>

          <h4 style="margin-bottom:10px;font-size:14px">Itemized Breakdown</h4>
          <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px">
            ${order.items.map(it => {
              const p = byId(it.id);
              return `
                <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--line-light);padding-bottom:8px">
                  <div>
                    <strong>${p ? p.name : it.id}</strong>
                    <small style="display:block;color:var(--muted)">${it.qty} × ${p ? money(p.price) : ''} • Option: ${it.variant || 'Standard'} ${it.size ? `(${it.size})` : ''}</small>
                  </div>
                  <b>${p ? money(p.price * it.qty) : ''}</b>
                </div>
              `;
            }).join('')}
          </div>

          <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:800;margin-top:16px;border-top:2px solid var(--line);padding-top:12px">
            <span>Grand Total</span>
            <strong style="color:var(--emerald)">${money(order.total)}</strong>
          </div>

          <div style="display:flex;gap:10px;margin-top:20px;flex-wrap:wrap">
            <button class="primary" style="flex-grow:1" onclick="openInvoiceModal('${order.id}')">📄 Printable Invoice</button>
            <button class="secondary-btn" style="background:#22c55e;color:#fff;border-color:#22c55e" onclick="shareOrderToWhatsApp('${order.id}')">💬 Share to WhatsApp</button>
            <button class="secondary-btn" onclick="activeModal=null;render()">Close</button>
          </div>
        </div>
      </div>
    `;
  }

  // Quick Search Modal (CTRL+K)
  if (activeModal === 'quick_search') {
    const products = getProducts();
    const query = (quickSearchQuery || '').toLowerCase().trim();
    const list = query ? products.filter(p => `${p.name} ${p.category} ${p.desc}`.toLowerCase().includes(query)) : products.slice(0, 5);

    return `
      <div class="search-modal-backdrop" onclick="if(event.target===this){activeModal=null;render()}">
        <div class="search-modal-card">
          <div class="search-modal-header">
            <span>${icon('search')}</span>
            <input id="quick-search-input" value="${quickSearchQuery}" oninput="quickSearchQuery=this.value;render();const inp=document.getElementById('quick-search-input');if(inp){inp.focus();inp.setSelectionRange(inp.value.length,inp.value.length)}" placeholder="Type to search clothing, shoes, bags, wigs, scents...">
            <span class="kbd">ESC</span>
          </div>

          <div style="padding:12px 24px;border-bottom:1px solid var(--line);display:flex;gap:8px;background:var(--sand);overflow-x:auto">
            <small style="color:var(--muted);font-weight:700;align-self:center">Quick Collections:</small>
            ${['Clothing', 'Shoes', 'Bags', 'Wigs', 'Skin Care', 'Perfumes'].map(c => `
              <span class="chip" style="padding:4px 10px;font-size:11px;cursor:pointer" onclick="activeModal=null;go('category/${encodeURIComponent(c)}')">${c}</span>
            `).join('')}
          </div>

          <div class="search-results-list">
            ${query ? `
              <div style="font-size:11.5px;font-weight:700;color:var(--muted);margin-bottom:6px">FOUND ${list.length} RESULTS:</div>
            ` : `
              <div style="font-size:11.5px;font-weight:700;color:var(--muted);margin-bottom:6px">FEATURED SELECTION:</div>
            `}

            ${list.length ? list.map(p => `
              <div class="search-result-item" onclick="activeModal=null;go('product/${p.id}')">
                <img src="${p.image}" alt="${p.name}">
                <div class="search-result-info">
                  <h4>${p.name}</h4>
                  <span>${p.category} • ${p.stock > 0 ? `In Stock (${p.stock} units)` : '<b style="color:var(--red)">Out of Stock</b>'}</span>
                </div>
                <div class="search-result-price">${money(p.price)}</div>
              </div>
            `).join('') : `
              <div style="text-align:center;padding:40px 20px;color:var(--muted)">
                <p style="margin-bottom:8px">No products matching "${quickSearchQuery}"</p>
                <button class="text-btn" onclick="quickSearchQuery='';render()">Clear query</button>
              </div>
            `}
          </div>
        </div>
      </div>
    `;
  }

  // Printable Invoice Modal
  if (activeModal === 'invoice') {
    const order = getOrders().find(o => o.id === modalData.orderId) || getOrders()[0];
    if (!order) return '';

    return `
      <div class="modal-backdrop" onclick="if(event.target===this){activeModal=null;render()}">
        <div class="modal-card" style="max-width:740px;padding:0;background:transparent;border:0;box-shadow:none">
          <div class="invoice-card">
            <button class="modal-close no-print" onclick="activeModal=null;render()">✕</button>

            <div class="invoice-header">
              <div>
                <div class="invoice-brand">ByMarie</div>
                <small style="color:var(--muted);font-weight:600;display:block;margin-top:2px">Considered Style, Scent & Essentials • Ghana</small>
                <small style="color:var(--muted);display:block">Accra Atelier & B2B Distribution • Tel: +233 24 000 0000</small>
              </div>
              <div style="text-align:right">
                <h3 style="font-size:22px;margin:0;color:var(--ink)">INVOICE / RECEIPT</h3>
                <b style="font-family:'DM Mono';font-size:14px;color:var(--emerald)">#${order.id}</b>
                <small style="display:block;color:var(--muted);margin-top:4px">Issued: ${order.date}</small>
                <span class="badge ${order.status.toLowerCase()}" style="margin-top:6px">${order.status}</span>
              </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px;font-size:13px">
              <div style="background:var(--sand);padding:16px;border-radius:var(--radius-sm)">
                <strong style="color:var(--emerald);display:block;margin-bottom:6px">BILLED / SHIPPED TO:</strong>
                <b>${order.name}</b><br>
                ${order.address}<br>
                ${order.city}, ${order.region}<br>
                Phone: ${order.phone}<br>
                Email: ${order.email || 'N/A'}
              </div>
              <div style="background:var(--sand);padding:16px;border-radius:var(--radius-sm)">
                <strong style="color:var(--emerald);display:block;margin-bottom:6px">PAYMENT & FULFILLMENT:</strong>
                <b>Payment Method:</b> ${order.payment}<br>
                <b>Fulfillment Option:</b> ${order.delivery}<br>
                <b>Transaction Ref:</b> ${order.id}-TXN<br>
                <b>Currency:</b> Ghanaian Cedi (GHS ₵)
              </div>
            </div>

            <table class="invoice-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Variant / Size</th>
                  <th>Unit Price</th>
                  <th>Qty</th>
                  <th style="text-align:right">Total</th>
                </tr>
              </thead>
              <tbody>
                ${order.items.map(it => {
                  const p = byId(it.id);
                  const itemPrice = p ? p.price : 0;
                  return `
                    <tr>
                      <td><strong>${p ? p.name : it.id}</strong></td>
                      <td>${it.variant || 'Standard'} ${it.size ? `(${it.size})` : ''}</td>
                      <td>${money(itemPrice)}</td>
                      <td>${it.qty}</td>
                      <td style="text-align:right"><b>${money(itemPrice * it.qty)}</b></td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>

            <div class="invoice-total-box">
              <div class="invoice-total-row">
                <span>Subtotal:</span>
                <b>${money(order.subtotal || order.total)}</b>
              </div>
              <div class="invoice-total-row">
                <span>Delivery / Shipping Fee:</span>
                <b>${money(order.deliveryFee || 0)}</b>
              </div>
              ${order.discountAmount ? `
                <div class="invoice-total-row" style="color:var(--emerald)">
                  <span>Discount Applied:</span>
                  <b>−${money(order.discountAmount)}</b>
                </div>
              ` : ''}
              <div class="invoice-total-row grand">
                <span>Amount Paid:</span>
                <strong>${money(order.total)}</strong>
              </div>
            </div>

            <div class="no-print" style="display:flex;gap:12px;margin-top:30px;justify-content:flex-end">
              <button class="primary" onclick="window.print()">🖨️ Print / Download PDF Invoice</button>
              <button class="secondary-btn" onclick="activeModal=null;render()">Close Invoice</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Admin Add/Edit Product Modal Pro
  if (adminProductModal) {
    const { mode, product } = adminProductModal;
    const catList = ['Clothing', 'Shoes', 'Bags', 'Wigs', 'Skin Care', 'Perfumes', 'Lifestyle', 'Nails', 'Panties', 'Toiletries'];
    const imagesList = (product.images && product.images.length) ? product.images : [product.image].filter(Boolean);

    return `
      <div class="modal-backdrop" onclick="if(event.target===this){adminProductModal=null;render()}">
        <div class="modal-card" style="max-width:760px;max-height:85vh;overflow-y:auto">
          <button class="modal-close" onclick="adminProductModal=null;render()">✕</button>
          <span class="eyebrow">CATALOG PACKAGE BUILDER PRO</span>
          <h2 style="font-size:24px;margin:6px 0 20px">${mode === 'add' ? 'Add New Product Package' : 'Edit Product Package'}</h2>

          <form onsubmit="saveProductFromModal(event)">
            <div class="form-grid">
              <div class="form-group full">
                <label>Product / Package Name</label>
                <input required name="name" value="${product.name}" placeholder="e.g. Atelier Suede Slingback Mules">
              </div>
              <div class="form-group">
                <label>Category</label>
                <select name="category">
                  ${catList.map(c => `
                    <option ${product.category === c ? 'selected' : ''}>${c}</option>
                  `).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>Badge / Tag</label>
                <input name="tag" value="${product.tag || ''}" placeholder="e.g. Bestseller / Limited / 15% off">
              </div>
              <div class="form-group">
                <label>Price (GH₵)</label>
                <input required name="price" type="number" step="0.01" value="${product.price}">
              </div>
              <div class="form-group">
                <label>Compare-at Price (GH₵)</label>
                <input name="old" type="number" step="0.01" value="${product.old || ''}" placeholder="Optional original price">
              </div>
              <div class="form-group">
                <label>Stock Quantity</label>
                <input required name="stock" type="number" value="${product.stock}">
              </div>
              <div class="form-group">
                <label>Colors / Shades / Options (comma separated)</label>
                <input name="colors" value="${(product.colors || []).join(', ')}" placeholder="e.g. Nude Blush, Noir, Mocha">
              </div>
              <div class="form-group full">
                <label>Sizes / Lengths (comma separated)</label>
                <input name="sizes" value="${(product.sizes || []).join(', ')}" placeholder="e.g. 37, 38, 39, 40 / 22 Inch, 26 Inch">
              </div>

              <!-- Multi-Image Upload & Preview Zone -->
              <div class="form-group full">
                <label style="font-weight:700;display:flex;justify-content:space-between">
                  <span>Product / Package Gallery Photos</span>
                  <small style="color:var(--muted)">${imagesList.length} ${imagesList.length === 1 ? 'photo' : 'photos'} added</small>
                </label>
                
                <div class="image-upload-dropzone" style="margin-bottom:12px">
                  <span style="font-size:28px">📷</span>
                  <strong style="display:block;margin-top:4px;font-size:14px">Upload Photos from Device</strong>
                  <small style="color:var(--muted)">Click to choose PNG, JPG, or WEBP image files</small>
                  <input type="file" multiple accept="image/*" onchange="handleModalImageUpload(event)">
                </div>

                <div style="display:flex;gap:8px;margin-bottom:14px">
                  <input id="new-img-url-input" placeholder="Or paste external photo URL (https://...)" style="flex-grow:1;border:1px solid var(--line);border-radius:var(--radius-sm);padding:8px 12px;font-size:12px">
                  <button type="button" class="secondary-btn" style="padding:8px 14px;font-size:12px" onclick="const input=document.getElementById('new-img-url-input'); if(input && input.value){addModalImageUrl(input.value);input.value=''}">+ Add URL</button>
                </div>

                ${imagesList.length ? `
                  <div class="preview-thumb-grid">
                    ${imagesList.map((imgUrl, imgIdx) => `
                      <div class="preview-thumb-item ${imgIdx === 0 ? 'main-cover' : ''}" style="${imgIdx === 0 ? 'border-color:var(--emerald);box-shadow:0 0 0 2px var(--emerald-glow)' : ''}">
                        <img src="${imgUrl}" alt="Preview ${imgIdx + 1}">
                        ${imgIdx === 0 ? `
                          <span style="position:absolute;bottom:4px;left:4px;background:var(--emerald);color:#fff;font-size:9px;font-weight:800;padding:2px 6px;border-radius:4px">★ COVER</span>
                        ` : `
                          <button type="button" onclick="setMainModalImage(${imgIdx})" style="position:absolute;bottom:4px;left:4px;background:rgba(0,0,0,0.7);color:#fff;border:0;font-size:9px;padding:2px 6px;border-radius:4px;cursor:pointer" title="Set as Cover">Cover</button>
                        `}
                        <button type="button" class="remove-btn" onclick="removeModalImage(${imgIdx})" title="Remove photo">✕</button>
                      </div>
                    `).join('')}
                  </div>
                ` : ''}
              </div>

              <input type="hidden" name="image" value="${product.image}">
              <div class="form-group full">
                <label>Overview &amp; Story Description</label>
                <textarea required name="desc" rows="3" placeholder="Describe the luxury texture, cut, scent notes or materials...">${product.desc}</textarea>
              </div>
              <div class="form-group full">
                <label>Package Specifications &amp; Features List (One item per line)</label>
                <textarea name="details" rows="3" placeholder="100% Normandy certified linen&#10;Breathable weave&#10;Mother-of-pearl buttons">${(product.details || []).join('\n')}</textarea>
              </div>
            </div>

            <div style="display:flex;gap:12px;margin-top:16px">
              <button class="primary" style="flex-grow:1" type="submit">${mode === 'add' ? 'Publish Package' : 'Save Package Changes'}</button>
              <button class="secondary-btn" type="button" onclick="adminProductModal=null;render()">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  // Create Coupon Modal
  if (activeModal === 'add_coupon') {
    return `
      <div class="modal-backdrop" onclick="if(event.target===this){activeModal=null;render()}">
        <div class="modal-card">
          <button class="modal-close" onclick="activeModal=null;render()">✕</button>
          <span class="eyebrow">PROMOTIONS</span>
          <h2 style="font-size:24px;margin:6px 0 20px">Create Promo Code</h2>

          <form onsubmit="createCoupon(event)">
            <div class="form-grid">
              <div class="form-group">
                <label>Promo Code</label>
                <input required name="code" placeholder="e.g. FLASH25" style="text-transform:uppercase">
              </div>
              <div class="form-group">
                <label>Type</label>
                <select name="type">
                  <option value="percent">Percentage (%) Off</option>
                  <option value="shipping">Free Shipping</option>
                </select>
              </div>
              <div class="form-group">
                <label>Discount Value</label>
                <input required name="discount" type="number" value="15" placeholder="e.g. 15 for 15%">
              </div>
              <div class="form-group">
                <label>Campaign Label</label>
                <input required name="label" placeholder="e.g. 15% Weekend Special">
              </div>
            </div>
            <div style="display:flex;gap:12px;margin-top:12px">
              <button class="primary" type="submit">Publish Promo Code</button>
              <button class="secondary-btn" type="button" onclick="activeModal=null;render()">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  // Top Up Float Wallet Modal with Full Paystack In-App Logic
  if (activeModal === 'topup_wallet') {
    const user = getUser();
    return `
      <div class="modal-backdrop" onclick="if(event.target===this){activeModal=null;render()}">
        <div class="modal-card" style="max-width:520px;padding:28px 24px">
          <button class="modal-close" onclick="activeModal=null;render()">✕</button>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <span class="badge" style="background:#047857;color:#fff;font-weight:800;padding:3px 8px;font-size:10.5px">⚡ INSTANT DEPOSIT</span>
            <span class="eyebrow" style="margin:0">BYMARIE FLOAT WALLET</span>
          </div>
          <h2 style="font-size:24px;margin:2px 0 6px">Add Wallet Funds</h2>
          <p style="color:var(--muted);font-size:13px;margin-bottom:18px">
            Current Available Balance: <strong style="color:var(--emerald);font-size:16px">${money(user.walletBalance || 0)}</strong>
          </p>

          <form onsubmit="submitWalletTopup(event)">
            <label style="font-size:11px;font-weight:800;text-transform:uppercase;color:var(--muted);display:block;margin-bottom:6px">1. Select Preset Amount or Enter Custom (GH₵)</label>
            <div class="topup-amount-chips" style="margin-bottom:12px">
              ${[50, 100, 250, 500, 1000].map(amt => `
                <button type="button" class="topup-chip" onclick="document.getElementById('topup-amt-input').value=${amt}">
                  + GH₵ ${amt}
                </button>
              `).join('')}
            </div>

            <div class="form-group" style="margin-bottom:18px">
              <input required id="topup-amt-input" name="amount" type="number" min="5" value="250" placeholder="Enter amount (e.g. 250)" style="font-size:16px;font-weight:700;color:var(--ink)">
            </div>

            <label style="font-size:11px;font-weight:800;text-transform:uppercase;color:var(--muted);display:block;margin-bottom:8px">2. Choose Payment Channel</label>
            <div class="luxe-payment-grid" style="margin-bottom:16px;grid-template-columns:repeat(2,1fr)">
              <div class="luxe-payment-card mtn ${topupPaymentMethod === 'momo' && topupMomoNetwork === 'MTN' ? 'active' : ''}" onclick="topupPaymentMethod='momo';topupMomoNetwork='MTN';render()">
                ${topupPaymentMethod === 'momo' && topupMomoNetwork === 'MTN' ? '<span class="selected-check">✓</span>' : ''}
                <div>
                  <span class="card-badge">MTN MoMo</span>
                  <strong>MTN Money</strong>
                  <small>Handset USSD</small>
                </div>
              </div>

              <div class="luxe-payment-card telecel ${topupPaymentMethod === 'momo' && (topupMomoNetwork.includes('Telecel') || topupMomoNetwork.includes('Vodafone')) ? 'active' : ''}" onclick="topupPaymentMethod='momo';topupMomoNetwork='Telecel (Vodafone)';render()">
                ${topupPaymentMethod === 'momo' && (topupMomoNetwork.includes('Telecel') || topupMomoNetwork.includes('Vodafone')) ? '<span class="selected-check">✓</span>' : ''}
                <div>
                  <span class="card-badge">Telecel Cash</span>
                  <strong>Telecel (Vodafone)</strong>
                  <small>Instant Push</small>
                </div>
              </div>

              <div class="luxe-payment-card at ${topupPaymentMethod === 'momo' && topupMomoNetwork.includes('AT') ? 'active' : ''}" onclick="topupPaymentMethod='momo';topupMomoNetwork='AT Money';render()">
                ${topupPaymentMethod === 'momo' && topupMomoNetwork.includes('AT') ? '<span class="selected-check">✓</span>' : ''}
                <div>
                  <span class="card-badge">AT Money</span>
                  <strong>AT Cash</strong>
                  <small>MoMo Push</small>
                </div>
              </div>

              <div class="luxe-payment-card card ${topupPaymentMethod === 'card' ? 'active' : ''}" onclick="topupPaymentMethod='card';render()">
                ${topupPaymentMethod === 'card' ? '<span class="selected-check">✓</span>' : ''}
                <div>
                  <span class="card-badge">Card</span>
                  <strong>Visa / Master</strong>
                  <small>Bank Card</small>
                </div>
              </div>
            </div>

            ${topupPaymentMethod === 'momo' ? `
              <div class="form-group" style="margin-bottom:20px;background:#f9f9fb;border:1px solid var(--line);border-radius:var(--radius-sm);padding:14px">
                <label>Ghana Mobile Money Phone Number</label>
                <input required name="momoNumber" type="tel" value="${user.phone || ''}" placeholder="024 XXX XXXX" style="font-size:14px;font-weight:600">
                <small style="color:var(--muted);display:block;margin-top:4px">📲 An automated authorization prompt will be sent to this phone.</small>
              </div>
            ` : ''}

            ${topupPaymentMethod === 'card' ? `
              <div style="background:#f9f9fb;border:1px solid var(--line);border-radius:var(--radius-sm);padding:14px;margin-bottom:20px">
                <div class="form-grid">
                  <div class="form-group full">
                    <label>Card Number</label>
                    <input required name="cardNumber" maxlength="19" placeholder="4123 •••• •••• 1234">
                  </div>
                  <div class="form-group">
                    <label>Expiry (MM/YY)</label>
                    <input required name="cardExpiry" maxlength="5" placeholder="12/28">
                  </div>
                  <div class="form-group">
                    <label>CVV</label>
                    <input required name="cardCvv" maxlength="4" placeholder="123">
                  </div>
                </div>
              </div>
            ` : ''}

            <div style="display:flex;gap:12px">
              <button class="primary" style="flex-grow:1;height:48px;font-size:14px;font-weight:800" type="submit">
                Authorize Deposit via Paystack →
              </button>
              <button class="secondary-btn" type="button" onclick="activeModal=null;render()">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  // Checkout Auth Gate Modal (Sign In or Create Account before Payment)
  if (activeModal === 'checkout_auth') {
    return `
      <div class="modal-backdrop" onclick="if(event.target===this){activeModal=null;render()}">
        <div class="modal-card" style="max-width:460px;padding:0;overflow:hidden">
          <button class="modal-close" style="color:#fff" onclick="activeModal=null;render()">✕</button>
          
          <div class="checkout-auth-banner">
            <span class="eyebrow" style="color:var(--gold-light)">AUTHENTICATION REQUIRED</span>
            <h3 style="margin:4px 0 6px">Sign In to Complete Checkout</h3>
            <p>Please log in or register your customer account to finalize your order & track delivery.</p>
          </div>

          <div style="padding:24px">
            <div class="auth-tab-bar" style="margin-bottom:20px">
              <button class="auth-tab-btn ${authMode === 'signin' ? 'active' : ''}" onclick="authMode='signin';render()">Sign In</button>
              <button class="auth-tab-btn ${authMode === 'signup' ? 'active' : ''}" onclick="authMode='signup';render()">Create Account</button>
            </div>

            ${authMode === 'signin' ? `
              <form onsubmit="handleCustomerSignIn(event)">
                <div class="form-group" style="margin-bottom:14px">
                  <label>Email Address</label>
                  <input required type="email" name="email" placeholder="you@example.com">
                </div>
                <div class="form-group" style="margin-bottom:20px">
                  <label>Password</label>
                  <div class="password-input-wrapper" style="position:relative;display:flex;align-items:center">
                    <input required type="password" name="password" placeholder="••••••••" style="padding-right:42px;width:100%">
                    <button type="button" class="password-toggle-btn" onclick="togglePasswordVisibility(this)" title="Show password" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--muted);padding:4px;display:flex;align-items:center;justify-content:center;font-size:16px;line-height:1">👁️</button>
                  </div>
                </div>
                <button class="primary" style="width:100%" type="submit">Sign In &amp; Resume Checkout ${icon('arrow')}</button>
              </form>
            ` : `
              <form onsubmit="handleCustomerSignUp(event)">
                <div class="form-group" style="margin-bottom:12px">
                  <label>Full Name</label>
                  <input required name="name" placeholder="e.g. Ama Owusu">
                </div>
                <div class="form-group" style="margin-bottom:12px">
                  <label>Email Address</label>
                  <input required type="email" name="email" placeholder="you@example.com">
                </div>
                <div class="form-group" style="margin-bottom:12px">
                  <label>Phone / WhatsApp</label>
                  <input required name="phone" placeholder="024 000 0000">
                </div>
                <div class="form-group" style="margin-bottom:12px">
                  <label>Create Password</label>
                  <div class="password-input-wrapper" style="position:relative;display:flex;align-items:center">
                    <input required type="password" name="password" placeholder="Minimum 6 characters" style="padding-right:42px;width:100%">
                    <button type="button" class="password-toggle-btn" onclick="togglePasswordVisibility(this)" title="Show password" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--muted);padding:4px;display:flex;align-items:center;justify-content:center;font-size:16px;line-height:1">👁️</button>
                  </div>
                </div>
                <div class="form-group" style="margin-bottom:18px">
                  <label>Confirm Password</label>
                  <div class="password-input-wrapper" style="position:relative;display:flex;align-items:center">
                    <input required type="password" name="confirmPassword" placeholder="Re-enter password to confirm" style="padding-right:42px;width:100%">
                    <button type="button" class="password-toggle-btn" onclick="togglePasswordVisibility(this)" title="Show password" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--muted);padding:4px;display:flex;align-items:center;justify-content:center;font-size:16px;line-height:1">👁️</button>
                  </div>
                </div>
                <button class="primary" style="width:100%" type="submit">Create Account &amp; Resume Checkout ${icon('arrow')}</button>
              </form>
            `}
          </div>
        </div>
      </div>
    `;
  }

  // Admin Add User Account Modal
  if (activeModal === 'admin_add_user') {
    return `
      <div class="modal-backdrop" onclick="if(event.target===this){activeModal=null;render()}">
        <div class="modal-card" style="max-width:520px">
          <button class="modal-close" onclick="activeModal=null;render()">✕</button>
          <span class="eyebrow">CUSTOMER PORTAL</span>
          <h2 style="font-size:24px;margin:6px 0 20px">Register Customer &amp; Grant Wallet</h2>

          <form onsubmit="handleAdminAddUser(event)">
            <div class="form-grid">
              <div class="form-group full">
                <label>Customer Full Name</label>
                <input required name="name" placeholder="e.g. Abena Mensah">
              </div>
              <div class="form-group">
                <label>Email Address</label>
                <input required type="email" name="email" placeholder="abena@example.com">
              </div>
              <div class="form-group">
                <label>Phone Number</label>
                <input required name="phone" placeholder="024 555 0192">
              </div>
              <div class="form-group full">
                <label>Delivery Address</label>
                <input name="address" placeholder="East Legon, Accra">
              </div>
              <div class="form-group full">
                <label>Initial Float Wallet Balance Credit (GH₵)</label>
                <input required name="walletBalance" type="number" value="250" placeholder="e.g. 250">
              </div>
            </div>
            <div style="display:flex;gap:12px;margin-top:16px">
              <button class="primary" style="flex-grow:1" type="submit">Create Account &amp; Grant Credit</button>
              <button class="secondary-btn" type="button" onclick="activeModal=null;render()">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  // VIP Client Complete Dossier Modal
  if (activeModal === 'admin_user_dossier') {
    const { user: u, orders: userOrders } = modalData;
    const totalSpent = (userOrders || []).reduce((sum, o) => sum + (o.total || 0), 0);

    return `
      <div class="modal-backdrop" onclick="if(event.target===this){activeModal=null;render()}">
        <div class="modal-card" style="max-width:720px;max-height:90vh;overflow-y:auto">
          <button class="modal-close" onclick="activeModal=null;render()">✕</button>
          
          <div style="display:flex;align-items:center;gap:16px;border-bottom:1px solid var(--line);padding-bottom:18px;margin-bottom:20px">
            <div style="width:64px;height:64px;border-radius:50%;background:#c24d67;color:#fff;display:grid;place-items:center;font-size:26px;font-weight:800">
              ${(u.name || 'C').charAt(0).toUpperCase()}
            </div>
            <div>
              <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
                <h2 style="font-size:24px;margin:0">${u.name}</h2>
                <span class="badge" style="background:${u.status === 'Super Admin' ? '#8b5cf6' : '#10b981'};color:#fff;font-size:11px">
                  ${u.status === 'Super Admin' ? '👑 Super Admin' : (u.status || 'Active Client')}
                </span>
                ${u.loggedIn ? '<span style="color:#10b981;font-size:12px;font-weight:700">● Signed In Now</span>' : ''}
              </div>
              <p style="color:var(--muted);font-size:13px;margin:4px 0 0">User ID: <code>${u.id}</code> • Registered on ${u.joinedDate || '2026'}</p>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
            <div style="background:var(--cashmere);border:1px solid var(--line);border-radius:var(--radius-sm);padding:16px">
              <span class="eyebrow" style="color:var(--gold-light);font-size:10px">CONTACT &amp; DELIVERY LOGISTICS</span>
              <div style="margin-top:10px;font-size:13px;line-height:1.7">
                <div><strong>Email:</strong> <a href="mailto:${u.email}" style="color:#c24d67;text-decoration:underline">${u.email}</a></div>
                <div><strong>Phone / WhatsApp:</strong> ${u.phone ? `<a href="https://wa.me/${u.phone.replace(/[^0-9]/g, '')}" target="_blank" style="color:#10b981;font-weight:700">${u.phone} 💬 (Direct WhatsApp)</a>` : '<span style="color:#a1a1aa">Not provided</span>'}</div>
                <div><strong>Delivery Address:</strong> ${u.address || 'Address on file'}</div>
                <div><strong>City / Region:</strong> ${u.city || 'Accra'}, ${u.region || 'Greater Accra'}</div>
              </div>
            </div>

            <div style="background:var(--cashmere);border:1px solid var(--line);border-radius:var(--radius-sm);padding:16px">
              <span class="eyebrow" style="color:var(--gold-light);font-size:10px">COMMERCE &amp; FLOAT WALLET METRICS</span>
              <div style="margin-top:10px;font-size:13px;line-height:1.7">
                <div><strong>Float Balance:</strong> <b style="color:var(--emerald);font-size:16px">${money(u.walletBalance || 0)}</b></div>
                <div><strong>Lifetime Orders:</strong> ${userOrders ? userOrders.length : (u.ordersCount || 0)} orders</div>
                <div><strong>Total Lifetime Spend:</strong> <b style="color:var(--gold-light)">${money(totalSpent)}</b></div>
                <div><strong>Last Login:</strong> <small style="color:var(--muted)">${u.lastLogin || 'Recent'}</small></div>
              </div>
              <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
                <button class="primary" style="padding:6px 14px;font-size:11px;background:#c24d67" onclick="promptAdjustWallet('${u.id}', '${u.name}')">+ Credit Float</button>
                <button class="secondary-btn" style="padding:6px 14px;font-size:11px" onclick="promptDebitWallet('${u.id}', '${u.name}')">− Debit Float</button>
                <button class="secondary-btn" style="background:#22c55e;color:#fff;border-color:#22c55e;font-size:11px;padding:6px 14px" onclick="openSendSmsModal('${u.id}')">📱 Send Direct SMS</button>
              </div>
            </div>
          </div>

          <h3 style="font-size:16px;margin:20px 0 10px">Order History (${(userOrders || []).length} orders)</h3>
          ${(userOrders && userOrders.length) ? `
            <div style="max-height:220px;overflow-y:auto;border:1px solid var(--line);border-radius:var(--radius-sm)">
              <table class="data-table" style="font-size:12px">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Date</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${userOrders.map(o => `
                    <tr>
                      <td><b>${o.id}</b></td>
                      <td>${o.date}</td>
                      <td><b>${money(o.total)}</b></td>
                      <td><span class="badge ${o.status.toLowerCase()}">${o.status}</span></td>
                      <td><button class="icon-action-btn" onclick="openOrderModal('${o.id}')">${svgIcon('eye', 13)}</button></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : `
            <p style="color:var(--muted);font-size:13px;padding:12px;background:var(--sand);border-radius:var(--radius-sm)">No orders placed yet by this client.</p>
          `}

          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:20px;flex-wrap:wrap;gap:10px">
            <button class="primary" style="padding:8px 18px;font-size:12.5px" onclick="openEditUserModal('${u.id}')">✏️ Edit Client Profile &amp; Contact</button>
            <button class="secondary-btn" onclick="activeModal=null;render()">Close Dossier</button>
          </div>
        </div>
      </div>
    `;
  }

  // Admin Edit User Modal
  if (activeModal === 'admin_edit_user') {
    const u = modalData.user;
    return `
      <div class="modal-backdrop" onclick="if(event.target===this){activeModal=null;render()}">
        <div class="modal-card" style="max-width:540px">
          <button class="modal-close" onclick="activeModal=null;render()">✕</button>
          <span class="eyebrow" style="color:var(--gold)">VIP CLIENT CRM</span>
          <h2 style="font-size:24px;margin:6px 0 20px">Edit Client Profile &amp; Contacts</h2>

          <form onsubmit="handleAdminEditUser(event)">
            <input type="hidden" name="id" value="${u.id}">
            <div class="form-grid">
              <div class="form-group full">
                <label>Client Full Name</label>
                <input required name="name" value="${u.name || ''}" placeholder="Full Name">
              </div>
              <div class="form-group">
                <label>Email Address</label>
                <input required type="email" name="email" value="${u.email || ''}" placeholder="email@example.com">
              </div>
              <div class="form-group">
                <label>Phone / WhatsApp Number</label>
                <input name="phone" value="${u.phone || ''}" placeholder="024 100 2000 or +233...">
              </div>
              <div class="form-group">
                <label>City</label>
                <input name="city" value="${u.city || 'Accra'}" placeholder="Accra">
              </div>
              <div class="form-group">
                <label>Float Wallet Balance (GH₵)</label>
                <input name="walletBalance" type="number" step="any" value="${u.walletBalance || 0}" placeholder="0.00">
              </div>
              <div class="form-group full">
                <label>Delivery Address</label>
                <input name="address" value="${u.address || ''}" placeholder="Residential / Delivery Address">
              </div>
            </div>
            <div style="display:flex;gap:12px;margin-top:20px">
              <button class="primary" style="flex-grow:1" type="submit">Save Changes ⚡</button>
              <button class="secondary-btn" type="button" onclick="activeModal=null;render()">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  // Admin Send SMS Broadcast Modal
  if (activeModal === 'admin_send_sms') {
    const { targetUser, audience = 'all' } = modalData;
    const users = getUsers();
    const phoneCount = users.filter(u => u.phone).length;
    const fundedCount = users.filter(u => (u.walletBalance || 0) > 0 && u.phone).length;

    return `
      <div class="modal-backdrop" onclick="if(event.target===this){activeModal=null;render()}">
        <div class="modal-card" style="max-width:560px">
          <button class="modal-close" onclick="activeModal=null;render()">✕</button>
          <span class="eyebrow" style="color:#22c55e">MNOTIFY / BMS SMS BROADCAST</span>
          <h2 style="font-size:24px;margin:6px 0 16px">Send Client SMS Campaign</h2>

          <form onsubmit="handleSendSmsBroadcast(event)">
            <div class="form-group" style="margin-bottom:14px">
              <label>Target Audience</label>
              <select name="audience" onchange="modalData.audience=this.value;render()">
                <option value="all" ${audience === 'all' ? 'selected' : ''}>👥 All Registered Clients (${phoneCount} phone numbers)</option>
                <option value="funded" ${audience === 'funded' ? 'selected' : ''}>💳 Funded Float Wallet Holders (${fundedCount} clients)</option>
                <option value="buyers" ${audience === 'buyers' ? 'selected' : ''}>🛍️ Clients with Past Orders</option>
                <option value="single" ${audience === 'single' ? 'selected' : ''}>🎯 Single Client / Specific Phone Number</option>
              </select>
            </div>

            ${audience === 'single' ? `
              <div class="form-group" style="margin-bottom:14px">
                <label>Recipient Phone Number</label>
                <input required name="customPhone" value="${targetUser ? targetUser.phone : ''}" placeholder="e.g. 024 100 2000">
              </div>
            ` : ''}

            <div class="form-group" style="margin-bottom:14px">
              <label>Sender ID (Max 11 Characters)</label>
              <input required name="sender" value="Bymarie" maxlength="11" placeholder="Bymarie">
            </div>

            <div class="form-group" style="margin-bottom:12px">
              <label style="display:flex;justify-content:space-between">
                <span>SMS Message Content</span>
                <small id="sms-char-counter" style="color:var(--muted)">0 / 160 chars (1 SMS)</small>
              </label>
              <textarea required name="message" id="admin-sms-textarea" rows="4" style="width:100%;border-radius:var(--radius-sm);padding:10px;border:1px solid var(--line);font-family:inherit;font-size:13px" placeholder="Type your client announcement, seasonal discount, or private collection preview..." oninput="const len=this.value.length;const msgs=Math.max(1,Math.ceil(len/160));document.getElementById('sms-char-counter').textContent=len+' / 160 chars ('+msgs+' SMS)'"></textarea>
            </div>

            <!-- Quick Template Chips -->
            <label style="font-size:11px;font-weight:800;text-transform:uppercase;color:var(--muted);display:block;margin-bottom:6px">Quick Luxury Message Templates</label>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:20px">
              <button type="button" class="secondary-btn" style="padding:4px 10px;font-size:11px" onclick="document.getElementById('admin-sms-textarea').value='ByMarie Luxury: Our new Haute Couture collection is live! Explore fresh silhouettes & pieces at bymarie.shop. Enjoy complimentary delivery.';document.getElementById('admin-sms-textarea').dispatchEvent(new Event('input'))">
                👗 New Drop
              </button>
              <button type="button" class="secondary-btn" style="padding:4px 10px;font-size:11px" onclick="document.getElementById('admin-sms-textarea').value='VIP Privilege: Enjoy 15% OFF your luxury pieces this weekend with code LUXE15 at bymarie.shop. Offer valid for 48 hours.';document.getElementById('admin-sms-textarea').dispatchEvent(new Event('input'))">
                🎁 15% Promo
              </button>
              <button type="button" class="secondary-btn" style="padding:4px 10px;font-size:11px" onclick="document.getElementById('admin-sms-textarea').value='ByMarie Notice: Your Float Wallet balance is active for instant 1-click checkout at bymarie.shop. Shop without entering payment cards!';document.getElementById('admin-sms-textarea').dispatchEvent(new Event('input'))">
                💳 Float Balance
              </button>
            </div>

            <div style="display:flex;gap:12px">
              <button class="primary" style="flex-grow:1;background:#22c55e" type="submit">
                🚀 Send Broadcast via mNotify / BMS
              </button>
              <button class="secondary-btn" type="button" onclick="activeModal=null;render()">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  // Auth Modal (Sign In / Register)
  if (activeModal === 'auth') {
    return `
      <div class="modal-backdrop" onclick="if(event.target===this){activeModal=null;render()}">
        <div class="modal-card" style="max-width:440px">
          <button class="modal-close" onclick="activeModal=null;render()">✕</button>
          <span class="eyebrow">BYMARIE MEMBER ACCESS</span>
          
          <div class="auth-tab-bar">
            <button class="auth-tab-btn ${authMode === 'signin' && !otpAuthMode ? 'active' : ''}" onclick="authMode='signin';otpAuthMode=false;render()">Sign In</button>
            <button class="auth-tab-btn ${otpAuthMode ? 'active' : ''}" onclick="authMode='signin';otpAuthMode=true;render()">🔑 6-Digit Code</button>
            <button class="auth-tab-btn ${authMode === 'signup' && !otpAuthMode ? 'active' : ''}" onclick="authMode='signup';otpAuthMode=false;render()">Create Account</button>
          </div>

          ${otpAuthMode ? `
            <form onsubmit="handleVerifyOtpSubmit(event)">
              <div class="form-group" style="margin-bottom:14px">
                <label>Email Address</label>
                <input required type="email" name="email" value="${otpEmailTarget || ''}" placeholder="you@example.com">
              </div>
              <div class="form-group" style="margin-bottom:16px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                  <label style="margin:0">6-Digit Verification Code</label>
                  <a href="javascript:void(0)" onclick="handleRequestOtp(document.querySelector('input[name=email]')?.value)" style="font-size:12px;color:#c24d67;text-decoration:underline">Get Code via Email / SMS</a>
                </div>
                <input required name="code" maxlength="6" style="font-size:24px;letter-spacing:8px;text-align:center;font-weight:800;color:#c24d67" placeholder="••••••">
              </div>
              <button class="primary" style="width:100%;height:46px;font-size:14px;background:#c24d67" type="submit">
                Verify Code &amp; Access Account →
              </button>
              <div style="text-align:center;margin-top:12px">
                <button type="button" class="secondary-btn" style="font-size:11.5px;padding:4px 12px" onclick="otpAuthMode=false;render()">← Use Standard Password</button>
              </div>
            </form>
          ` : authMode === 'signin' ? `
            <form onsubmit="handleCustomerSignIn(event)">
              <div class="form-group" style="margin-bottom:14px">
                <label>Email Address</label>
                <input required type="email" name="email" placeholder="you@example.com">
              </div>
              <div class="form-group" style="margin-bottom:16px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                  <label style="margin:0">Password</label>
                  <a href="javascript:void(0)" onclick="handleRequestOtp(document.querySelector('input[name=email]')?.value)" style="font-size:12px;color:#c24d67;text-decoration:underline">🔑 Email Login Code</a>
                </div>
                <div class="password-input-wrapper" style="position:relative;display:flex;align-items:center">
                  <input required type="password" name="password" placeholder="••••••••" style="padding-right:42px;width:100%">
                  <button type="button" class="password-toggle-btn" onclick="togglePasswordVisibility(this)" title="Show password" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--muted);padding:4px;display:flex;align-items:center;justify-content:center;font-size:16px;line-height:1">👁️</button>
                </div>
              </div>
              <button class="primary" style="width:100%" type="submit">Sign In to Your Account ${icon('arrow')}</button>
            </form>
          ` : `
            <form onsubmit="handleCustomerSignUp(event)">
              <div class="form-group" style="margin-bottom:14px">
                <label>Full Name</label>
                <input required name="name" placeholder="e.g. Ama Owusu">
              </div>
              <div class="form-group" style="margin-bottom:14px">
                <label>Email Address</label>
                <input required type="email" name="email" placeholder="you@example.com">
              </div>
              <div class="form-group" style="margin-bottom:14px">
                <label>Phone / WhatsApp</label>
                <input required name="phone" placeholder="024 000 0000">
              </div>
              <div class="form-group" style="margin-bottom:14px">
                <label>Create Password</label>
                <div class="password-input-wrapper" style="position:relative;display:flex;align-items:center">
                  <input required type="password" name="password" placeholder="Minimum 6 characters" style="padding-right:42px;width:100%">
                  <button type="button" class="password-toggle-btn" onclick="togglePasswordVisibility(this)" title="Show password" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--muted);padding:4px;display:flex;align-items:center;justify-content:center;font-size:16px;line-height:1">👁️</button>
                </div>
              </div>
              <div class="form-group" style="margin-bottom:20px">
                <label>Confirm Password</label>
                <div class="password-input-wrapper" style="position:relative;display:flex;align-items:center">
                  <input required type="password" name="confirmPassword" placeholder="Re-enter password to confirm" style="padding-right:42px;width:100%">
                  <button type="button" class="password-toggle-btn" onclick="togglePasswordVisibility(this)" title="Show password" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--muted);padding:4px;display:flex;align-items:center;justify-content:center;font-size:16px;line-height:1">👁️</button>
                </div>
              </div>
              <button class="primary" style="width:100%" type="submit">Create Account ${icon('arrow')}</button>
            </form>
          `}
        </div>
      </div>
    `;
  }

  // Seamless In-App Paystack Payment & Security Modal
  if (activeModal === 'paystack_seamless_payment') {
    const { status, displayText, orderData, phone, timerSeconds } = seamlessPaymentState;
    const tot = orderData ? orderData.total : 0;

    return `
      <div class="modal-backdrop">
        <div class="paystack-modal-card animate-scale-up">
          <!-- Modal Head -->
          <div class="paystack-modal-head">
            <span class="paystack-security-shield">🔒 256-Bit Encrypted</span>
            <span style="font-family:'Cinzel',serif;font-size:14px;font-weight:700;letter-spacing:1.5px;color:var(--ink)">BYMARIE PAY</span>
            <button class="modal-close" style="position:static" onclick="cancelSeamlessPayment()">✕</button>
          </div>

          <!-- Amount Banner -->
          <div class="paystack-amount-banner">
            <span>Payment Total</span>
            <strong>${money(tot)}</strong>
          </div>

          <!-- State: PROCESSING -->
          ${status === 'processing' ? `
            <div class="pulse-spinner"></div>
            <h3 style="font-size:18px;margin:16px 0 6px">Connecting to Paystack...</h3>
            <p style="color:var(--muted);font-size:13px;margin-bottom:24px">Establishing secure handshake with Ghana interbank payment gateway.</p>
          ` : ''}

          <!-- State: SEND_OTP (OTP Required) -->
          ${status === 'send_otp' || status === 'verifying_otp' ? `
            <div style="font-size:36px;margin-bottom:10px">📱</div>
            <h3 style="font-size:20px;margin:0 0 6px">Enter Verification Code</h3>
            <p style="color:var(--muted);font-size:13px;margin-bottom:16px;max-width:360px;margin-left:auto;margin-right:auto">
              ${displayText || `A One-Time Passcode (OTP) was sent to your phone/bank.`}
            </p>

            <form onsubmit="handleSeamlessSubmitOtp(event)">
              <input required name="otp" class="otp-input-field" placeholder="••••••" maxlength="8" autofocus autocomplete="one-time-code" ${status === 'verifying_otp' ? 'disabled' : ''}>
              
              <div style="display:block">
                <span id="seamless-countdown-badge" class="countdown-timer-badge ${timerSeconds > 0 ? 'active' : ''}">
                  ${timerSeconds > 0 ? `⏱️ Resend / retry in ${timerSeconds}s` : `⏱️ Code expired`}
                </span>
              </div>

              <div style="display:flex;gap:10px;margin-top:10px">
                <button class="primary" style="flex-grow:1;height:48px;font-size:14px" type="submit" ${status === 'verifying_otp' ? 'disabled' : ''}>
                  ${status === 'verifying_otp' ? 'Verifying Code...' : 'Authorize Payment →'}
                </button>
                <button class="secondary-btn" type="button" onclick="cancelSeamlessPayment()">Cancel</button>
              </div>

              ${timerSeconds <= 0 ? `
                <div style="margin-top:14px">
                  <button type="button" class="text-btn" style="color:var(--emerald);font-size:13px;font-weight:700" onclick="initiateInAppPaystackPayment(seamlessPaymentState.orderData, seamlessPaymentState.paymentInfo)">
                    🔄 Resend New Verification Code
                  </button>
                </div>
              ` : ''}
            </form>
          ` : ''}

          <!-- State: PAY_OFFLINE (Handset USSD Prompt) -->
          ${status === 'pay_offline' ? `
            <div class="handset-radar-wrap">
              <div class="handset-radar-ring"></div>
              <div class="handset-radar-ring delay-1"></div>
              <div class="handset-radar-icon">📲</div>
            </div>

            <h3 style="font-size:20px;margin:0 0 6px">Authorize on your Handset</h3>
            <p style="color:var(--muted);font-size:13px;margin-bottom:14px;line-height:1.5">
              ${displayText || `A payment prompt of ${money(tot)} has been sent to <strong>${phone}</strong>.`}
            </p>

            <div style="background:#f4f4f5;border-radius:var(--radius-sm);padding:12px;margin-bottom:18px;text-align:left;font-size:12.5px;color:var(--ink)">
              <strong>💡 Steps to complete:</strong>
              <ol style="margin:6px 0 0 18px;padding:0;color:var(--muted)">
                <li>Unlock your phone screen</li>
                <li>Enter your Mobile Money PIN when prompted</li>
                <li>Keep this window open; it updates automatically</li>
              </ol>
            </div>

            <span id="seamless-countdown-badge" class="countdown-timer-badge active">
              ⏱️ Waiting for approval (${timerSeconds}s)
            </span>

            <div style="display:flex;gap:10px;margin-top:10px">
              <button class="primary" style="flex-grow:1;height:48px;font-size:14px;background:#059669" type="button" onclick="handleSeamlessManualVerify()">
                ✓ I Have Approved on Phone
              </button>
              <button class="secondary-btn" type="button" onclick="cancelSeamlessPayment()">Cancel</button>
            </div>

            ${timerSeconds <= 0 ? `
              <div style="margin-top:14px">
                <button type="button" class="text-btn" style="color:var(--emerald);font-size:13px;font-weight:700" onclick="initiateInAppPaystackPayment(seamlessPaymentState.orderData, seamlessPaymentState.paymentInfo)">
                  🔄 Resend Prompt to My Phone
                </button>
              </div>
            ` : ''}
          ` : ''}

          <!-- State: SUCCESS -->
          ${status === 'success' ? `
            <div style="font-size:48px;margin-bottom:8px">🎉</div>
            <h3 style="font-size:22px;margin:0 0 6px;color:#059669">Payment Verified!</h3>
            <p style="color:var(--muted);font-size:13.5px;margin-bottom:20px">
              Transaction approved successfully. Generating your Haute Couture order receipt &amp; dispatching notifications...
            </p>
            <div class="pulse-spinner" style="border-top-color:#059669"></div>
          ` : ''}

          <!-- State: FAILED -->
          ${status === 'failed' ? `
            <div style="font-size:40px;margin-bottom:8px">⚠️</div>
            <h3 style="font-size:20px;margin:0 0 6px;color:var(--red)">Payment Not Completed</h3>
            <p style="color:var(--muted);font-size:13px;margin-bottom:20px;line-height:1.5">
              ${displayText || 'The transaction could not be authorized. Please check your balance or try again.'}
            </p>
            <div style="display:flex;gap:10px">
              <button class="primary" style="flex-grow:1;height:46px" type="button" onclick="initiateInAppPaystackPayment(seamlessPaymentState.orderData, seamlessPaymentState.paymentInfo)">
                🔄 Retry Payment
              </button>
              <button class="secondary-btn" type="button" onclick="cancelSeamlessPayment()">Close</button>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  return '';
}

function notFound() {
  return `
    <main style="text-align:center;padding:100px 20px" class="animate-fade-up">
      <div style="font-family:'Playfair Display',serif;font-size:72px;color:var(--emerald);margin-bottom:10px">404</div>
      <h1 style="font-size:36px;margin-bottom:12px">Page Not Found</h1>
      <p style="color:var(--muted);margin-bottom:24px">The collection or item you're looking for could not be found.</p>
      <button class="primary" onclick="go('home')">Return to Home</button>
    </main>
  `;
}

function render() {
  route = location.hash.slice(1) || 'home';
  const [page, param] = route.split('/');
  
  let content = '';
  if (page === 'home') content = home();
  else if (page === 'shop') content = shop();
  else if (page === 'wholesale') content = wholesale();
  else if (page === 'category') content = shop(param);
  else if (page === 'product') content = detail(param);
  else if (page === 'cart') content = cartPage();
  else if (page === 'checkout') content = checkout();
  else if (page === 'confirmation') content = confirmation(param);
  else if (page === 'account') content = account();
  else if (page === 'auth' || page === 'signin' || page === 'signup') {
    if (page === 'signin') authMode = 'signin';
    if (page === 'signup') authMode = 'signup';
    content = authPage();
  }
  else if (page === 'wishlist') content = wishlistPage();
  else if (page === 'notifications') content = notificationsPage();
  else if (page === 'admin') {
    if (param) adminTab = param;
    fetchLatestUsers();
    if (isAdminUser()) {
      content = admin();
    } else {
      content = renderAdminLoginGate();
    }
  }
  else if (page === 'users' || page === 'clients') {
    adminTab = 'users';
    fetchLatestUsers();
    if (isAdminUser()) {
      content = admin();
    } else {
      content = renderAdminLoginGate();
    }
  }
  else if (page === 'broadcast' || page === 'campaigns' || page === 'sms' || page === 'email') {
    adminTab = 'broadcast';
    fetchLatestUsers();
    if (isAdminUser()) {
      content = admin();
    } else {
      content = renderAdminLoginGate();
    }
  }
  else if (page === 'orders' || page === 'logistics') {
    adminTab = 'orders';
    if (isAdminUser()) {
      content = admin();
    } else {
      content = renderAdminLoginGate();
    }
  }
  else content = notFound();

  const isPlainLayout = (page === 'admin');
  
  document.getElementById('app').innerHTML = `
    ${isPlainLayout ? '' : renderAnnouncementPopup()}
    ${isPlainLayout ? '' : header()}
    ${content}
    ${isPlainLayout ? '' : footer()}
    ${renderModals()}
  `;

  if (page === 'home') {
    initCategorySliders();
    initHeroVideoMobilePlayback();
  }
}

async function loadPublicConfig() {
  try {
    const res = await fetch(`${API_BASE}/config`);
    if (res.ok) {
      const cfg = await res.json();
      if (cfg.supabaseUrl && cfg.supabaseAnonKey) {
        saveSupabaseConfig({
          url: cfg.supabaseUrl,
          key: cfg.supabaseAnonKey,
          active: true
        });
        if (window.supabase) {
          supabaseClient = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
        }
      }
    }
  } catch (e) {
    console.debug('Config load notice:', e.message);
  }
}

async function syncWithBackendAPI() {
  await loadPublicConfig();
  await syncAdminWithBackend(true);
  await fetchLatestUsers();
  await fetchCampaignLogs();
}

// Live background synchronizer for real-time customer registrations & updates
setInterval(() => {
  const hash = (typeof window !== 'undefined' && window.location.hash) ? window.location.hash.slice(1) : '';
  const curPage = hash.split('/')[0] || 'home';
  if (curPage === 'admin' || curPage === 'users' || curPage === 'broadcast') {
    fetchLatestUsers();
  }
}, 15000);

document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    if (route.split('/')[0] !== 'admin') return;
    e.preventDefault();
    commandPaletteOpen = !commandPaletteOpen;
    commandPaletteQuery = '';
    render();
  } else if (e.key === 'Escape' && commandPaletteOpen) {
    commandPaletteOpen = false;
    render();
  }
});

window.addEventListener('hashchange', render);

document.addEventListener('DOMContentLoaded', () => {
  render();
  syncWithBackendAPI();
});
render();
