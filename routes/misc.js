const express = require('express');
const asyncHandler = require('../lib/asyncHandler');
const collections = require('../lib/collections');
const { isSupabaseConfigured, getSupabaseUrl } = require('../lib/supabaseClient');
const { autoSeedSupabase } = require('../lib/seed');
const config = require('../lib/config');

const router = express.Router();

// Public Runtime Config (Safe & Sanitized -- never sends the service-role
// key, only the public anon key, matching what the browser is allowed to see)
router.get('/config', (req, res) => {
  const supabaseActive = isSupabaseConfigured();
  res.json({
    success: true,
    supabaseUrl: getSupabaseUrl(),
    supabaseAnonKey: (process.env.SUPABASE_ANON_KEY || '').trim(),
    paystackPublicKey: config.PAYSTACK_PUBLIC_KEY,
    supabaseConnected: supabaseActive,
    storeName: 'ByMarie Maison',
    storeEmail: config.ADMIN_EMAIL
  });
});

// Health Check
router.get('/health', (req, res) => {
  const supabaseActive = isSupabaseConfigured();
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    database: supabaseActive ? 'supabase' : 'local-json-fallback',
    supabaseConnected: supabaseActive,
    hasUrl: !!process.env.SUPABASE_URL,
    hasAnonKey: !!process.env.SUPABASE_ANON_KEY,
    hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
  });
});

// Full database snapshot across every collection (not just whatever happens
// to be in the ephemeral local file), for a genuinely useful manual backup.
router.get('/database/backup', asyncHandler(async (req, res) => {
  const [products, orders, coupons, users, notifications, campaigns, wholesale_inquiries, wallet_transactions, site_settings] = await Promise.all([
    collections.products.list(),
    collections.orders.list(),
    collections.coupons.list(),
    collections.users.list(),
    collections.notifications.list(),
    collections.campaigns.list(),
    collections.wholesale.list(),
    collections.walletTransactions.list(),
    collections.settings.get()
  ]);

  const snapshot = { products, orders, coupons, users, notifications, campaigns, wholesale_inquiries, wallet_transactions, site_settings };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="bymarie_db_backup.json"');
  res.send(JSON.stringify(snapshot, null, 2));
}));

// Manual trigger for the local-fallback -> Supabase seed helper
router.post('/sync/seed', asyncHandler(async (req, res) => {
  await autoSeedSupabase();
  res.json({ success: true, message: 'Cloud database seed executed' });
}));

module.exports = router;
