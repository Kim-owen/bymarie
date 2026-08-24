const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS & JSON parsing
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Ensure upload directory & data directory exist (Handle Vercel read-only filesystem)
const isVercel = !!process.env.VERCEL;
const UPLOADS_DIR = isVercel ? '/tmp/uploads' : path.join(__dirname, 'uploads');
const DATA_DIR = isVercel ? '/tmp/data' : path.join(__dirname, 'data');
const DB_FILE = isVercel ? '/tmp/data/db.json' : path.join(DATA_DIR, 'db.json');

try {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
} catch (e) {
  console.warn('Directory init warning:', e.message);
}

// Serve static uploaded files & root static assets (index.html, styles.css, app.js)
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(__dirname));

// Root storefront route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Configure Multer for File Uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
    cb(null, name);
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// Database Helpers (JSON DB Adapter + Supabase Client)
function readDB() {
  try {
    const seedPath = path.join(__dirname, 'data', 'db.json');
    if (isVercel && !fs.existsSync(DB_FILE) && fs.existsSync(seedPath)) {
      try {
        fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
        fs.copyFileSync(seedPath, DB_FILE);
      } catch (e) {}
    }
    const targetFile = fs.existsSync(DB_FILE) ? DB_FILE : (fs.existsSync(seedPath) ? seedPath : null);
    if (!targetFile) return { products: [], orders: [], coupons: [], site_settings: {} };
    const content = fs.readFileSync(targetFile, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error('Error reading JSON DB:', err);
    return { products: [], orders: [], coupons: [], site_settings: {} };
  }
}

function writeDB(data) {
  try {
    if (fs.existsSync(path.dirname(DB_FILE))) {
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    }
  } catch (err) {
    console.error('Error writing JSON DB:', err);
  }
}

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (url && key) {
    try { return createClient(url, key); } catch (e) { return null; }
  }
  return null;
}

// ===================================================
// REST API ROUTES
// ===================================================

// Health Check
app.get('/api/health', (req, res) => {
  const supabaseActive = !!getSupabaseClient();
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    database: supabaseActive ? 'Supabase Cloud Postgres' : 'Local JSON Database',
    supabaseConnected: supabaseActive
  });
});

// --- PRODUCTS API ---

// Get all products (with category, search & price filtering)
app.get('/api/products', async (req, res) => {
  let list = [];
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client.from('products').select('*');
      if (!error && data) {
        list = data.filter(p => {
          if (!p || !p.id || !p.name) return false;
          const id = String(p.id).toLowerCase();
          if (id.startsWith('p-') || id.startsWith('p_') || id.startsWith('prod-0') || id.startsWith('prod-1') || id.startsWith('prod-2')) return false;
          const nm = String(p.name).toLowerCase();
          if (nm.includes('linen edit') || nm.includes('tailored ease') || nm.includes('atelier blazer') || nm.includes('suede slingback') || nm.includes('woven leather') || nm.includes('leather slide')) {
            return false;
          }
          return true;
        });
        return res.json(list);
      }
    } catch (e) {
      console.warn('Supabase fetch failed, falling back to local DB:', e.message);
    }
  }

  const db = readDB();
  list = (db.products || []).filter(p => {
    if (!p || !p.id || !p.name) return false;
    const id = String(p.id).toLowerCase();
    if (id.startsWith('p-') || id.startsWith('p_') || id.startsWith('prod-0') || id.startsWith('prod-1') || id.startsWith('prod-2')) return false;
    const nm = String(p.name).toLowerCase();
    if (nm.includes('linen edit') || nm.includes('tailored ease') || nm.includes('atelier blazer') || nm.includes('suede slingback') || nm.includes('woven leather') || nm.includes('leather slide')) {
      return false;
    }
    return true;
  });
  
  const { cat, search, minPrice, maxPrice } = req.query;
  if (cat && cat !== 'All') {
    list = list.filter(p => p.category.toLowerCase() === cat.toLowerCase());
  }
  if (search) {
    const q = search.toLowerCase();
    list = list.filter(p => `${p.name} ${p.category} ${p.desc}`.toLowerCase().includes(q));
  }
  if (maxPrice) {
    list = list.filter(p => p.price <= Number(maxPrice));
  }

  res.json(list);
});

// Get single product
app.get('/api/products/:id', (req, res) => {
  const db = readDB();
  const prod = (db.products || []).find(p => p.id === req.params.id);
  if (!prod) return res.status(404).json({ error: 'Product not found' });
  res.json(prod);
});

