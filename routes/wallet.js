const express = require('express');
const collections = require('../lib/collections');
const asyncHandler = require('../lib/asyncHandler');
const { formatPhoneForGhana } = require('../lib/phone');
const config = require('../lib/config');

const router = express.Router();

router.post('/wallet/deposit', asyncHandler(async (req, res) => {
  const { userId, email, name, phone, amount, reference, paymentMethod } = req.body;
  const numAmount = Number(amount || 0);
  if (numAmount <= 0) return res.status(400).json({ error: 'Invalid deposit amount' });

  const users = await collections.users.list();
  const emailLower = (email || '').toLowerCase();
  let user = users.find(u => (u.email && u.email.toLowerCase() === emailLower) || u.id === userId);

  if (user) {
    user = { ...user, walletBalance: Number(((Number(user.walletBalance) || 0) + numAmount).toFixed(2)) };
  } else {
    user = {
      id: userId || `usr-${Date.now()}`,
      name: name || 'Valued Member',
      email: email || '',
      phone: phone || '',
      walletBalance: numAmount,
      joinedDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      ordersCount: 0,
      status: 'Active'
    };
  }

  const savedUser = await collections.users.upsert(user, { conflict: 'email' });

  // In-Dashboard Notification
  const depositNotif = {
    id: `notif-${Date.now()}`,
    type: 'wallet',
    title: `💳 Float Wallet Top-Up: GH₵ ${numAmount.toFixed(2)}`,
    message: `${savedUser.name} deposited GH₵ ${numAmount.toFixed(2)} via Paystack ${paymentMethod || 'Mobile Money'}. Reference: ${reference || 'N/A'}.`,
    date: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' • Today',
    target: 'admin',
    read: false
  };
  try {
    await collections.notifications.insert(depositNotif);
  } catch (e) {
    console.warn('Wallet deposit notification record could not be saved:', e.message);
  }

  // SMS Notifications via mNotify / BMS -- best-effort: a deposit that's
  // already saved should not be reported as failed just because the SMS
  // carrier hiccups.
  try {
    const mnotifyKey = config.MNOTIFY_API_KEY;
    const mnotifySender = config.MNOTIFY_SENDER;

    if (mnotifyKey) {
      const fetchFn = typeof fetch !== 'undefined' ? fetch : global.fetch;

      const custPhone = formatPhoneForGhana(savedUser.phone || phone);
      if (custPhone && custPhone.length >= 10) {
        await fetchFn(`https://api.mnotify.com/api/sms/quick?key=${mnotifyKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: [custPhone],
            sender: mnotifySender,
            message: `ByMarie: Your Float Wallet has been credited with GH₵ ${numAmount.toFixed(2)}! New available balance: GH₵ ${Number(savedUser.walletBalance).toFixed(2)}. Enjoy instant 1-click checkout at bymarie.shop.`,
            is_schedule: false,
            schedule_date: ''
          })
        });
      }

      const admPhone = formatPhoneForGhana(config.ADMIN_PHONE);
      if (admPhone && admPhone.length >= 10) {
        await fetchFn(`https://api.mnotify.com/api/sms/quick?key=${mnotifyKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: [admPhone],
            sender: mnotifySender,
            message: `ByMarie Float Top-Up: ${savedUser.name} (${savedUser.phone}) added GH₵ ${numAmount.toFixed(2)} to Float Wallet. New balance: GH₵ ${Number(savedUser.walletBalance).toFixed(2)}.`,
            is_schedule: false,
            schedule_date: ''
          })
        });
      }
    }
  } catch (err) {
    console.warn('Wallet deposit SMS dispatch note:', err.message);
  }

  res.json({ success: true, user: savedUser, balance: savedUser.walletBalance });
}));

module.exports = router;
