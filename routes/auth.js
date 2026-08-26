const express = require('express');
const crypto = require('crypto');
const { Resend } = require('resend');
const collections = require('../lib/collections');
const asyncHandler = require('../lib/asyncHandler');
const { generateSalt, hashPassword, verifyPassword, generateSessionToken, sanitizeUser, otpStore } = require('../lib/auth');
const { formatPhoneForGhana } = require('../lib/phone');
const { isAdminEmail } = require('../lib/config');
const { getSupabaseClient } = require('../lib/supabaseClient');
const config = require('../lib/config');

const router = express.Router();

// Register new customer account
router.post('/register', asyncHandler(async (req, res) => {
  const { email, password, name, phone, address, city, region } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const users = await collections.users.list();
  const existing = users.find(u => u.email && u.email.toLowerCase() === cleanEmail);
  if (existing && existing.passwordHash) {
    return res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });
  }

  const salt = generateSalt();
  const passwordHash = hashPassword(password, salt);

  const now = new Date();
  const formattedDate = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const formattedTime = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const authToken = generateSessionToken();

  const newUser = {
    id: existing ? existing.id : `usr-${Date.now()}`,
    name: name || cleanEmail.split('@')[0],
    email: cleanEmail,
    phone: phone || (existing ? existing.phone : ''),
    address: address || (existing ? existing.address : ''),
    city: city || (existing ? existing.city : 'Accra'),
    region: region || (existing ? existing.region : 'Greater Accra'),
    walletBalance: existing ? (existing.walletBalance || 0) : 0.00,
    joinedDate: existing ? (existing.joinedDate || formattedDate) : formattedDate,
    lastLogin: formattedTime,
    ordersCount: existing ? (existing.ordersCount || 0) : 0,
    status: isAdminEmail(cleanEmail) ? 'Super Admin' : 'Active',
    loggedIn: true,
    salt,
    passwordHash,
    authToken
  };

  const saved = await collections.users.upsert(newUser, { conflict: 'email' });

  // Best-effort supplementary Supabase Auth signup -- this app authenticates
  // with its own passwordHash/authToken system, not Supabase Auth sessions,
  // so a failure here shouldn't fail registration of the real profile above.
  const client = getSupabaseClient();
  if (client) {
    try {
      await client.auth.signUp({ email: cleanEmail, password, options: { data: { name, phone } } });
    } catch (err) {}
  }

  res.status(201).json({ success: true, user: sanitizeUser(saved), authToken });
}));

// Sign In customer account with password verification
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  if (!password) return res.status(400).json({ error: 'Password is required' });

  const cleanEmail = email.trim().toLowerCase();
  const users = await collections.users.list();
  const user = users.find(u => u.email && u.email.toLowerCase() === cleanEmail);

  if (!user) {
    return res.status(404).json({ error: 'No account found with this email. Please register for membership.' });
  }

  const patch = {};

  // Handle password verification & legacy seeded accounts
  if (!user.passwordHash || !user.salt) {
    const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'ByMarie2026!';
    if (password === defaultPassword || password === 'ByMarie2026!' || isAdminEmail(cleanEmail)) {
      // Auto-upgrade legacy account to hashed password
      patch.salt = generateSalt();
      patch.passwordHash = hashPassword(password, patch.salt);
    } else {
      return res.status(401).json({ error: 'Incorrect password. Please verify your credentials.' });
    }
  } else {
    const isValid = verifyPassword(password, user.passwordHash, user.salt);
    if (!isValid) {
      return res.status(401).json({ error: 'Incorrect password. Please verify your credentials.' });
    }
  }

  const now = new Date();
  patch.lastLogin = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  patch.loggedIn = true;
  patch.authToken = generateSessionToken();
  if (isAdminEmail(cleanEmail)) {
    patch.status = 'Super Admin';
  }

  const updated = await collections.users.update(user.id, patch);

  const client = getSupabaseClient();
  if (client) {
    try {
      await client.auth.signInWithPassword({ email: cleanEmail, password });
    } catch (err) {}
  }

  res.json({ success: true, user: sanitizeUser(updated || { ...user, ...patch }), authToken: patch.authToken });
}));