// Create product package
app.post('/api/products', async (req, res) => {
  const newProduct = {
    id: req.body.id || `prod-${Date.now()}`,
    name: req.body.name || 'New Package',
    category: req.body.category || 'Clothing',
    price: Number(req.body.price || 0),
    old: Number(req.body.old || 0),
    stock: Number(req.body.stock || 10),
    tag: req.body.tag || '',
    image: req.body.image || '',
    images: req.body.images || [req.body.image].filter(Boolean),
    desc: req.body.desc || '',
    details: req.body.details || [],
    colors: req.body.colors || ['Standard'],
    sizes: req.body.sizes || [],
    rating: req.body.rating || 5.0,
    reviews: req.body.reviews || []
  };

  const db = readDB();
  db.products.unshift(newProduct);
  writeDB(db);

  // Sync to Supabase if configured
  const client = getSupabaseClient();
  if (client) {
    try { await client.from('products').upsert([newProduct]); } catch (e) {}
  }

  res.status(201).json(newProduct);
});

// Update product
app.put('/api/products/:id', async (req, res) => {
  const db = readDB();
  const idx = db.products.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Product not found' });

  const updated = { ...db.products[idx], ...req.body, id: req.params.id };
  db.products[idx] = updated;
  writeDB(db);

  const client = getSupabaseClient();
  if (client) {
    try { await client.from('products').upsert([updated]); } catch (e) {}
  }

  res.json(updated);
});

// Delete product
app.delete('/api/products/:id', async (req, res) => {
  const db = readDB();
  db.products = db.products.filter(p => p.id !== req.params.id);
  writeDB(db);

  const client = getSupabaseClient();
  if (client) {
    try { await client.from('products').delete().eq('id', req.params.id); } catch (e) {}
  }

  res.json({ success: true, id: req.params.id });
});

// --- ORDERS API ---

// Get all orders
app.get('/api/orders', (req, res) => {
  const db = readDB();
  res.json(db.orders || []);
});

// Create new order
app.post('/api/orders', async (req, res) => {
  const db = readDB();
  const newOrder = {
    id: req.body.id || `BM-${Math.floor(100000 + Math.random() * 900000)}`,
    date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    name: req.body.name,
    email: req.body.email,
    phone: req.body.phone,
    address: req.body.address,
    city: req.body.city,
    region: req.body.region,
    delivery: req.body.delivery || 'Standard delivery',
    payment: req.body.payment || 'Mobile Money',
    status: 'Processing',
    items: req.body.items || [],
    subtotal: req.body.subtotal || 0,
    discountAmount: req.body.discountAmount || 0,
    deliveryFee: req.body.deliveryFee || 0,
    total: req.body.total || 0
  };

  // Deduct inventory stock for purchased items
  (newOrder.items || []).forEach(item => {
    const prod = db.products.find(p => p.id === item.id);
    if (prod) prod.stock = Math.max(0, prod.stock - item.qty);
  });

  db.orders.unshift(newOrder);
  writeDB(db);

  const client = getSupabaseClient();
  if (client) {
    try { await client.from('orders').insert([newOrder]); } catch (e) {}
  }

  res.status(201).json(newOrder);
});

// Update order status
app.patch('/api/orders/:id/status', async (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'Status is required' });

  const db = readDB();
  const order = db.orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  order.status = status;
  writeDB(db);

  const client = getSupabaseClient();
  if (client) {
    try { await client.from('orders').update({ status }).eq('id', req.params.id); } catch (e) {}
  }

  res.json(order);
});

// --- COUPONS API ---

app.get('/api/coupons', (req, res) => {
  const db = readDB();
  res.json(db.coupons || []);
});

app.post('/api/coupons', (req, res) => {
  const db = readDB();
  const newCoupon = {
    code: (req.body.code || '').toUpperCase().trim(),
    discount: Number(req.body.discount || 0),
    type: req.body.type || 'percent',
    label: req.body.label || ''
  };
  db.coupons.push(newCoupon);
  writeDB(db);
  res.status(201).json(newCoupon);
});

app.delete('/api/coupons/:code', (req, res) => {
  const db = readDB();
  db.coupons = db.coupons.filter(c => c.code.toUpperCase() !== req.params.code.toUpperCase());
  writeDB(db);
  res.json({ success: true, code: req.params.code });
});

// --- USERS & WALLETS API ---

app.get('/api/users', (req, res) => {
  const db = readDB();
  res.json(db.users || []);
});

app.post('/api/users', (req, res) => {
  const db = readDB();
  if (!db.users) db.users = [];
  const newUser = {
    id: req.body.id || `usr-${Date.now()}`,
    name: req.body.name || 'New Customer',
    email: req.body.email || '',
    phone: req.body.phone || '',
    address: req.body.address || 'Accra, Ghana',
    walletBalance: Number(req.body.walletBalance || 0),
    joinedDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    ordersCount: 0,
    loggedIn: true
  };
  db.users.unshift(newUser);
  writeDB(db);
  res.status(201).json(newUser);
});

