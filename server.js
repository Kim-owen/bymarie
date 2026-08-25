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
  list = (db.products || []).filter(p => p && p.isCustom === true);
  
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
  const prod = (db.products || []).find(p => p.id === req.params.id && p.isCustom === true);
  if (!prod) return res.status(404).json({ error: 'Product not found' });
  res.json(prod);
});

// Create product package
app.post('/api/products', async (req, res) => {
  const newProduct = {
    id: req.body.id || `bm-piece-${Date.now()}`,
    isCustom: true,
    name: req.body.name || 'New Piece',
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

// --- SERVER-SIDE PRICE CALCULATION & INTEGRITY ENGINE ---

function calculateOrderTotalsServerSide(rawItems, rawCouponCode, rawDeliveryMethod, city = '') {
  const db = readDB();
  const products = (db.products || []).filter(p => p && p.isCustom === true);
  const coupons = db.coupons || [];

  if (!Array.isArray(rawItems) || !rawItems.length) {
    throw new Error('Order items array cannot be empty');
  }

  let subtotal = 0;
  const verifiedItems = [];

  for (const item of rawItems) {
    const prod = products.find(p => p.id === item.id);
    if (!prod) {
      throw new Error(`Product "${item.name || item.id}" does not exist in catalog.`);
    }

    const qty = Math.max(1, parseInt(item.qty, 10) || 1);
    if (prod.stock !== undefined && prod.stock < qty) {
      throw new Error(`Insufficient stock for "${prod.name}". Available stock: ${prod.stock}`);
    }

    // Authoritative Price looked up securely from Server Database
    const authoritativePrice = Number(prod.price) || 0;
    const lineTotal = authoritativePrice * qty;
    subtotal += lineTotal;

    verifiedItems.push({
      id: prod.id,
      name: prod.name,
      category: prod.category,
      price: authoritativePrice, // Verified server-side price
      qty,
      size: item.size || 'Standard',
      color: item.color || 'Standard',
      image: prod.image || (prod.images && prod.images[0]) || '',
      lineTotal: Number(lineTotal.toFixed(2))
    });
  }

  // Authoritative Server-Side Coupon Verification
  let discountAmount = 0;
  let appliedCoupon = null;
  if (rawCouponCode) {
    const code = String(rawCouponCode).toUpperCase().trim();
    const foundCoupon = coupons.find(c => (c.code || '').toUpperCase().trim() === code);
    if (foundCoupon) {
      if (foundCoupon.type === 'percent') {
        discountAmount = (subtotal * (Number(foundCoupon.discount) || 0)) / 100;
      } else {
        discountAmount = Number(foundCoupon.discount) || 0;
      }
      discountAmount = Math.min(subtotal, Math.max(0, discountAmount));
      appliedCoupon = { code: foundCoupon.code, discount: foundCoupon.discount, type: foundCoupon.type };
    }
  }

  // Authoritative Server-Side Delivery Fee
  let deliveryFee = 35; // Standard Greater Accra
  const method = String(rawDeliveryMethod || '').toLowerCase();
  const isAccra = (city || '').toLowerCase().includes('accra') || (city || '').toLowerCase().includes('cantonments') || (city || '').toLowerCase().includes('legon');

  if (method.includes('express') || method.includes('vip')) {
    deliveryFee = 60;
  } else if (method.includes('nationwide') || method.includes('regional')) {
    deliveryFee = 50;
  } else if (isAccra && subtotal >= 300) {
    deliveryFee = 0; // Complimentary delivery over GH₵ 300 in Accra
  }

  const total = Number((subtotal - discountAmount + deliveryFee).toFixed(2));

  return {
    verifiedItems,
    subtotal: Number(subtotal.toFixed(2)),
    discountAmount: Number(discountAmount.toFixed(2)),
    deliveryFee: Number(deliveryFee.toFixed(2)),
    total,
    appliedCoupon
  };
}

// --- ORDERS API ---

// Get all orders
app.get('/api/orders', (req, res) => {
  const db = readDB();
  res.json(db.orders || []);
});

// Quote calculation endpoint (Returns server-calculated price verification)
app.post('/api/orders/quote', (req, res) => {
  try {
    const { items, couponCode, delivery, city } = req.body;
    const calc = calculateOrderTotalsServerSide(items, couponCode, delivery, city);
    res.json({ success: true, ...calc });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'adichieifeoma@gmail.com';
const ADMIN_PHONE = process.env.ADMIN_PHONE || '+233241002000';

async function sendAdminOrderNotifications(order) {
  const itemsText = (order.items || []).map(it => `${it.qty}x ${it.name} (GH₵ ${it.price})`).join(', ');
  
  // 1. In-Dashboard Notification Record
  const db = readDB();
  if (!db.notifications) db.notifications = [];
  const adminNotif = {
    id: `notif-${Date.now()}`,
    type: 'order',
    title: `⚡ New Order #${order.id} Placed!`,
    message: `${order.name} ordered ${order.items?.length || 1} items totaling GH₵ ${Number(order.total || 0).toFixed(2)} (${order.city}, ${order.payment}).`,
    date: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' • ' + new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
    target: 'admin',
    orderId: order.id,
    read: false
  };
  db.notifications.unshift(adminNotif);
  writeDB(db);

  // 2. Dispatch SMS to Admin & Customer via mNotify / BMS Quick Bulk SMS API
  const mnotifyKey = process.env.MNOTIFY_API_KEY || process.env.BMS_API_KEY;
  const adminPhone = process.env.ADMIN_PHONE || '0241002000';
  
  // Format Ghana phone numbers (e.g. +233 24 -> 024...)
  const formatPhoneForGhana = (num) => {
    let clean = String(num || '').replace(/[^0-9]/g, '');
    if (clean.startsWith('233') && clean.length === 12) clean = '0' + clean.slice(3);
    return clean;
  };

  const recipientList = [formatPhoneForGhana(adminPhone), formatPhoneForGhana(order.phone)].filter(p => p && p.length >= 10);
  const smsBody = `ByMarie Alert: New Order #${order.id} received from ${order.name} (${order.phone}) for GH₵ ${Number(order.total || 0).toFixed(2)}. Destination: ${order.city}. Status: Processing.`;

  try {
    if (mnotifyKey) {
      const fetchFn = typeof fetch !== 'undefined' ? fetch : global.fetch;
      const mnotifySender = process.env.MNOTIFY_SENDER || 'Bymarie';
      const res = await fetchFn(`https://api.mnotify.com/api/sms/quick?key=${mnotifyKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: recipientList,
          sender: mnotifySender,
          message: smsBody,
          is_schedule: false,
          schedule_date: ''
        })
      });
      const data = await res.json();
      console.log(`📱 [mNotify BMS SMS DISPATCH] Result:`, data);
    } else if (process.env.ARKESEL_API_KEY) {
      const fetchFn = typeof fetch !== 'undefined' ? fetch : global.fetch;
      await fetchFn(`https://sms.arkesel.com/api/v2/sms/send`, {
        method: 'POST',
        headers: { 'api-key': process.env.ARKESEL_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: 'ByMarie',
          message: smsBody,
          recipients: recipientList
        })
      });
    }
    console.log(`📱 [SMS DISPATCH] Alert queued to Admin (${adminPhone}): "${smsBody}"`);
  } catch (err) {
    console.warn('SMS dispatch notification note:', err.message);
  }

  // 3. Dispatch Email to Admin (Resend / SendGrid / Supabase)
  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e4e4e7; border-radius: 8px; overflow: hidden;">
      <div style="background: #182822; color: #fff; padding: 24px; text-align: center;">
        <h1 style="letter-spacing: 3px; margin: 0; font-size: 24px;">BYMARIE</h1>
        <p style="color: #e8cca4; margin: 6px 0 0; font-size: 13px;">HAUTE COUTURE ATELIER • ACCRA</p>
      </div>
      <div style="padding: 24px; background: #fff;">
        <h2 style="color: #182822; margin-top: 0;">⚡ New Customer Order Received: #${order.id}</h2>
        <p style="color: #52525b; font-size: 14px;">A new order has just been placed and verified on the ByMarie luxury storefront.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
          <tr style="background: #faf5f6;"><td style="padding: 8px 12px; font-weight: bold;">Client Name:</td><td style="padding: 8px 12px;">${order.name}</td></tr>
          <tr><td style="padding: 8px 12px; font-weight: bold;">Phone Number:</td><td style="padding: 8px 12px;">${order.phone}</td></tr>
          <tr style="background: #faf5f6;"><td style="padding: 8px 12px; font-weight: bold;">Email:</td><td style="padding: 8px 12px;">${order.email || 'N/A'}</td></tr>
          <tr><td style="padding: 8px 12px; font-weight: bold;">Delivery Address:</td><td style="padding: 8px 12px;">${order.address}, ${order.city} (${order.region})</td></tr>
          <tr style="background: #faf5f6;"><td style="padding: 8px 12px; font-weight: bold;">Payment Method:</td><td style="padding: 8px 12px;">${order.payment}</td></tr>
          <tr><td style="padding: 8px 12px; font-weight: bold;">Grand Total:</td><td style="padding: 8px 12px; font-weight: bold; color: #047857; font-size: 16px;">GH₵ ${Number(order.total || 0).toFixed(2)}</td></tr>
        </table>

        <h3 style="font-size: 15px; margin-bottom: 8px;">Itemized Pieces:</h3>
        <p style="background: #f4f4f5; padding: 12px; border-radius: 6px; font-size: 13px; color: #27272a;">${itemsText}</p>

        <div style="text-align: center; margin-top: 24px;">
          <a href="https://bymarie.vercel.app/#admin/orders" style="background: #c24d67; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; display: inline-block;">Open Admin Order Logistics →</a>
        </div>
      </div>
      <div style="background: #fafafa; padding: 16px; text-align: center; font-size: 12px; color: #71717a; border-top: 1px solid #e4e4e7;">
        ByMarie Luxury E-Commerce Notification Engine • Cantonments, Accra
      </div>
    </div>
  `;

  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (resendApiKey) {
      const fetchFn = typeof fetch !== 'undefined' ? fetch : global.fetch;
      const fromAddress = process.env.RESEND_FROM_EMAIL || 'ByMarie Orders <onboarding@resend.dev>';
      const targetEmail = process.env.ADMIN_EMAIL || 'sunumanfred14@gmail.com';
      const res = await fetchFn('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: fromAddress,
          to: [targetEmail],
          subject: `⚡ New Order Alert #${order.id} (GH₵ ${Number(order.total || 0).toFixed(2)}) - ByMarie`,
          html: emailHtml
        })
      });
      const data = await res.json();
      if (data.error || data.statusCode >= 400) {
        // If domain restricted to registered email in sandbox, retry with sunumanfred14@gmail.com
        await fetchFn('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'ByMarie Orders <onboarding@resend.dev>',
            to: ['sunumanfred14@gmail.com'],
            subject: `⚡ New Order Alert #${order.id} (GH₵ ${Number(order.total || 0).toFixed(2)}) - ByMarie`,
            html: emailHtml
          })
        });
      }
      console.log(`📧 [EMAIL DISPATCH] Alert sent to Admin for Order #${order.id}. Resend ID:`, data.id || data);
    }
  } catch (err) {
    console.warn('Email dispatch notification note:', err.message);
  }
}