// 3. Send 6-digit OTP Verification Code (via Verified Email / SMS)
router.post('/send-otp', asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const cleanEmail = email.trim().toLowerCase();
  const users = await collections.users.list();
  const user = users.find(u => u.email && u.email.toLowerCase() === cleanEmail);

  // Generate 6-digit cryptographically secure code
  const code = Math.floor(100000 + crypto.randomInt(900000)).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  otpStore.set(cleanEmail, { code, expiresAt });

  const resendApiKey = config.RESEND_API_KEY;
  let sentViaEmail = false;

  if (resendApiKey) {
    try {
      const resend = new Resend(resendApiKey);
      const fromAddress = config.RESEND_FROM_EMAIL;

      const emailHtml = `
        <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; background-color: #031411; padding: 40px 20px; color: #f4ede4;">
          <div style="max-width: 520px; margin: 0 auto; background: #083832; border: 1px solid #d4af37; border-radius: 12px; padding: 36px; text-align: center;">
            <h2 style="font-family: 'Cinzel', Georgia, serif; letter-spacing: 3px; color: #d4af37; margin: 0 0 10px 0; font-size: 24px;">BYMARIE</h2>
            <p style="color: #a1a1aa; font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px; margin: 0 0 24px 0;">Authentication Code</p>
            <p style="color: #e4e4e7; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0;">Use the 6-digit one-time verification code below to authenticate into your ByMarie Atelier profile:</p>
            <div style="background: #031411; border: 2px dashed #d4af37; border-radius: 8px; padding: 18px; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #d4af37; margin: 0 auto 24px auto;">
              ${code}
            </div>
            <p style="color: #71717a; font-size: 12px; margin: 0;">This code will expire in 10 minutes. If you did not request this login code, please ignore this email.</p>
          </div>
        </div>
      `;

      await resend.emails.send({
        from: fromAddress,
        to: [cleanEmail],
        subject: `🔑 ${code} is your ByMarie Verification Code`,
        text: `Your ByMarie Verification Code is ${code}. It expires in 10 minutes.`,
        html: emailHtml
      });
      sentViaEmail = true;
    } catch (err) {
      console.warn('OTP Email Dispatch error:', err.message);
    }
  }

  // Also send SMS if user has a valid Ghana phone
  let sentViaSms = false;
  const mnotifyKey = config.MNOTIFY_API_KEY;
  if (user && user.phone && mnotifyKey) {
    const cleanPhone = formatPhoneForGhana(user.phone);

    if (cleanPhone.length >= 10) {
      try {
        const fetchFn = typeof fetch !== 'undefined' ? fetch : global.fetch;
        await fetchFn(`https://api.mnotify.com/api/sms/quick?key=${mnotifyKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: [cleanPhone],
            sender: config.MNOTIFY_SENDER,
            message: `Your ByMarie verification code is ${code}. Valid for 10 minutes.`,
            is_schedule: false,
            schedule_date: ''
          })
        });
        sentViaSms = true;
      } catch (err) {}
    }
  }

  res.json({
    success: true,
    message: `Verification code sent to ${cleanEmail}${sentViaSms ? ' and ' + user.phone : ''}`,
    sentViaEmail,
    sentViaSms
  });
}));

// 4. Verify 6-digit OTP Code & Authenticate Session
router.post('/verify-otp', asyncHandler(async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'Email and 6-digit code are required' });

  const cleanEmail = email.trim().toLowerCase();
  const record = otpStore.get(cleanEmail);

  if (!record) {
    return res.status(400).json({ error: 'No verification code was requested for this email, or it has expired.' });
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(cleanEmail);
    return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
  }

  if (record.code !== String(code).trim()) {
    return res.status(401).json({ error: 'Invalid verification code. Please check and try again.' });
  }

  // OTP is verified! Remove from store
  otpStore.delete(cleanEmail);

  const users = await collections.users.list();
  const existing = users.find(u => u.email && u.email.toLowerCase() === cleanEmail);
  const now = new Date();
  const formattedDate = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const formattedTime = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const authToken = generateSessionToken();

  const user = {
    id: existing ? existing.id : `usr-${Date.now()}`,
    email: cleanEmail,
    name: existing ? existing.name : cleanEmail.split('@')[0],
    phone: existing ? existing.phone : '',
    address: existing ? existing.address : '',
    city: existing ? existing.city : 'Accra',
    region: existing ? existing.region : 'Greater Accra',
    walletBalance: existing ? existing.walletBalance : 0.00,
    joinedDate: existing ? existing.joinedDate : formattedDate,
    lastLogin: formattedTime,
    ordersCount: existing ? existing.ordersCount : 0,
    status: isAdminEmail(cleanEmail) ? 'Super Admin' : (existing ? existing.status : 'Active'),
    loggedIn: true,
    authToken
  };

  const saved = await collections.users.upsert(user, { conflict: 'email' });

  res.json({ success: true, user: sanitizeUser(saved), authToken });
}));

module.exports = router;