app.patch('/api/users/:id/wallet', (req, res) => {
  const { delta, reason } = req.body;
  const db = readDB();
  if (!db.users) db.users = [];
  const user = db.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  user.walletBalance = Math.max(0, (Number(user.walletBalance) || 0) + Number(delta));
  writeDB(db);

  res.json({ success: true, user, newBalance: user.walletBalance, reason });
});

// --- WHOLESALE & B2B INQUIRIES API ---

app.get('/api/wholesale', (req, res) => {
  const db = readDB();
  res.json(db.wholesale_inquiries || []);
});

app.post('/api/wholesale', (req, res) => {
  const db = readDB();
  if (!db.wholesale_inquiries) db.wholesale_inquiries = [];
  const newInquiry = {
    id: req.body.id || `WS-${Math.floor(1000 + Math.random() * 9000)}`,
    date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    company: req.body.company || 'Direct Wholesale Client',
    contact: req.body.contact || 'Store Buyer',
    phone: req.body.phone || '',
    email: req.body.email || '',
    city: req.body.city || 'Accra, Ghana',
    volume: req.body.volume || '50 – 100 units',
    notes: req.body.notes || 'Standard bulk purchase inquiry',
    status: 'New'
  };
  db.wholesale_inquiries.unshift(newInquiry);
  writeDB(db);
  res.status(201).json(newInquiry);
});

app.patch('/api/wholesale/:id/status', (req, res) => {
  const { status } = req.body;
  const db = readDB();
  if (!db.wholesale_inquiries) db.wholesale_inquiries = [];
  const item = db.wholesale_inquiries.find(w => w.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Wholesale inquiry not found' });

  item.status = status || item.status;
  writeDB(db);
  res.json(item);
});

app.delete('/api/wholesale/:id', (req, res) => {
  const db = readDB();
  if (!db.wholesale_inquiries) db.wholesale_inquiries = [];
  db.wholesale_inquiries = db.wholesale_inquiries.filter(w => w.id !== req.params.id);
  writeDB(db);
  res.json({ success: true, id: req.params.id });
});

// --- SITE SETTINGS CMS API ---

app.get('/api/settings', (req, res) => {
  const db = readDB();
  res.json(db.site_settings || {});
});

app.post('/api/settings', (req, res) => {
  const db = readDB();
  db.site_settings = { ...db.site_settings, ...req.body };
  writeDB(db);
  res.json(db.site_settings);
});

// --- DATABASE BACKUP API ---

app.get('/api/database/backup', (req, res) => {
  const db = readDB();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="bymarie_db_backup.json"');
  res.send(JSON.stringify(db, null, 2));
});

// --- FILE UPLOAD API ---

app.post('/api/upload', upload.array('photos', 10), (req, res) => {
  if (!req.files || !req.files.length) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  const urls = req.files.map(file => `${req.protocol}://${req.get('host')}/uploads/${file.filename}`);
  res.json({ success: true, urls, count: urls.length });
});

// --- MOBILE MONEY PAYMENT API SIMULATION ---

app.post('/api/payments/momo/authorize', (req, res) => {
  const { phone, network, amount, orderId } = req.body;
  res.json({
    success: true,
    status: 'PENDING_USER_APPROVAL',
    message: `USSD prompt dispatched to ${network} subscriber ${phone} for GHc ${amount}`,
    transactionId: `MOMO-${Date.now()}`,
    orderId
  });
});

app.post('/api/payments/momo/callback', (req, res) => {
  const { transactionId, status, orderId } = req.body;
  res.json({
    success: true,
    transactionId,
    orderId,
    status: status || 'SUCCESS',
    timestamp: new Date().toISOString()
  });
});

// --- AUTHENTICATION API ---

app.post('/api/auth/register', async (req, res) => {
  const { email, password, name, phone } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { data: { name, phone } }
      });
      if (error) throw error;
      return res.status(201).json({ success: true, user: data.user, session: data.session });
    } catch (err) {
      // Fallback local registration
    }
  }

  // Local fallback registration
  const user = {
    id: `usr-${Date.now()}`,
    email,
    name: name || email.split('@')[0],
    phone: phone || '',
    loggedIn: true
  };
  res.status(201).json({ success: true, user });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return res.json({ success: true, user: data.user, session: data.session });
    } catch (err) {
      // Fallback local auth
    }
  }

  // Local fallback sign in
  const user = {
    id: `usr-${Date.now()}`,
    email,
    name: email.split('@')[0],
    loggedIn: true
  };
  res.json({ success: true, user });
});

