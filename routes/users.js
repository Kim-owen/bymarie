const express = require('express');
const collections = require('../lib/collections');
const asyncHandler = require('../lib/asyncHandler');
const { sanitizeUser } = require('../lib/auth');
const { isAdminEmail } = require('../lib/config');

const router = express.Router();

function findUserByIdOrEmail(users, idOrEmail) {
  const target = String(idOrEmail || '').toLowerCase();
  return users.find(u => u.id === idOrEmail || (u.email && u.email.toLowerCase() === target));
}

// Get all registered users for Storefront & Admin CRM
router.get('/users', asyncHandler(async (req, res) => {
  const [users, orders] = await Promise.all([collections.users.list(), collections.orders.list()]);

  const enriched = users.map(u => {
    if (!u.email) return u;
    const emailLower = u.email.trim().toLowerCase();
    const ordersCount = orders.filter(o => o.email && o.email.trim().toLowerCase() === emailLower).length;
    const status = isAdminEmail(emailLower) ? 'Super Admin' : (u.status || 'Active');
    return { ...u, ordersCount, status };
  });

  res.json(enriched.map(sanitizeUser));
}));

// Get single user details
router.get('/users/:id', asyncHandler(async (req, res) => {
  const users = await collections.users.list();
  const u = findUserByIdOrEmail(users, req.params.id);
  if (!u) return res.status(404).json({ error: 'User not found' });
  res.json(sanitizeUser(u));
}));

// Create / Sync user profile
router.post('/users', asyncHandler(async (req, res) => {
  const user = {
    id: req.body.id || `usr-${Date.now()}`,
    name: req.body.name || (req.body.email ? req.body.email.split('@')[0] : 'Client'),
    email: (req.body.email || '').trim().toLowerCase(),
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

  // Conflict target is email (the real business key -- it's UNIQUE) rather
  // than id, so re-syncing the same account from a fresh client never creates
  // a duplicate row or trips the unique constraint.
  const saved = await collections.users.upsert(user, { conflict: 'email' });
  res.status(200).json({ success: true, user: saved });
}));

// Wallet balance adjustment
router.patch('/users/:id/wallet', asyncHandler(async (req, res) => {
  const { delta, reason } = req.body;
  const users = await collections.users.list();
  const user = findUserByIdOrEmail(users, req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const newBalance = Math.max(0, Math.round(((Number(user.walletBalance) || 0) + Number(delta)) * 100) / 100);
  const updated = await collections.users.update(user.id, { walletBalance: newBalance });

  res.json({ success: true, user: updated, newBalance, reason });
}));

module.exports = router;