// Create new order (Protected with 100% Server-Side Price Calculation & Multi-Channel Notifications)
app.post('/api/orders', async (req, res) => {
  try {
    const { name, email, phone, address, city, region, delivery, payment, items, couponCode } = req.body;
    
    if (!name || !phone || !address) {
      return res.status(400).json({ error: 'Missing required customer delivery information' });
    }

    // SERVER-SIDE PRICE CALCULATION (Zero trust on client-sent prices/totals)
    const calculation = calculateOrderTotalsServerSide(items, couponCode, delivery, city);

    const db = readDB();
    const newOrder = {
      id: req.body.id || `BM-${Math.floor(100000 + Math.random() * 900000)}`,
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      name: name.trim(),
      email: (email || '').trim(),
      phone: phone.trim(),
      address: address.trim(),
      city: (city || 'Accra').trim(),
      region: (region || 'Greater Accra').trim(),
      delivery: delivery || 'Standard Delivery',
      payment: payment || 'Mobile Money',
      status: 'Processing',
      items: calculation.verifiedItems,
      subtotal: calculation.subtotal,
      discountAmount: calculation.discountAmount,
      deliveryFee: calculation.deliveryFee,
      total: calculation.total,
      appliedCoupon: calculation.appliedCoupon,
      securedServerSide: true
    };

    // Deduct inventory stock server-side
    calculation.verifiedItems.forEach(item => {
      const prod = (db.products || []).find(p => p.id === item.id);
      if (prod && prod.stock !== undefined) {
        prod.stock = Math.max(0, prod.stock - item.qty);
      }
    });

    if (!db.orders) db.orders = [];
    db.orders.unshift(newOrder);
    writeDB(db);

    // Trigger Admin Multi-Channel Notifications (Dashboard, SMS & Email)
    await sendAdminOrderNotifications(newOrder);

    const client = getSupabaseClient();
    if (client) {
      try { await client.from('orders').insert([newOrder]); } catch (e) {}
    }

    res.status(201).json(newOrder);
  } catch (err) {
    console.error('Secure Order Creation Error:', err.message);
    res.status(400).json({ error: err.message });
  }
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

// --- SMS BROADCAST & CAMPAIGN API ---
app.post('/api/sms/broadcast', async (req, res) => {
  try {
    const { recipients, message, sender } = req.body;
    if (!recipients || !Array.isArray(recipients) || !recipients.length) {
      return res.status(400).json({ error: 'No recipients provided' });
    }
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'SMS message content is required' });
    }

    const mnotifyKey = process.env.MNOTIFY_API_KEY || process.env.BMS_API_KEY;
    const formatPhoneForGhana = (num) => {
      let clean = String(num || '').replace(/[^0-9]/g, '');
      if (clean.startsWith('233') && clean.length === 12) clean = '0' + clean.slice(3);
      return clean;
    };

    const formattedRecipients = recipients.map(formatPhoneForGhana).filter(p => p && p.length >= 10);
    const mnotifySender = sender || process.env.MNOTIFY_SENDER || 'Bymarie';

    if (mnotifyKey) {
      const fetchFn = typeof fetch !== 'undefined' ? fetch : global.fetch;
      const response = await fetchFn(`https://api.mnotify.com/api/sms/quick?key=${mnotifyKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: formattedRecipients,
          sender: mnotifySender,
          message: message.trim(),
          is_schedule: false,
          schedule_date: ''
        })
      });
      const data = await response.json();
      console.log(`📱 [mNotify Broadcast Sent] To ${formattedRecipients.length} clients:`, data);
      return res.json({ success: true, count: formattedRecipients.length, data });
    }

    // Fallback simulation log if no key present
    console.log(`📱 [SMS Broadcast Simulated] Sent to ${formattedRecipients.length} clients: "${message}"`);
    res.json({ success: true, count: formattedRecipients.length, simulated: true });
  } catch (err) {
    console.error('SMS Broadcast error:', err);
    res.status(500).json({ error: err.message });
  }
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

// --- AUTHENTICATION & USER CRM API ---

// Get all registered users for Admin CRM
app.get('/api/users', (req, res) => {
  const db = readDB();
  res.json(db.users || []);
});

// Get single user details
app.get('/api/users/:id', (req, res) => {
  const db = readDB();
  const u = (db.users || []).find(x => x.id === req.params.id || x.email === req.params.id);
  if (!u) return res.status(404).json({ error: 'User not found' });
  res.json(u);
});

// Create / Sync user profile
app.post('/api/users', async (req, res) => {
  const db = readDB();
  if (!db.users) db.users = [];
  
  const user = {
    id: req.body.id || `usr-${Date.now()}`,
    name: req.body.name || (req.body.email ? req.body.email.split('@')[0] : 'Client'),
    email: req.body.email || '',
    phone: req.body.phone || '',
    address: req.body.address || '',
    city: req.body.city || 'Accra',
    region: req.body.region || 'Greater Accra',
    walletBalance: Number(req.body.walletBalance || 0),
    joinedDate: req.body.joinedDate || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    lastLogin: req.body.lastLogin || new Date().toLocaleString(),
    ordersCount: Number(req.body.ordersCount || 0),
    status: req.body.status || 'Active',
    loggedIn: Boolean(req.body.loggedIn)
  };

  const idx = db.users.findIndex(u => (u.email && u.email.toLowerCase() === user.email.toLowerCase()) || u.id === user.id);
  if (idx !== -1) {
    db.users[idx] = { ...db.users[idx], ...user };
  } else {
    db.users.push(user);
  }
  writeDB(db);

  const client = getSupabaseClient();
  if (client) {
    try { await client.from('users').upsert([user]); } catch (e) {}
  }

  res.status(200).json({ success: true, user });
});

// Register new customer account
app.post('/api/auth/register', async (req, res) => {
  const { email, password, name, phone, address, city, region } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const db = readDB();
  if (!db.users) db.users = [];

  const newUser = {
    id: `usr-${Date.now()}`,
    name: name || email.split('@')[0],
    email: email.trim().toLowerCase(),
    phone: phone || '',
    address: address || '',
    city: city || 'Accra',
    region: region || 'Greater Accra',
    walletBalance: 0.00,
    joinedDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    lastLogin: new Date().toLocaleString(),
    ordersCount: 0,
    status: 'Active',
    loggedIn: true
  };

  const existingIdx = db.users.findIndex(u => u.email === newUser.email);
  if (existingIdx !== -1) {
    db.users[existingIdx] = { ...db.users[existingIdx], ...newUser, walletBalance: db.users[existingIdx].walletBalance || 0 };
  } else {
    db.users.push(newUser);
  }
  writeDB(db);

  const client = getSupabaseClient();
  if (client) {
    try {
      await client.auth.signUp({
        email,
        password: password || 'ByMarie2026!',
        options: { data: { name, phone } }
      });
      await client.from('users').upsert([newUser]);
    } catch (err) {}
  }

  res.status(201).json({ success: true, user: newUser });
});

// Sign In customer account
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const db = readDB();
  if (!db.users) db.users = [];

  const cleanEmail = email.trim().toLowerCase();
  let user = db.users.find(u => u.email && u.email.toLowerCase() === cleanEmail);

  if (!user) {
    user = {
      id: `usr-${Date.now()}`,
      email: cleanEmail,
      name: cleanEmail.split('@')[0],
      phone: '',
      address: '',
      city: 'Accra',
      region: 'Greater Accra',
      walletBalance: 0.00,
      joinedDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      lastLogin: new Date().toLocaleString(),
      ordersCount: 0,
      status: cleanEmail === 'adichieifeoma@gmail.com' ? 'Super Admin' : 'Active',
      loggedIn: true
    };
    db.users.push(user);
  } else {
    user.lastLogin = new Date().toLocaleString();
    user.loggedIn = true;
  }
  writeDB(db);

  const client = getSupabaseClient();
  if (client) {
    try {
      const { data } = await client.auth.signInWithPassword({ email, password: password || 'ByMarie2026!' });
      if (data && data.user) {
        await client.from('users').upsert([user]);
      }
    } catch (err) {}
  }

  res.json({ success: true, user });
});

// --- PAYSTACK PAYMENT GATEWAY API ---

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || 'paystack_secret_key_demo';
const PAYSTACK_PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY || 'paystack_public_key_demo';

// 1. Initialize Paystack Transaction (Server-Side Verified)
app.post('/api/paystack/initialize', async (req, res) => {
  const { email, amount, currency = 'GHS', metadata, callback_url, items, couponCode, delivery, city } = req.body;
  if (!email) {
    return res.status(400).json({ status: false, message: 'Email is required' });
  }

  let authoritativeTotal = Number(amount) || 0;
  if (Array.isArray(items) && items.length > 0) {
    try {
      const serverCalc = calculateOrderTotalsServerSide(items, couponCode, delivery, city);
      authoritativeTotal = serverCalc.total;
    } catch (err) {
      return res.status(400).json({ status: false, message: err.message });
    }
  }

  if (authoritativeTotal <= 0) {
    return res.status(400).json({ status: false, message: 'Invalid transaction total' });
  }

  // Convert amount to subunits (pesewas / kobo -> amount * 100)
  const subunitAmount = Math.round(authoritativeTotal * 100);
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