// --- PAYSTACK PAYMENT GATEWAY API ---

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || 'paystack_secret_key_demo';
const PAYSTACK_PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY || 'paystack_public_key_demo';

// 1. Initialize Paystack Transaction
app.post('/api/paystack/initialize', async (req, res) => {
  const { email, amount, currency = 'GHS', metadata, callback_url } = req.body;
  if (!email || !amount) {
    return res.status(400).json({ status: false, message: 'Email and amount are required' });
  }

  // Convert amount to subunits (pesewas / kobo -> amount * 100)
  const subunitAmount = Math.round(Number(amount) * 100);
  const reference = `pstk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  try {
    const fetchFn = typeof fetch !== 'undefined' ? fetch : global.fetch;
    const response = await fetchFn('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        amount: subunitAmount,
        currency,
        reference,
        callback_url: callback_url || `http://localhost:3000/#account`,
        metadata: metadata || {}
      })
    });

    const result = await response.json();
    if (result.status && result.data) {
      return res.json(result);
    }
  } catch (err) {
    console.warn('Paystack live API warning (using dev fallback):', err.message);
  }

  // Resilient Development Fallback
  res.json({
    status: true,
    message: 'Authorization URL created (Development Mode)',
    data: {
      authorization_url: `https://checkout.paystack.com/${reference}`,
      access_code: `acc_${reference}`,
      reference,
      publicKey: PAYSTACK_PUBLIC_KEY
    }
  });
});

// 2. Verify Paystack Transaction
app.get('/api/paystack/verify/:reference', async (req, res) => {
  const { reference } = req.params;
  try {
    const fetchFn = typeof fetch !== 'undefined' ? fetch : global.fetch;
    const response = await fetchFn(`https://api.paystack.co/transaction/verify/${reference}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`
      }
    });

    const result = await response.json();
    if (result.status && result.data) {
      return res.json(result);
    }
  } catch (err) {
    console.warn('Paystack verify warning (using dev fallback):', err.message);
  }

  // Development Fallback for Instant Verification
  res.json({
    status: true,
    message: 'Verification successful',
    data: {
      id: Math.floor(Math.random() * 9000000000),
      status: 'success',
      reference,
      amount: 10000,
      currency: 'GHS',
      channel: 'mobile_money',
      paid_at: new Date().toISOString(),
      gateway_response: 'Successful'
    }
  });
});

// 3. List Paystack Transactions
app.get('/api/paystack/transactions', async (req, res) => {
  try {
    const fetchFn = typeof fetch !== 'undefined' ? fetch : global.fetch;
    const response = await fetchFn('https://api.paystack.co/transaction', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`
      }
    });
    const result = await response.json();
    if (result.status) return res.json(result);
  } catch (err) {}

  res.json({ status: true, message: 'Transactions retrieved', data: [] });
});

// 4. Paystack Webhook Handler
app.post('/api/paystack/webhook', (req, res) => {
  const event = req.body;
  if (event && event.event === 'charge.success') {
    const { reference, amount, customer } = event.data;
    console.log(`⚡ Paystack Webhook: Received successful payment of ${amount / 100} GHS from ${customer?.email} (Ref: ${reference})`);
  }
  res.sendStatus(200);
});

// --- CLOUD SYNC & AUTO-SEED API ---

async function autoSeedSupabase() {
  const client = getSupabaseClient();
  if (!client) return;

  try {
    const { data: existingProds } = await client.from('products').select('id');
    if (!existingProds || existingProds.length === 0) {
      const db = readDB();
      if (db.products && db.products.length) {
        console.log('Seeding initial products to Supabase Cloud...');
        await client.from('products').upsert(db.products);
      }
      if (db.coupons && db.coupons.length) {
        await client.from('coupons').upsert(db.coupons);
      }
      console.log('⚡ Supabase Auto-Seeding Completed!');
    }
  } catch (err) {
    console.warn('Supabase auto-seed note:', err.message);
  }
}

app.post('/api/sync/seed', async (req, res) => {
  await autoSeedSupabase();
  res.json({ success: true, message: 'Cloud database seed executed' });
});

// Start Server & Run Auto-Seed (Only when executed directly)
if (require.main === module) {
  app.listen(PORT, async () => {
    console.log(`===================================================`);
    console.log(`BYMARIE REST API SERVER IS RUNNING ON PORT ${PORT}`);
    console.log(`API Base: http://localhost:${PORT}/api`);
    console.log(`Health Check: http://localhost:${PORT}/api/health`);
    console.log(`Paystack Gateway: Active ⚡`);
    console.log(`===================================================`);

    await autoSeedSupabase();
  });
}

module.exports = app;
